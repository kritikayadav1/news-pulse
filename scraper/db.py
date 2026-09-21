"""One schema shared by Python and Node; SQLite locally, PostgreSQL when configured."""
import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Database:
    def __init__(self):
        self.postgres = bool(os.getenv("DATABASE_URL"))
        if self.postgres:
            import psycopg
            from psycopg.rows import dict_row
            self.connection = psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)
        else:
            file = Path(os.getenv("DB_PATH", "data/news.db"))
            file = file if file.is_absolute() else ROOT / file
            file.parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(file, timeout=30)
            self.connection.row_factory = sqlite3.Row
            self.connection.execute("PRAGMA journal_mode=WAL")
            self.connection.execute("PRAGMA foreign_keys=ON")
        for statement in (ROOT / "shared/schema.sql").read_text().split(";"):
            if statement.strip():
                self.execute(statement)
        # Keep older local databases usable when upgrading the reader.
        if self.postgres:
            self.execute("ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT")
        elif "image_url" not in {row["name"] for row in self.all("PRAGMA table_info(articles)")}:
            self.execute("ALTER TABLE articles ADD COLUMN image_url TEXT")
        self.connection.commit()

    def execute(self, sql, values=()):
        return self.connection.execute(sql.replace("?", "%s") if self.postgres else sql, values)

    def all(self, sql, values=()):
        return [dict(row) for row in self.execute(sql, values).fetchall()]

    def meta(self, key):
        rows = self.all("SELECT value FROM app_meta WHERE key = ?", (key,))
        return rows[0]["value"] if rows else None

    def set_meta(self, key, value):
        self.execute("INSERT INTO app_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))

    def close(self):
        self.connection.close()
