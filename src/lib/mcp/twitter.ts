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

/**
 * Call 6551 Twitter REST API directly.
 * Endpoints: POST /open/twitter_*
 * Auth: Bearer token
 * Docs: https://github.com/6551Team/opentwitter-mcp
 */
async function callApi(path: string, body: Record<string, unknown>): Promise<unknown> {
  const endpoint = (configStore.get("opentwitter_endpoint") as string) || "https://ai.6551.io";
  const apiKey = configStore.get("opentwitter_api_key") as string;

  if (!apiKey) throw new Error("OpenTwitter API Key not configured (get one at https://6551.io/mcp)");

  const baseUrl = endpoint.replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API call failed: ${res.status} ${res.statusText} ${text}`);
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
    .run("opentwitter", "get_twitter_user_tweets", "running").lastInsertRowid;

  try {
    const result = (await callApi("/open/twitter_user_tweets", {
      username,
      maxResults: 10,
      product: "Latest",
      includeReplies: false,
      includeRetweets: false,
    })) as { data?: Array<Record<string, unknown>> };

    const duration = Date.now() - startTime;
    const data = result.data || [];

    const tweets: Tweet[] = data.map((t) => ({
      id: String(t.id || t.tweetId || ""),
      text: String(t.text || t.fullText || ""),
      author: String(t.userScreenName || t.screenName || username),
      created_at: String(t.createdAt || new Date().toISOString()),
      url:
        t.url
          ? String(t.url)
          : `https://twitter.com/${username}/status/${t.id || t.tweetId}`,
      metrics: {
        likes: Number(t.favoriteCount || t.likes || 0),
        retweets: Number(t.retweetCount || t.retweets || 0),
        replies: Number(t.replyCount || t.replies || 0),
      },
    }));

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

export async function searchTwitter(
  keywords: string,
  options?: { fromUser?: string; minLikes?: number; limit?: number }
): Promise<TwitterFetchResult> {
  const db = getDb();
  const startTime = Date.now();
  const logId = db
    .prepare(
      "INSERT INTO fetch_logs (source, tool_name, status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .run("opentwitter", "search_twitter", "running").lastInsertRowid;

  try {
    const body: Record<string, unknown> = {
      keywords,
      maxResults: options?.limit || 20,
      product: "Top",
    };
    if (options?.fromUser) body.fromUser = options.fromUser;
    if (options?.minLikes) body.minLikes = options.minLikes;

    const result = (await callApi("/open/twitter_search", body)) as {
      data?: Array<Record<string, unknown>>;
    };
    const duration = Date.now() - startTime;
    const data = result.data || [];

    const tweets: Tweet[] = data.map((t) => ({
      id: String(t.id || t.tweetId || ""),
      text: String(t.text || t.fullText || ""),
      author: String(t.userScreenName || t.screenName || ""),
      created_at: String(t.createdAt || new Date().toISOString()),
      url: t.url ? String(t.url) : undefined,
      metrics: {
        likes: Number(t.favoriteCount || t.likes || 0),
        retweets: Number(t.retweetCount || t.retweets || 0),
        replies: Number(t.replyCount || t.replies || 0),
      },
    }));

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
    const endpoint = (configStore.get("opentwitter_endpoint") as string) || "https://ai.6551.io";
    const apiKey = configStore.get("opentwitter_api_key") as string;

    if (!apiKey) return { ok: false, message: "API Key not configured" };

    // Quick test: fetch Vitalik's profile (lightweight call)
    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/open/twitter_user_info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ username: "VitalikButerin" }),
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
