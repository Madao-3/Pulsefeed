import { configStore } from "../config-store";
import { getDb } from "../db";

export interface Tweet {
  id: string;
  text: string;
  author: string;
  created_at: string;
  url?: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface TwitterFetchResult {
  tweets: Tweet[];
  raw: unknown;
}

async function callMcp(toolName: string, params: Record<string, unknown>): Promise<unknown> {
  const endpoint = configStore.get("opentwitter_endpoint") as string;
  const apiKey = configStore.get("opentwitter_api_key") as string;

  if (!endpoint) throw new Error("OpenTwitter MCP endpoint not configured");

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

export async function fetchUserTweets(username: string): Promise<TwitterFetchResult> {
  const db = getDb();
  const startTime = Date.now();
  const logId = db
    .prepare(
      "INSERT INTO fetch_logs (source, tool_name, status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .run("opentwitter", "get_user_tweets", "running").lastInsertRowid;

  try {
    const result = await callMcp("get_user_tweets", { username, count: 10 });
    const duration = Date.now() - startTime;

    // Parse MCP response — adapt based on actual MCP response format
    const data = result as { content?: Array<{ text?: string }> };
    let tweets: Tweet[] = [];

    if (data.content && Array.isArray(data.content)) {
      for (const item of data.content) {
        if (item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) {
              tweets = parsed.map((t: Record<string, unknown>) => ({
                id: String(t.id || ""),
                text: String(t.text || t.full_text || ""),
                author: username,
                created_at: String(t.created_at || new Date().toISOString()),
                url: t.url ? String(t.url) : `https://twitter.com/${username}/status/${t.id}`,
                metrics: t.metrics as Tweet["metrics"],
              }));
            }
          } catch {
            // text response, treat as single tweet
            tweets = [
              {
                id: Date.now().toString(),
                text: item.text,
                author: username,
                created_at: new Date().toISOString(),
              },
            ];
          }
        }
      }
    }

    db.prepare(
      "UPDATE fetch_logs SET status = ?, raw_data = ?, duration_ms = ? WHERE id = ?"
    ).run("success", JSON.stringify(result), duration, logId);

    return { tweets, raw: result };
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
    const endpoint = configStore.get("opentwitter_endpoint") as string;
    if (!endpoint) return { ok: false, message: "Endpoint not configured" };
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
    return { ok: res.ok, message: res.ok ? "Connected" : `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
