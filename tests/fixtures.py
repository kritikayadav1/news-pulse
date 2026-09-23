from datetime import timedelta
from scraper.ingestion import iso, utc_now


def entries_for(source, timeout=12):
    return [{"title": "Lunar mission scientists launch orbital research telescope",
             "summary": "Lunar mission scientists launch orbital research telescope to study moon geology.",
             "link": source["home"] + "/test-fixture-orbital-telescope",
             "published": iso(utc_now() - timedelta(hours=1))},
            {"title": "River flood barriers protect coastal communities",
             "summary": "River flood barriers protect coastal communities from rising water.",
             "link": source["home"] + "/test-fixture-flood-barrier",
             "published": iso(utc_now() - timedelta(hours=3))}]


def extracted(article, source, timeout=12):
    return {**article, "content": article["summary"], "extraction_status": "full_text"}
