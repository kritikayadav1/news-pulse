# Verification of this delivery

Validated with Node.js 24.19.0 and Python 3.12.14 in a Linux workspace.

## Passed

- JavaScript dependencies installed from the included package manifests; npm lockfile included.
- Python requirements installed successfully.
- Production React/Vite build succeeded.
- **15 Python tests** passed: feed normalization, date fallback, canonical URLs, untrusted URL rejection, full-text fallback, repeat-run deduplication, coherent grouping, partial/total feed failures, transaction rollback, headline/summary similarity, approved publisher image hosts, Open Graph images, image backfill and legacy SQLite schema upgrades.
- **2 Node tests** passed: real Python subprocess with controlled feed inputs, persistent job status, API errors, token protection, concurrency/cooldown, filtered timelines, image preview fields, chronological details and a legacy SQLite upgrade.
- Live collection on September 21, 2026 fetched **40 real articles** across BBC News (15), The Guardian (15) and NPR (10). All 40 yielded extracted body text in that run.
- A second real collection skipped **39 existing URLs** and added **1 new article**, giving 41 total retained articles without duplicated rows. Feed contents changed between runs; totals are observations, not expected constants.
- The UI upgrade was checked with another live collection on September 22, 2026: **28 new articles**, **12 skipped URLs**, **69 retained articles**, and **63 topic clusters**. All 28 new articles yielded extracted text in that run. Thirty retained articles had publisher image URLs.
- Chromium checks passed at **1440px desktop** and **390px mobile** widths: photo-led homepage, featured-story navigation, search/reset, multiple-source filter, comparison dialog and Escape close, saved articles across reloads, persistent dark mode, topic selection, loading more topics, turning all sources off, single-source details, time-range changes and no page-level horizontal overflow.
- Actual publisher images were downloaded with certificate verification and cached for deterministic browser rendering. Browser checks used those cached bytes and a fallback system font; they do not establish that every user's network will load every publisher image or Google Font.
- Browser refresh-button progress, completion and timeline reload were exercised with controlled API responses. Real Node-to-Python job execution was tested separately by the integration test.
- Final September 23 checks also covered category filtering, scrollable mobile category spacing, and a 429 cooldown countdown that keeps an earlier collection error visible and re-enables Refresh after expiry.
- No browser runtime errors occurred in those checks. A 200% base-text-size check also passed page-width checks; the timeline's date-axis height scales with text.
- The optional commit helper was checked for exactly 30 commits, author/committer timestamps, 2–4 day date gaps, complete final source bytes, exclusion of local data, safe reruns and resuming an interrupted run. No test repository was pushed.

## Still requires the candidate's environment/accounts

- The Docker configuration was prepared but not built here: no Docker daemon was available.
- The PostgreSQL adapter and hosting configuration were prepared but were not end-to-end tested against a hosted database.
- Windows setup scripts are supplied; direct execution was verified on Linux, not a Windows machine.
- No GitHub repository was created or uploaded, and no public deployment URL was provisioned.
- No candidate video has been recorded. `VIDEO_SCRIPT.md` is an outline for the required personal walkthrough.

The package contains source and guides, not a submission that is already published. Follow `DEPLOYMENT.md`, verify the live URL and record the walkthrough before submitting.
