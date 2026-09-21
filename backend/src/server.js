import dotenv from "dotenv";
import path from "node:path";
import { root } from "../../scripts/paths.mjs";
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const { openDatabase } = await import("./db.js");
const { createApp } = await import("./app.js");
try {
  const db = await openDatabase();
  await db.query(
    "UPDATE ingest_jobs SET status='failed',finished_at=?,error=?,message=? WHERE status='running'",
    [
      new Date().toISOString(),
      "The server restarted during collection. Please refresh again.",
      "Collection interrupted",
    ],
  );
  const { app, jobs } = createApp(db);
  const port = Number(process.env.PORT || 3001);
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`News Pulse is running at http://localhost:${port}`);
    if (process.env.AUTO_INGEST === "true")
      jobs
        .start()
        .catch((e) =>
          console.error("Initial collection could not start:", e.name),
        );
  });
  server.on("error", (error) => {
    console.error("Server could not start:", error.code);
    process.exitCode = 1;
  });
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    jobs.stop();
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch (error) {
  console.error(
    "Startup failed. Check DATABASE_URL/DB_PATH and installed dependencies. Error type:",
    error.code || error.name,
  );
  process.exitCode = 1;
}
