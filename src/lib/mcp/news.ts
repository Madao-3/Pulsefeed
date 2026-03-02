import { configStore } from "../config-store";
import { getDb } from "../db";

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  coins?: string[];
  aiRating?: {
    score: number;
    grade: string;
    signal: string;
    summary: string;
  };
}

export interface NewsFetchResult {
  articles: NewsArticle[];
  raw: unknown;
}

/**
 * Call 6551 News REST API directly.
 * Endpoints: GET /open/news_type, POST /open/news_search
 * Auth: Bearer token
 * Docs: https://github.com/6551Team/opennews-mcp
 */
async function callApi(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const endpoint = (configStore.get("opennews_endpoint") as string) || "https://ai.6551.io";
  const apiKey = configStore.get("opennews_api_key") as string;

  if (!apiKey) throw new Error("OpenNews API Key not configured (get one at https://6551.io/mcp)");

  const baseUrl = endpoint.replace(/\/+$/, "");

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(30_000),
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API call failed: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}

function parseArticle(item: Record<string, unknown>): NewsArticle {
  const rating = item.aiRating as Record<string, unknown> | undefined;
  const coins = item.coins as Array<Record<string, unknown>> | undefined;

  return {
    title: String(item.text || item.title || ""),
    description: rating?.summary ? String(rating.summary) : String(item.text || ""),
    url: String(item.link || item.url || ""),
    source: String(item.newsType || item.engineType || item.source || "unknown"),
    published_at: item.ts
      ? new Date(Number(item.ts)).toISOString()
      : String(item.published_at || new Date().toISOString()),
    coins: coins?.map((c) => String(c.symbol || c.name || "")).filter(Boolean),
    aiRating: rating
      ? {
          score: Number(rating.score || 0),
          grade: String(rating.grade || ""),
          signal: String(rating.signal || ""),
          summary: String(rating.enSummary || rating.summary || ""),
        }
      : undefined,
  };
}

export async function searchNews(keyword: string): Promise<NewsFetchResult> {
  const db = getDb();
  const startTime = Date.now();
  const logId = db
    .prepare(
      "INSERT INTO fetch_logs (source, tool_name, status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .run("opennews", "search_news", "running").lastInsertRowid;

  try {
    const result = (await callApi("POST", "/open/news_search", {
      q: keyword,
      limit: 10,
      page: 1,
    })) as { data?: Array<Record<string, unknown>> };

    const duration = Date.now() - startTime;
    const data = result.data || [];
    const articles = data.map(parseArticle);

    db.prepare(
      "UPDATE fetch_logs SET status = ?, raw_data = ?, duration_ms = ? WHERE id = ?"
    ).run("success", JSON.stringify(result), duration, logId);

    return { articles, raw: result };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    db.prepare(
      "UPDATE fetch_logs SET status = ?, error_message = ?, duration_ms = ? WHERE id = ?"
    ).run("error", message, duration, logId);
    throw error;
  }
}

export async function getLatestNews(limit = 10): Promise<NewsFetchResult> {
  const result = (await callApi("POST", "/open/news_search", {
    limit,
    page: 1,
  })) as { data?: Array<Record<string, unknown>> };

  const data = result.data || [];
  return { articles: data.map(parseArticle), raw: result };
}

export async function searchNewsByCoin(coin: string, limit = 10): Promise<NewsFetchResult> {
  const result = (await callApi("POST", "/open/news_search", {
    coins: [coin],
    limit,
    page: 1,
  })) as { data?: Array<Record<string, unknown>> };

  const data = result.data || [];
  return { articles: data.map(parseArticle), raw: result };
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const endpoint = (configStore.get("opennews_endpoint") as string) || "https://ai.6551.io";
    const apiKey = configStore.get("opennews_api_key") as string;

    if (!apiKey) return { ok: false, message: "API Key not configured" };

    // Quick test: fetch news type tree (lightweight GET call)
    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/open/news_type`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      return { ok: true, message: "Connected to 6551 API" };
    }
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
