import { EventEmitter } from "events";
import { getDb } from "./db";
import { encrypt, decrypt, isEncrypted } from "./crypto";

// Keys that should be encrypted in the database
const SENSITIVE_KEYS = new Set([
  "llm_api_key",
  "opentwitter_api_key",
  "opennews_api_key",
  "lark_webhook_url",
  "gpt_api_key",
]);

class ConfigStore extends EventEmitter {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  init() {
    if (this.initialized) return;
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM configs").all() as {
      key: string;
      value: string;
    }[];
    for (const row of rows) {
      let val = row.value;
      // Decrypt sensitive values
      if (SENSITIVE_KEYS.has(row.key)) {
        try {
          const parsed = JSON.parse(val);
          if (typeof parsed === "string" && isEncrypted(parsed)) {
            val = JSON.stringify(decrypt(parsed));
          }
        } catch {
          // Value may not be encrypted yet, keep as-is
        }
      }
      this.cache.set(row.key, val);
    }
    this.initialized = true;
  }

  get(key: string): string | undefined {
    this.init();
    const raw = this.cache.get(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  getAll(): Record<string, unknown> {
    this.init();
    const result: Record<string, unknown> = {};
    for (const [key, raw] of this.cache) {
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    }
    return result;
  }

  set(key: string, value: unknown) {
    this.init();
    const db = getDb();
    const jsonValue = JSON.stringify(value);

    // Encrypt sensitive values before storing
    let dbValue = jsonValue;
    if (SENSITIVE_KEYS.has(key) && typeof value === "string" && value.length > 0) {
      dbValue = JSON.stringify(encrypt(value));
    }

    const existing = db.prepare("SELECT key FROM configs WHERE key = ?").get(key);
    if (existing) {
      db.prepare("UPDATE configs SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?").run(
        dbValue,
        key
      );
    } else {
      db.prepare("INSERT INTO configs (key, value) VALUES (?, ?)").run(key, dbValue);
    }

    this.cache.set(key, jsonValue);
    this.emit("config:changed", { key, value });
  }

  setMany(entries: Record<string, unknown>) {
    const db = getDb();
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        this.set(key, value);
      }
    });
    tx();
  }
}

// Singleton
export const configStore = new ConfigStore();
