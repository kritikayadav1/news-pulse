# API reference

Base URL locally: `http://localhost:3001` or `http://localhost:3001/api`.

## Read endpoints

`GET /timeline?hours=72&sources=bbc,guardian`

- `hours`: integer 1–2160. Default 72 for timelines and cluster lists; default 2160 for cluster details.
- `sources`: comma-separated `bbc`, `guardian`, `npr`. Omitted means all. Empty (`sources=`) means no sources.
- All timestamps use UTC ISO 8601. The frontend displays them in the viewer's local time zone.

Example shape (illustrative, not actual current data):

```json
{
  "clusters": [
    {
      "id": "topic_0123456789abcdef",
      "label": "Representative article headline",
      "keywords": ["lunar", "mission", "telescope"],
      "start": "2026-09-21T06:00:00.000Z",
      "end": "2026-09-21T09:00:00.000Z",
      "article_count": 3,
      "sources": ["bbc", "guardian"],
      "summary": "Short summary from the representative article",
      "image_url": null,
      "image_source": null,
      "intensity": 1,
      "duration_hours": 3
    }
  ],
  "meta": {
    "total_articles": 3,
    "total_clusters": 1,
    "source_count": 2,
    "hours": 72,
    "range_start": "2026-09-18T10:00:00.000Z",
    "range_end": "2026-09-21T10:00:00.000Z",
    "data_mode": "live",
    "last_ingest": null,
    "ingest_requires_token": false,
    "active_job_id": null
  }
}
```

`GET /clusters` returns the same cluster objects without timeline metadata. Cluster previews include `summary`, nullable `image_url`, and nullable `image_source` (a source ID). Images are selected from the filtered articles, preferring the representative article's image when available. Treat image URLs as optional; remote publishers can stop serving them.

`GET /clusters/:id` returns the label, keywords and an `articles` array sorted oldest first. Each article includes headline (`title`), source, URL, summary, nullable `image_url`, published timestamp, estimated-date flag and extraction status. Full extracted bodies stay in the database; the reader links to publishers for full articles.

Search, category selection, display sorting and the multiple-source toggle operate on the returned topic list in the browser. Source/time filters are applied by the API. Saved articles and theme preferences use browser storage and do not add server endpoints.

## Collection jobs

```sh
curl -X POST http://localhost:3001/ingest/trigger
```

Response `202`:

```json
{ "job_id": "a-returned-UUID", "status": "running" }
```

Poll `GET /ingest/status/<returned-job-id>` approximately every 1.5 seconds. Status is `running`, `completed` or `failed`. Progress is 0–100 and `message` explains the current step. A completed job includes a result with new article count, total counts, extraction count, warnings and per-source status. A failed job includes `error`.

If `INGEST_TOKEN` is configured, include `Authorization: Bearer <your-key>` on the POST. Never commit that key.

## Status codes

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| 200  | Successful read                                               |
| 202  | Collection accepted; poll returned job ID                     |
| 400  | Invalid source, time range, identifier or malformed JSON      |
| 401  | Missing/wrong refresh key when configured                     |
| 404  | Unknown cluster, job or route                                 |
| 409  | Another collection is running; response includes its `job_id` |
| 429  | Refresh cooldown; `Retry-After` header gives seconds          |
| 500  | Unexpected server failure; internal details stay off the API  |

A failure in the background job appears in job status; it does not retroactively change the already returned 202 response.
