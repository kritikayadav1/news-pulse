"""Normalize imperfect feeds and fetch article bodies with bounded, safe requests."""
import calendar
import hashlib
import time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode, urljoin

import feedparser
import requests
import trafilatura
from bs4 import BeautifulSoup


def utc_now():
    return datetime.now(timezone.utc)


def iso(date):
    return date.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def plain_text(value):
    soup = BeautifulSoup(str(value or ""), "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())


def canonical_url(value):
    try:
        parsed = urlsplit(value.strip())
        if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.port not in (None, 80, 443):
            return None
        query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
                 if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid", "cmp", "cmpid", "ocid"}]
        return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", urlencode(sorted(query)), ""))
    except (ValueError, AttributeError):
        return None


def allowed_url(url, source):
    canonical = canonical_url(url)
    if not canonical:
        return False
    host = urlsplit(canonical).hostname
    return any(host == domain or host.endswith("." + domain) for domain in source["domains"])


def allowed_image(value, source, base=""):
    try:
        url = urljoin(base, str(value or "").strip())
        parsed = urlsplit(url)
        domains = source.get("image_domains", source["domains"])
        if len(url) > 4096 or parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
            return None
        if parsed.hostname and any(parsed.hostname == domain or parsed.hostname.endswith("." + domain) for domain in domains):
            return url
    except (ValueError, TypeError):
        pass
    return None


def feed_image(entry, source):
    candidates = []
    for key in ("media_content", "media_thumbnail"):
        candidates.extend(item.get("url") for item in (entry.get(key) or []) if isinstance(item, dict))
    candidates.extend(item.get("href") or item.get("url") for item in (entry.get("links") or [])
                      if isinstance(item, dict) and str(item.get("type", "")).startswith("image/"))
    html = entry.get("summary") or entry.get("description") or ""
    candidates.extend(tag.get("src") for tag in BeautifulSoup(str(html), "html.parser").find_all("img", limit=5))
    for candidate in candidates:
        image = allowed_image(candidate, source, entry.get("link", ""))
        if image:
            return image
    return None


def download(url, source, timeout=12):
    # A remote feed never gets to direct our server to arbitrary/private URLs.
    deadline = time.monotonic() + timeout * 2
    for _ in range(6):
        if not allowed_url(url, source):
            raise ValueError("URL outside this source's allowed domains")
        with requests.get(url, timeout=(timeout, timeout), stream=True, allow_redirects=False,
                          headers={"User-Agent": "NewsPulse/1.0 (educational RSS reader)", "Accept": "application/rss+xml, application/atom+xml, text/html, */*"}) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers.get("Location", ""))
                continue
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_content(64 * 1024):
                size += len(chunk)
                if size > 4 * 1024 * 1024 or time.monotonic() > deadline:
                    raise ValueError("Download exceeded size/time limit")
                chunks.append(chunk)
            return b"".join(chunks)
    raise ValueError("Too many redirects")


def published_date(entry, now):
    for key in ("published_parsed", "updated_parsed", "created_parsed"):
        value = entry.get(key)
        if value:
            try:
                date = datetime.fromtimestamp(calendar.timegm(value), timezone.utc)
                if date <= now + timedelta(hours=6):
                    return iso(date), 0
            except (ValueError, OverflowError, TypeError):
                pass
    for key in ("published", "updated", "created", "date"):
        value = entry.get(key)
        if not value:
            continue
        for parser in (parsedate_to_datetime, lambda x: datetime.fromisoformat(x.replace("Z", "+00:00"))):
            try:
                date = parser(str(value))
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone.utc)
                if date <= now + timedelta(hours=6):
                    return iso(date), 0
            except (TypeError, ValueError, OverflowError):
                continue
    # Missing or implausible publication date: expose that it is an estimate.
    return iso(now), 1


def normalize_entry(entry, source, now=None):
    now = now or utc_now()
    url = canonical_url(entry.get("link", ""))
    title = plain_text(entry.get("title", ""))[:500]
    if not url or not title or not allowed_url(url, source):
        return None
    content_parts = entry.get("content") or []
    summary = entry.get("summary") or entry.get("description") or (content_parts[0].get("value") if content_parts else "")
    date, estimated = published_date(entry, now)
    return {"id": hashlib.sha256(url.encode()).hexdigest()[:32], "url": url, "title": title,
            "source_id": source["id"], "summary": plain_text(summary)[:2500], "image_url": feed_image(entry, source), "content": "",
            "published_at": date, "date_estimated": estimated, "fetched_at": iso(now),
            "extraction_status": "summary_only"}


def read_feed(source, timeout=12):
    parsed = feedparser.parse(download(source["feed"], source, timeout))
    if not parsed.entries:
        raise ValueError("Feed returned no readable entries")
    return parsed.entries


def extract_body(article, source, timeout=12):
    try:
        html = download(article["url"], source, timeout)
        image_meta = BeautifulSoup(html, "html.parser").find("meta", attrs={"property": "og:image"})
        if image_meta:
            article["image_url"] = allowed_image(image_meta.get("content"), source, article["url"]) or article.get("image_url")
        content = trafilatura.extract(html, url=article["url"], include_comments=False,
                                     include_tables=False, favor_precision=True)
        if content and len(content.strip()) >= 100:
            article["content"] = content.strip()[:80000]
            article["extraction_status"] = "full_text"
        else:
            article["content"] = article["summary"]
    except (requests.RequestException, ValueError, TypeError, UnicodeError):
        article["content"] = article["summary"]
    return article
