# 2–3 minute walkthrough guide

Record your own screen and voice. Use a working live deployment with **real current news**. Understand and adapt this outline; it must match what you actually built, tested and experienced. An unlisted Loom/video link is acceptable according to the assessment.

## 0:00–0:40 — Live demo

Suggested wording:

“Hi, I'm Kritika. This is News Pulse. It collects news from BBC News, The Guardian and NPR. The homepage shows featured stories and publisher photos. Opening a story takes me to its topic timeline. Each bar spans the earliest to latest article. Compare sources shows each newsroom's coverage side by side. I can filter sources, save articles for later and switch to dark mode.”

On screen: start on Headlines, open a topic with multiple sources, open/close Compare sources, bookmark one article and toggle the theme. Show the real URL in the address bar. Collect news before recording; briefly show refresh progress only if time allows.

## 0:40–1:30 — Explain the grouping

Open `scraper/grouping.py` and point to `keywords()` and `group_articles()`.

“I used keyword overlap. The code removes common words and compares the meaningful words in the headline and summary. An article joins a group if it shares at least three words, has a Jaccard score of at least 0.25, shares a headline word and falls within a 72-hour window. Jaccard means shared words divided by all unique words. I compare with a fixed anchor article to avoid unrelated stories joining through a chain of weak matches.”

Be ready to explain why these starting thresholds can need adjustment and why paraphrases may be missed.

## 1:30–2:15 — One actual challenge

Choose a problem you actually observed during your run. Examples to investigate:

- A feed missing a valid timestamp, and how you mark the collection-time fallback.
- A publisher blocking extraction, and how you preserve RSS summaries.
- Duplicate URLs with tracking parameters, and why a unique canonical URL helps.
- Related topics merging too broadly, and how the anchor/threshold rules limit drift.

Explain what you saw, the code change or design handling it, and how you checked the result. Do not claim a debugging experience you did not have.

## 2:15–2:40 — What you would improve

“With more time, I would evaluate grouping on a labeled set of articles and improve how it handles paraphrases. For a larger deployment I would also move background jobs into a shared queue so multiple servers can coordinate safely.”

## Before sharing

- Hide `.env`, database URLs, passwords and other personal browser tabs.
- Confirm the recording is 2–3 minutes, audio is clear and code is readable.
- Verify the video link is viewable by the reviewer without requesting access.
- Keep the AI assistance disclosure accurate if asked; assistance is allowed, but understanding must be yours.
