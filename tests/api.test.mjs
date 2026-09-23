import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { openDatabase } from "../backend/src/db.js";
import { createApp } from "../backend/src/app.js";

test("API and Python subprocess work together with persistent jobs and filtered timelines", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "news-pulse-api-"));
  const oldEnv = { ...process.env };
  process.env.DATABASE_URL = "";
  process.env.DB_PATH = path.join(dir, "test.db");
  process.env.INGEST_COOLDOWN_SECONDS = "60";
  process.env.INGEST_TOKEN = "test-key-only";
  const db = await openDatabase();
  const { app, jobs } = createApp(db, {
    pipelineScript: "tests/fixture_pipeline.py",
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    jobs.stop();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    process.env = oldEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const get = async (url) => {
    const r = await fetch(base + url);
    return { status: r.status, data: await r.json() };
  };
  assert.equal((await get("/health")).status, 200);
  assert.equal((await get("/api/timeline")).data.clusters.length, 0);
  assert.equal((await get("/timeline?hours=bad")).status, 400);
  assert.equal((await get("/timeline?sources=unknown")).status, 400);
  assert.equal((await get("/clusters/bad-id")).status, 400);
  assert.equal((await get("/clusters/topic_0000000000000000")).status, 404);
  const denied = await fetch(base + "/ingest/trigger", { method: "POST" });
  assert.equal(denied.status, 401);
  const options = {
    method: "POST",
    headers: { Authorization: "Bearer test-key-only" },
  };
  const trigger = await fetch(base + "/ingest/trigger", options);
  assert.equal(trigger.status, 202);
  const { job_id } = await trigger.json();
  assert.equal((await fetch(base + "/ingest/trigger", options)).status, 409);
  let job;
  for (let i = 0; i < 160; i++) {
    job = (await get(`/ingest/status/${job_id}`)).data;
    if (job.status !== "running") break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(job.status, "completed", JSON.stringify(job));
  assert.equal(job.progress, 100);
  assert.equal(job.result.total_articles, 6);
  const timeline = (await get("/timeline")).data;
  assert.equal(timeline.clusters.length, 2);
  assert.equal(timeline.meta.total_articles, 6);
  assert.equal(timeline.clusters[0].article_count, 3);
  const filtered = (await get("/timeline?sources=bbc")).data;
  assert.equal(filtered.meta.total_articles, 2);
  assert.equal(filtered.clusters[0].article_count, 1);
  assert.deepEqual(filtered.clusters[0].sources, ["bbc"]);
  const image = "https://ichef.bbci.co.uk/news/1024/test.jpg";
  await db.query("UPDATE articles SET image_url=? WHERE source_id='bbc'", [image]);
  const photographed = (await get("/timeline?sources=bbc")).data;
  assert.equal(photographed.clusters[0].image_url, image);
  assert.equal(photographed.clusters[0].image_source, "bbc");
  assert.equal(typeof photographed.clusters[0].summary, "string");
  assert.equal((await get("/timeline?sources=")).data.meta.total_articles, 0);
  const detail = (await get(`/clusters/${timeline.clusters[0].id}`)).data;
  assert.equal(detail.articles.length, 3);
  assert.deepEqual(
    detail.articles.map((a) => a.published_at),
    detail.articles.map((a) => a.published_at).sort(),
  );
  assert.equal(
    (await get(`/clusters/${timeline.clusters[0].id}?sources=npr`)).data
      .articles.length,
    1,
  );
  assert.equal((await fetch(base + "/ingest/trigger", options)).status, 429);
  assert.equal(
    (await get(`/api/ingest/status/${job_id}`)).data.result.total_clusters,
    2,
  );
});

test("Node upgrades a legacy SQLite schema without removing stored metadata", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "news-pulse-upgrade-"));
  const oldEnv = { ...process.env };
  process.env.DATABASE_URL = "";
  process.env.DB_PATH = path.join(dir, "legacy.db");
  const { DatabaseSync } = await import("node:sqlite");
  const legacy = new DatabaseSync(process.env.DB_PATH);
  legacy.exec(fs.readFileSync(new URL("../shared/schema.sql", import.meta.url), "utf8").replace("  image_url TEXT,\n", ""));
  legacy.exec("INSERT INTO app_meta(key,value) VALUES ('upgrade_test','kept')");
  legacy.close();
  let db;
  try {
    db = await openDatabase();
    assert.ok((await db.query("PRAGMA table_info(articles)")).some((column) => column.name === "image_url"));
    assert.equal((await db.query("SELECT value FROM app_meta WHERE key='upgrade_test'"))[0].value, "kept");
  } finally {
    if (db) await db.close();
    process.env = oldEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
