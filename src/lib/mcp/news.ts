import { configStore } from "../config-store";
import { getDb } from "../db";

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
}

export interface NewsFetchResult {
  articles: NewsArticle[];
  raw: unknown;
}

async function callMcp(toolName: string, params: Record<string, unknown>): Promise<unknown> {
  const endpoint = configStore.get("opennews_endpoint") as string;
  const apiKey = configStore.get("opennews_api_key") as string;

  if (!endpoint) throw new Error("OpenNews MCP endpoint not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${endpoint}/call-tool`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: toolName, arguments: params }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`MCP call failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
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
    const result = await callMcp("search_news", { query: keyword, count: 10 });
    const duration = Date.now() - startTime;

    const data = result as { content?: Array<{ text?: string }> };
    let articles: NewsArticle[] = [];

    if (data.content && Array.isArray(data.content)) {
      for (const item of data.content) {
        if (item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) {
              articles = parsed.map((a: Record<string, unknown>) => ({
                title: String(a.title || ""),
                description: String(a.description || a.summary || ""),
                url: String(a.url || ""),
                source: String(a.source || "unknown"),
                published_at: String(a.published_at || a.publishedAt || new Date().toISOString()),
              }));
            }
          } catch {
            articles = [
              {
                title: "News Update",
                description: item.text,
                url: "",
                source: "opennews",
                published_at: new Date().toISOString(),
              },
            ];
          }
        }
      }
    }

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

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const endpoint = configStore.get("opennews_endpoint") as string;
    if (!endpoint) return { ok: false, message: "Endpoint not configured" };
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
    return { ok: res.ok, message: res.ok ? "Connected" : `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
