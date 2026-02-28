import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "pulsefeed.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS configs (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL CHECK(type IN ('twitter_kol', 'news_keyword')),
      target      TEXT NOT NULL,
      tags        TEXT DEFAULT '[]',
      interval_ms INTEGER DEFAULT 900000,
      enabled     INTEGER DEFAULT 1,
      config      TEXT DEFAULT '{}',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fetch_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source        TEXT NOT NULL,
      tool_name     TEXT NOT NULL,
      watchlist_id  INTEGER REFERENCES watchlist(id),
      status        TEXT NOT NULL CHECK(status IN ('success', 'error', 'timeout', 'running')),
      raw_data      TEXT,
      error_message TEXT,
      duration_ms   INTEGER,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS llm_usage (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      provider          TEXT NOT NULL,
      model             TEXT NOT NULL,
      prompt_tokens     INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens      INTEGER DEFAULT 0,
      estimated_cost    REAL DEFAULT 0,
      purpose           TEXT,
      fetch_log_id      INTEGER REFERENCES fetch_logs(id),
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel       TEXT NOT NULL DEFAULT 'lark',
      status        TEXT NOT NULL CHECK(status IN ('success', 'error')),
      message_body  TEXT NOT NULL,
      summary       TEXT,
      fetch_log_id  INTEGER REFERENCES fetch_logs(id),
      error_message TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_fetch_logs_created ON fetch_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_fetch_logs_source ON fetch_logs(source);
    CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at);
    CREATE INDEX IF NOT EXISTS idx_push_logs_created ON push_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_watchlist_type ON watchlist(type);
  `);

  // Seed default configs if empty
  const count = db.prepare("SELECT COUNT(*) as cnt FROM configs").get() as { cnt: number };
  if (count.cnt === 0) {
    const defaults: [string, string][] = [
      ["llm_provider", '"anthropic"'],
      ["llm_model", '"claude-sonnet-4-20250514"'],
      ["llm_max_tokens", "1024"],
      ["llm_temperature", "0.3"],
      ["llm_api_key", '""'],
      ["opentwitter_endpoint", '"http://localhost:8001"'],
      ["opentwitter_api_key", '""'],
      ["opennews_endpoint", '"http://localhost:8002"'],
      ["opennews_api_key", '""'],
      ["lark_webhook_url", '""'],
      ["gpt_api_key", '""'],
      ["relevance_threshold", "0.7"],
      ["importance_threshold", "0.5"],
      ["dedup_window_hours", "24"],
    ];
    const insert = db.prepare("INSERT INTO configs (key, value) VALUES (?, ?)");
    const tx = db.transaction(() => {
      for (const [k, v] of defaults) {
        insert.run(k, v);
      }
    });
    tx();
  }
}
