"""Synthetic fixtures. Never passed off as current news."""
import hashlib
from datetime import timedelta
from scraper.ingestion import iso, utc_now


def sample_articles():
    topics = [
        ("Lunar research mission prepares for launch", "Lunar research mission scientists prepare spacecraft launch orbit telescope", 1),
        ("Coastal cities expand flood protection plans", "Coastal cities flood protection infrastructure rising water drainage resilience", 3),
        ("New battery recycling plant opens", "Battery recycling plant opens materials lithium recovery circular industry", 5),
        ("Global health researchers share vaccine findings", "Health researchers vaccine findings trial immunity study clinical results", 8),
        ("National parks begin wildlife restoration project", "National parks wildlife restoration project conservation habitat animal survey", 11),
        ("University teams demonstrate accessible robotics", "University teams accessible robotics assistive technology prototype students", 14),
        ("Regional rail network adds electric trains", "Regional rail network electric trains transport commuters stations expansion", 17),
        ("Ocean monitoring network expands sensor coverage", "Ocean monitoring network sensor coverage marine temperature research data", 20),
    ]
    articles = []
    now = utc_now()
    for index, (headline, summary, hours) in enumerate(topics):
        for number in range(2 + index % 3):
            url = f"https://example.com/news-pulse-sample/{index}/{number}"
            articles.append({"id": hashlib.sha256(url.encode()).hexdigest()[:32], "url": url,
                "title": headline if number == 0 else headline + ["", ": progress update", ": what happens next", ": latest details"][number],
                "summary": summary + ". This is fictional sample content for testing the interface.",
                "content": summary, "source_id": ["bbc", "guardian", "npr"][number % 3],
                "published_at": iso(now - timedelta(hours=hours + number * 1.4)),
                "date_estimated": 0, "fetched_at": iso(now), "extraction_status": "sample"})
    return articles
