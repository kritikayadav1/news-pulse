CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  keywords TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  date_estimated INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL,
  extraction_status TEXT NOT NULL,
  cluster_id TEXT REFERENCES clusters(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS articles_cluster_idx ON articles(cluster_id, published_at);
CREATE INDEX IF NOT EXISTS articles_source_time_idx ON articles(source_id, published_at);
CREATE TABLE IF NOT EXISTS ingest_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  result_json TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS ingest_jobs_created_idx ON ingest_jobs(created_at);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
