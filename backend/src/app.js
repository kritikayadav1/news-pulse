import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { root } from "../../scripts/paths.mjs";
import { createJobManager } from "./jobs.js";

export const sources = JSON.parse(
  fs.readFileSync(path.join(root, "shared/sources.json"), "utf8"),
);
const sourceMap = new Map(sources.map((s) => [s.id, s]));

function bad(message) {
  return Object.assign(new Error(message), { status: 400 });
}
function filters(query) {
  const hours = query.hours === undefined ? 72 : Number(query.hours);
  if (
    !Number.isFinite(hours) ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 2160
  )
    throw bad("hours must be an integer from 1 to 2160.");
  if (query.sources !== undefined && typeof query.sources !== "string")
    throw bad("sources must be comma-separated source IDs.");
  const selected =
    query.sources === undefined
      ? sources.map((s) => s.id)
      : [...new Set(query.sources.split(",").filter(Boolean))];
  if (selected.some((id) => !sourceMap.has(id)))
    throw bad("Unknown source. Use bbc, guardian or npr.");
  return {
    selected,
    hours,
    since: new Date(Date.now() - hours * 3600000).toISOString(),
  };
}

async function selectedArticles(db, filter, clusterId = null) {
  if (!filter.selected.length) return [];
  const params = [filter.since, ...filter.selected];
  let sql = `SELECT a.id,a.url,a.title,a.source_id,a.summary,a.image_url,a.published_at,a.date_estimated,
    a.extraction_status,a.cluster_id,c.label,c.keywords FROM articles a
    JOIN clusters c ON c.id=a.cluster_id WHERE a.published_at>=?
    AND a.source_id IN (${filter.selected.map(() => "?").join(",")})`;
  if (clusterId) {
    sql += " AND a.cluster_id=?";
    params.push(clusterId);
  }
  return db.query(sql + " ORDER BY a.published_at ASC,a.id ASC", params);
}

function collectClusters(articles) {
  const groups = new Map();
  for (const a of articles) {
    if (!groups.has(a.cluster_id))
      groups.set(a.cluster_id, {
        id: a.cluster_id,
        label: a.label,
        keywords: JSON.parse(a.keywords),
        start: a.published_at,
        end: a.published_at,
        article_count: 0,
        sources: [],
        image_url: null,
        image_source: null,
        summary: a.summary,
      });
    const group = groups.get(a.cluster_id);
    group.article_count += 1;
    group.end = a.published_at;
    if (a.image_url && (!group.image_url || a.title === group.label)) {
      group.image_url = a.image_url;
      group.image_source = a.source_id;
    }
    if (a.title === group.label) group.summary = a.summary;
    if (!group.sources.includes(a.source_id)) group.sources.push(a.source_id);
  }
  const clusters = [...groups.values()].sort((a, b) =>
    b.end.localeCompare(a.end),
  );
  const maxCount = Math.max(1, ...clusters.map((c) => c.article_count));
  return clusters.map((c) => ({
    ...c,
    intensity: c.article_count / maxCount,
    duration_hours: (Date.parse(c.end) - Date.parse(c.start)) / 3600000,
  }));
}

export function createApp(db, options = {}) {
  const app = express();
  const jobs = createJobManager(db, options.pipelineScript);
  app.disable("x-powered-by");
  const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, !origin || origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "10kb" }));
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  const api = express.Router();
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  api.get("/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok", service: "News Pulse API" });
  });
  api.get("/sources", (req, res) =>
    res.json(sources.map(({ domains, ...s }) => s)),
  );
  api.get("/timeline", async (req, res) => {
    const filter = filters(req.query);
    const articles = await selectedArticles(db, filter);
    const clusters = collectClusters(articles);
    const metaRows = await db.query("SELECT key,value FROM app_meta");
    const meta = Object.fromEntries(
      metaRows.map((row) => [row.key, row.value]),
    );
    const lastIngest = meta.last_ingest ? JSON.parse(meta.last_ingest) : null;
    const [activeJob] = await db.query(
      "SELECT id FROM ingest_jobs WHERE status='running' ORDER BY created_at DESC LIMIT 1",
    );
    res.json({
      clusters,
      meta: {
        total_articles: articles.length,
        total_clusters: clusters.length,
        source_count: new Set(articles.map((a) => a.source_id)).size,
        hours: filter.hours,
        range_start: filter.since,
        range_end: new Date().toISOString(),
        last_ingest: lastIngest,
        data_mode: meta.data_mode || "empty",
        ingest_requires_token: Boolean(process.env.INGEST_TOKEN),
        active_job_id: activeJob?.id || null,
      },
    });
  });
  api.get("/clusters", async (req, res) => {
    res.json({
      clusters: collectClusters(await selectedArticles(db, filters(req.query))),
    });
  });
  api.get("/clusters/:id", async (req, res) => {
    if (!/^topic_[a-f0-9]{16}$/.test(req.params.id))
      throw bad("Invalid cluster ID.");
    const [cluster] = await db.query("SELECT * FROM clusters WHERE id=?", [
      req.params.id,
    ]);
    if (!cluster)
      return res
        .status(404)
        .json({ error: "Cluster not found. Refresh the timeline." });
    const articles = await selectedArticles(
      db,
      filters({ ...req.query, hours: req.query.hours ?? 2160 }),
      req.params.id,
    );
    res.json({
      id: cluster.id,
      label: cluster.label,
      keywords: JSON.parse(cluster.keywords),
      articles: articles.map(({ label, keywords, ...a }) => ({
        ...a,
        date_estimated: Boolean(a.date_estimated),
        source: sourceMap.get(a.source_id)?.name || a.source_id,
      })),
    });
  });
  api.post("/ingest/trigger", async (req, res) => {
    if (process.env.INGEST_TOKEN) {
      const actual = Buffer.from(
        String(req.get("Authorization") || "").replace(/^Bearer /, ""),
      );
      const expected = Buffer.from(process.env.INGEST_TOKEN);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        return res.status(401).json({ error: "A refresh key is required." });
    }
    const job = await jobs.start();
    if (job.conflict)
      return res.status(409).json({
        error: "News collection is already running.",
        job_id: job.job_id,
      });
    if (job.cooldown)
      return res
        .set("Retry-After", String(job.retry_after))
        .status(429)
        .json({
          error: `Please wait ${job.retry_after} seconds before refreshing again.`,
        });
    res.status(202).json(job);
  });
  api.get("/ingest/status/:jobId", async (req, res) => {
    if (!/^[a-f0-9-]{36}$/.test(req.params.jobId)) throw bad("Invalid job ID.");
    const job = await jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });
    res.json(job);
  });
  // Root routes match the assessment; /api makes frontend proxies/deployment convenient.
  app.use("/api", api);
  app.use("/", api);
  const buildDir = path.join(root, "frontend/dist");
  if (fs.existsSync(buildDir)) {
    app.use(express.static(buildDir));
    app.get("/", (req, res) => res.sendFile(path.join(buildDir, "index.html")));
  }
  app.use((req, res) => res.status(404).json({ error: "Route not found." }));
  app.use((error, req, res, next) => {
    const status = error.status === 400 ? 400 : 500;
    if (status === 500)
      console.error("Request failed:", error.code || error.name);
    res.status(status).json({
      error: status === 400 ? error.message : "Server error. Please try again.",
    });
  });
  return { app, jobs };
}
