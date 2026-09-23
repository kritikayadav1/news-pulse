# Assessment coverage

| Requirement                               | Implementation                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| At least three news RSS feeds             | BBC, The Guardian, NPR in `shared/sources.json`                                         |
| Inconsistent fields/dates                 | Feedparser, summary fallback, UTC normalization, estimated-date flag                    |
| Fetch full article text                   | `trafilatura` extraction for each new article, summary fallback on failure              |
| Avoid repeated-run duplicates             | Canonical URL, unique database constraint, skip existing URLs                           |
| Re-runnable pipeline                      | `npm run ingest` or refresh API; incremental article fetch                              |
| Topic clusters with labels and timestamps | Anchor-based keyword overlap; cluster membership and article dates in database          |
| Explain thresholds and limitation         | README grouping section                                                                 |
| Five required endpoints                   | `backend/src/app.js`, at both root and `/api`                                           |
| Async trigger and job polling             | `backend/src/jobs.js`, persisted job status                                             |
| Environment configuration                 | `.env.example`, shared by Python and Node                                               |
| Database shared by both languages         | SQLite locally; PostgreSQL adapter for hosting                                          |
| Actual timeline visualization             | Time-axis interval bars/point markers in React                                          |
| Cluster detail view                       | Chronological articles, source, timestamp, original link                                |
| Source filter                             | Server-side filtered counts, dates, details                                             |
| Refresh button                            | Triggers collection, polls, reloads data                                                |
| Photo-led news homepage                   | Publisher RSS/Open Graph images, featured stories, cards and coverage-ranked trending   |
| Reader tools                              | Search, category rules, source comparison, browser bookmarks and light/dark mode        |
| Live deployment                           | Dockerfile, Render blueprint and guide prepared; user account deployment still required |
| 2–3 minute video                          | Outline supplied; candidate recording still required                                    |
| GitHub repository                         | Clean source package and instructions; upload to candidate's account still required     |

Optional auto-refresh scheduling and semantic cross-source event merging are not implemented. Visual cluster emphasis uses the article count. Separate source articles remain separate records even when grouped into one topic.
