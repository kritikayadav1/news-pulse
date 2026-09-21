"""Explainable keyword overlap, without an ML model or paid API."""
import hashlib
import re
from collections import Counter
from datetime import datetime

STOP_WORDS = set("""a an the and or but if then than that this these those it its is are was were be been being
to of in on for from by with at as into about over after before during under between through
he she they them their his her we us our you your i my who whom which what when where why how
not no yes do does did done have has had can could will would should may might must also just
more most much many some any each all both other another such very too only out up down off
now new latest news live says said say told report reports reported according watch video
bbc guardian npr world first last today yesterday tomorrow monday tuesday wednesday thursday
friday saturday sunday january february march april june july august september october november december
one two three four five get gets got take takes taken amid still back make makes made like
use used using across around people year years day days week weeks month months percent
""".split())


def keywords(text):
    # Exact words are intentional: simple enough to explain and inspect in a demo.
    words = re.findall(r"[a-z][a-z0-9]+", text.lower())
    return {word for word in words if len(word) > 2 and word not in STOP_WORDS}


def article_words(article):
    # Limit summary contribution so long summaries do not dominate the comparison.
    return keywords(article["title"] + " " + " ".join(article.get("summary", "").split()[:60]))


def group_articles(articles, threshold=0.25, min_shared=3, window_hours=72):
    groups = []
    for article in sorted(articles, key=lambda a: (a["published_at"], a["id"])):
        words = article_words(article)
        title_words = keywords(article["title"])
        timestamp = datetime.fromisoformat(article["published_at"].replace("Z", "+00:00")).timestamp()
        best_group, best_score = None, -1
        for group in groups:
            # Compare with a fixed anchor, not an ever-growing bag of all topic words.
            # This prevents A~B and B~C from merging unrelated A and C by chaining.
            if timestamp - group["start"] > window_hours * 3600:
                continue
            shared = words & group["anchor_words"]
            union = words | group["anchor_words"]
            text_score = len(shared) / len(union) if union else 0
            title_union = title_words | group["anchor_title"]
            title_score = len(title_words & group["anchor_title"]) / len(title_union) if title_union else 0
            # Matching headlines should not be diluted by differently worded summaries.
            score = max(text_score, title_score)
            if (len(shared) >= min_shared and score >= threshold
                    and title_words & group["anchor_title"] and score > best_score):
                best_group, best_score = group, score
        if best_group is None:
            groups.append({"anchor_words": words, "anchor_title": title_words,
                           "start": timestamp, "articles": [article]})
        else:
            best_group["articles"].append(article)

    result = []
    for group in groups:
        members = group["articles"]
        counts = Counter(word for a in members for word in sorted(article_words(a)))
        terms = [word for word, _ in counts.most_common(5)]
        # A real representative headline is more readable than a string of keywords.
        representative = max(members, key=lambda a: sum(counts[w] for w in keywords(a["title"])) / max(1, len(keywords(a["title"]))))
        cluster_id = "topic_" + hashlib.sha256(members[0]["id"].encode()).hexdigest()[:16]
        result.append({"id": cluster_id, "label": representative["title"],
                       "keywords": terms, "article_ids": [a["id"] for a in members]})
    return result
