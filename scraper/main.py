"""Run repeatedly: fetch new articles, extract text, regroup, commit atomically."""
import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
from scraper.db import Database
from scraper.grouping import group_articles
from scraper.ingestion import normalize_entry, read_feed, extract_body, utc_now, iso


def emit(event, **data):
    print(json.dumps({"event": event, **data}), flush=True)


def integer_env(key, default, low, high):
    return max(low, min(high, int(os.getenv(key, str(default)))))


def run(demo=False):
    db = Database()
    sources = json.loads((ROOT / "shared/sources.json").read_text())
    timeout = integer_env("REQUEST_TIMEOUT_SECONDS", 25, 3, 30)
    max_articles = integer_env("MAX_ARTICLES_PER_FEED", 30, 1, 100)
    retention = integer_env("RETENTION_DAYS", 30, 1, 90)
    cutoff = iso(utc_now() - timedelta(days=retention))
    existing = {a["url"] for a in db.all("SELECT url FROM articles")}
    was_demo = db.meta("data_mode") == "demo"
    warnings, statuses, fresh = [], [], []
    image_updates = []
    skipped = 0
    try:
        if demo:
            if existing and not was_demo:
                raise ValueError("Demo refused: this database already contains real news. Use a separate DB_PATH for sample data.")
            from scraper.demo import sample_articles
            fresh = sample_articles()
            statuses = [{"id": s["id"], "status": "sample", "message": "Fictional sample data"} for s in sources]
        else:
            # End the read transaction before slow network work on PostgreSQL.
            db.connection.commit()
            for index, source in enumerate(sources):
                emit("progress", progress=5 + index * 8, message=f"Reading {source['name']}")
                try:
                    entries = read_feed(source, timeout)
                    new_count = 0
                    for entry in entries[:max_articles]:
                        article = normalize_entry(entry, source)
                        if not article or article["published_at"] < cutoff:
                            continue
                        if article["url"] in existing:
                            if article.get("image_url"):
                                image_updates.append((article["image_url"], article["url"]))
                            skipped += 1
                            continue
                        existing.add(article["url"])
                        fresh.append(article)
                        new_count += 1
                    statuses.append({"id": source["id"], "status": "ok", "new_articles": new_count, "message": "Feed received"})
                except Exception as exc:
                    # Isolate failures to one feed; do not lose the other sources.
                    message = f"{source['name']}: feed unavailable ({type(exc).__name__})"
                    warnings.append(message)
                    statuses.append({"id": source["id"], "status": "error", "message": message})
            if not any(s["status"] == "ok" for s in statuses):
                raise RuntimeError("All news feeds are unavailable. Check the network and try again. Existing data was kept.")

            emit("progress", progress=30, message=f"Extracting {len(fresh)} new articles")
            by_id = {s["id"]: s for s in sources}
            with ThreadPoolExecutor(max_workers=integer_env("ARTICLE_WORKERS", 4, 1, 6)) as executor:
                futures = {executor.submit(extract_body, a, by_id[a["source_id"]], timeout): a for a in fresh}
                completed = []
                for future in as_completed(futures):
                    try:
                        completed.append(future.result())
                    except Exception:
                        fallback = futures[future]
                        fallback["content"] = fallback["summary"]
                        completed.append(fallback)
                    emit("progress", progress=30 + int(45 * len(completed) / max(1, len(fresh))), message=f"Processed {len(completed)} of {len(fresh)} new articles")
                fresh = completed

        emit("progress", progress=80, message="Grouping related stories")
        # One transaction: readers see either the old complete snapshot or the new one.
        if demo or was_demo:
            db.execute("DELETE FROM articles")
            db.execute("DELETE FROM clusters")
        for a in fresh:
            db.execute("""INSERT INTO articles(id,url,title,source_id,summary,content,published_at,date_estimated,fetched_at,extraction_status,image_url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO NOTHING""",
                tuple(a.get(k) for k in ("id", "url", "title", "source_id", "summary", "content", "published_at", "date_estimated", "fetched_at", "extraction_status", "image_url")))
        for image_url, url in image_updates:
            db.execute("UPDATE articles SET image_url=? WHERE url=? AND image_url IS NULL", (image_url, url))
        db.execute("DELETE FROM articles WHERE published_at < ?", (cutoff,))
        # A bounded working set keeps the deliberately simple O(n²) algorithm practical.
        older = db.all("SELECT id FROM articles ORDER BY published_at DESC, id LIMIT 1000000 OFFSET 1500")
        for article in older:
            db.execute("DELETE FROM articles WHERE id = ?", (article["id"],))
        articles = db.all("SELECT id,title,summary,published_at FROM articles ORDER BY published_at,id")
        threshold = float(os.getenv("CLUSTER_SIMILARITY", "0.25"))
        if not 0 < threshold <= 1:
            raise ValueError("CLUSTER_SIMILARITY must be above 0 and at most 1")
        groups = group_articles(articles, threshold,
                                integer_env("CLUSTER_MIN_SHARED_WORDS", 3, 1, 20),
                                integer_env("CLUSTER_WINDOW_HOURS", 72, 1, 168))
        db.execute("UPDATE articles SET cluster_id=NULL")
        db.execute("DELETE FROM clusters")
        stamp = iso(utc_now())
        for group in groups:
            db.execute("INSERT INTO clusters(id,label,keywords,updated_at) VALUES (?,?,?,?)",
                       (group["id"], group["label"], json.dumps(group["keywords"]), stamp))
            for article_id in group["article_ids"]:
                db.execute("UPDATE articles SET cluster_id=? WHERE id=?", (group["id"], article_id))
        fallback_count = sum(a["extraction_status"] == "summary_only" for a in fresh)
        if fallback_count:
            warnings.append(f"Full text unavailable for {fallback_count} new articles; RSS summaries were kept.")
        result = {"new_articles": len(fresh), "skipped_duplicates": skipped,
                  "total_articles": len(articles), "total_clusters": len(groups),
                  "full_text_extracted": sum(a["extraction_status"] == "full_text" for a in fresh),
                  "sources": statuses, "warnings": warnings, "completed_at": stamp,
                  "data_mode": "demo" if demo else "live"}
        db.set_meta("data_mode", result["data_mode"])
        db.set_meta("last_ingest", json.dumps(result))
        db.connection.commit()
        emit("result", result=result)
        return result
    except Exception:
        db.connection.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect public RSS articles and group related headlines.")
    parser.add_argument("--demo", action="store_true", help="Load explicitly labeled fictional samples into an empty/sample database")
    args = parser.parse_args()
    try:
        run(demo=args.demo)
    except Exception as exc:
        emit("error", message=str(exc) if isinstance(exc, (ValueError, RuntimeError)) else "Pipeline failed. Check database configuration and server logs.")
        # Do not expose connection strings, credentials, or third-party response bodies.
        print(f"Pipeline failure: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
