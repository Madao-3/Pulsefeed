import { getDb } from "./db";
import { configStore } from "./config-store";
import { startScheduler } from "./scheduler";

let initialized = false;

export function initApp() {
  if (initialized) return;
  initialized = true;

  console.log("[PulseFeed] Initializing...");

  // 1. Initialize DB
  getDb();
  console.log("[PulseFeed] Database ready");

  // 2. Initialize config store
  configStore.init();
  console.log("[PulseFeed] Config store ready");

  // 3. Start scheduler
  startScheduler();
  console.log("[PulseFeed] Scheduler started");

  console.log("[PulseFeed] 🦞 Ready!");
}
