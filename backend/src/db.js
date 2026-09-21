import fs from "node:fs";
import path from "node:path";
import { root } from "../../scripts/paths.mjs";

export async function openDatabase() {
  let query, close;
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (error) =>
      console.error("Database connection error:", error.code || error.name),
    );
    query = async (sql, values = []) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    };
    close = () => pool.end();
  } else {
    const { DatabaseSync } = await import("node:sqlite");
    const dbPath = path.resolve(root, process.env.DB_PATH || "data/news.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;",
    );
    query = async (sql, values = []) => {
      const statement = db.prepare(sql);
      return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)
        ? statement.all(...values)
        : (statement.run(...values), []);
    };
    close = async () => db.close();
  }
  for (const sql of fs
    .readFileSync(path.join(root, "shared/schema.sql"), "utf8")
    .split(";")) {
    if (sql.trim()) await query(sql);
  }
  if (process.env.DATABASE_URL) {
    await query("ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT");
  } else {
    const columns = await query("PRAGMA table_info(articles)");
    if (!columns.some((column) => column.name === "image_url"))
      await query("ALTER TABLE articles ADD COLUMN image_url TEXT");
  }
  return { query, close };
}
