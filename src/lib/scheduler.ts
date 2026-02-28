import cron from "node-cron";
import os from "os";
import { getDb } from "./db";
import { configStore } from "./config-store";
import { fetchUserTweets } from "./mcp/twitter";
import { searchNews } from "./mcp/news";
import { summarizeTweets, summarizeNews } from "./llm/summarizer";
import { pushToLark } from "./push/lark";

interface WatchlistItem {
  id: number;
  type: string;
  target: string;
  tags: string;
  interval_ms: number;
  enabled: number;
  config: string;
}

// Track last fetch time per watchlist item
const lastFetchMap = new Map<number, number>();
let isRunning = false;
let cronTask: ReturnType<typeof cron.schedule> | null = null;

function memoryOk(): boolean {
  const free = os.freemem();
  const total = os.totalmem();
  const usedPercent = ((total - free) / total) * 100;
  return usedPercent < 85;
}

async function processItem(item: WatchlistItem) {
  console.log(`[Scheduler] Processing: ${item.type} - ${item.target}`);

  try {
    if (item.type === "twitter_kol") {
      const result = await fetchUserTweets(item.target);
      if (result.tweets.length === 0) return;

      const summary = await summarizeTweets(result.tweets);

      // Check thresholds
      const relevanceThreshold = Number(configStore.get("relevance_threshold")) || 0.7;
      const importanceThreshold = Number(configStore.get("importance_threshold")) || 0.5;

      if (summary.relevance >= relevanceThreshold && summary.importance >= importanceThreshold) {
        await pushToLark(
          `🐦 ${item.target} 新动态`,
          summary,
          `@${item.target}`,
          result.tweets[0]?.url
        );
      } else {
        console.log(
          `[Scheduler] Below threshold: relevance=${summary.relevance}, importance=${summary.importance}`
        );
      }
    } else if (item.type === "news_keyword") {
      const result = await searchNews(item.target);
      if (result.articles.length === 0) return;

      const summary = await summarizeNews(result.articles);

      const relevanceThreshold = Number(configStore.get("relevance_threshold")) || 0.7;
      const importanceThreshold = Number(configStore.get("importance_threshold")) || 0.5;

      if (summary.relevance >= relevanceThreshold && summary.importance >= importanceThreshold) {
        await pushToLark(
          `📰 ${item.target} 新闻速报`,
          summary,
          item.target,
          result.articles[0]?.url
        );
      }
    }
  } catch (error) {
    console.error(`[Scheduler] Error processing ${item.target}:`, error);
  }
}

async function tick() {
  if (isRunning) {
    console.log("[Scheduler] Previous tick still running, skipping");
    return;
  }

  if (!memoryOk()) {
    console.warn("[Scheduler] Memory > 85%, skipping this tick");
    return;
  }

  isRunning = true;

  try {
    const db = getDb();
    const items = db
      .prepare("SELECT * FROM watchlist WHERE enabled = 1")
      .all() as WatchlistItem[];

    const now = Date.now();

    for (const item of items) {
      const lastFetch = lastFetchMap.get(item.id) || 0;
      if (now - lastFetch < item.interval_ms) continue;

      if (!memoryOk()) {
        console.warn("[Scheduler] Memory high, stopping early");
        break;
      }

      lastFetchMap.set(item.id, now);
      // Serial execution to protect the lobster
      await processItem(item);
    }
  } catch (error) {
    console.error("[Scheduler] Tick error:", error);
  } finally {
    isRunning = false;
  }
}

// Clean old raw_data (> 30 days)
function cleanup() {
  try {
    const db = getDb();
    db.prepare(
      "UPDATE fetch_logs SET raw_data = NULL WHERE created_at < datetime('now', '-30 days') AND raw_data IS NOT NULL"
    ).run();
    console.log("[Scheduler] Cleanup completed");
  } catch (error) {
    console.error("[Scheduler] Cleanup error:", error);
  }
}

export function startScheduler() {
  if (cronTask) return;

  console.log("[Scheduler] Starting...");

  // Check watchlist every minute
  cronTask = cron.schedule("* * * * *", tick);

  // Cleanup old data every hour
  cron.schedule("0 * * * *", cleanup);

  // Run first tick after 5 seconds
  setTimeout(tick, 5_000);
}

export function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("[Scheduler] Stopped");
  }
}
