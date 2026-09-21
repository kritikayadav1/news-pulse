import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { root, pythonPath } from "../../scripts/paths.mjs";

export function createJobManager(db, pipelineScript = "scraper/main.py") {
  let active = null;
  let starting = false;
  const cooldown = Math.max(
    0,
    Number(process.env.INGEST_COOLDOWN_SECONDS || 60),
  );

  async function get(id) {
    const [job] = await db.query("SELECT * FROM ingest_jobs WHERE id=?", [id]);
    if (!job) return null;
    const { result_json, ...data } = job;
    return { ...data, result: result_json ? JSON.parse(result_json) : null };
  }

  async function start() {
    if (active || starting)
      return { conflict: true, job_id: active?.id || null };
    starting = true;
    try {
      const [latest] = await db.query(
        "SELECT created_at FROM ingest_jobs ORDER BY created_at DESC LIMIT 1",
      );
      const retry = latest
        ? Math.ceil(
            cooldown - (Date.now() - Date.parse(latest.created_at)) / 1000,
          )
        : 0;
      if (retry > 0) return { cooldown: true, retry_after: retry };
      const id = randomUUID();
      await db.query(
        "INSERT INTO ingest_jobs(id,status,created_at,progress,message) VALUES (?,?,?,?,?)",
        [
          id,
          "running",
          new Date().toISOString(),
          0,
          "Starting news collection",
        ],
      );
      const child = spawn(pythonPath(), ["-u", pipelineScript], {
        cwd: root,
        env: process.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      active = { id, child };
      let result = null,
        errorMessage = null,
        finished = false;
      let pendingWrites = Promise.resolve();
      let lastWrite = 0;
      const timer = setTimeout(
        () => {
          errorMessage =
            "Collection timed out. Existing data was kept; retry with fewer articles per feed.";
          child.kill("SIGTERM");
        },
        8 * 60 * 1000,
      );
      const lines = readline.createInterface({ input: child.stdout });
      lines.on("line", (line) => {
        if (line.length > 50000) return;
        try {
          const data = JSON.parse(line);
          if (data.event === "result") result = data.result;
          if (data.event === "error") errorMessage = data.message;
          if (data.event === "progress" && Date.now() - lastWrite > 200) {
            lastWrite = Date.now();
            pendingWrites = pendingWrites.then(() =>
              db.query(
                "UPDATE ingest_jobs SET progress=?,message=? WHERE id=?",
                [
                  Math.min(95, Math.max(0, Number(data.progress) || 0)),
                  String(data.message).slice(0, 200),
                  id,
                ],
              ),
            );
          }
        } catch {
          /* Non-JSON library output is not a progress event. */
        }
      });
      child.stderr.on("data", () => {
        /* Keep third-party diagnostics out of the public API. */
      });
      async function finish(code) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        lines.close();
        try {
          await pendingWrites;
          const success = code === 0 && result;
          await db.query(
            "UPDATE ingest_jobs SET status=?,finished_at=?,progress=?,message=?,result_json=?,error=? WHERE id=?",
            [
              success ? "completed" : "failed",
              new Date().toISOString(),
              success ? 100 : 0,
              success ? "News updated" : "Collection failed",
              result ? JSON.stringify(result) : null,
              success
                ? null
                : errorMessage ||
                  "Collection failed. Run npm run setup and check the server configuration.",
              id,
            ],
          );
          await db.query("DELETE FROM ingest_jobs WHERE created_at < ?", [
            new Date(Date.now() - 7 * 86400000).toISOString(),
          ]);
        } catch (error) {
          console.error("Could not save job status:", error.name);
        } finally {
          active = null;
        }
      }
      child.once("error", () => {
        errorMessage =
          "Python could not start. Run npm run setup, or configure PYTHON_BIN.";
        void finish(1);
      });
      child.once("close", (code) => {
        void finish(code);
      });
      return { job_id: id, status: "running" };
    } finally {
      starting = false;
    }
  }

  return { get, start, stop: () => active?.child.kill("SIGTERM") };
}
