import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchUserTweets } from "@/lib/mcp/twitter";
import { searchNews } from "@/lib/mcp/news";
import { summarizeTweets, summarizeNews } from "@/lib/llm/summarizer";
import { pushToLark } from "@/lib/push/lark";
import { configStore } from "@/lib/config-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { watchlist_id } = body;

    const db = getDb();

    if (watchlist_id) {
      // Trigger specific item
      const item = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(watchlist_id) as {
        id: number;
        type: string;
        target: string;
      } | undefined;

      if (!item) {
        return NextResponse.json({ error: "Watchlist item not found" }, { status: 404 });
      }

      let result;
      if (item.type === "twitter_kol") {
        const data = await fetchUserTweets(item.target);
        const summary = await summarizeTweets(data.tweets);
        result = { data, summary };

        const relevanceThreshold = Number(configStore.get("relevance_threshold")) || 0.7;
        if (summary.relevance >= relevanceThreshold) {
          await pushToLark(`🐦 ${item.target} 新动态`, summary, `@${item.target}`, data.tweets[0]?.url);
        }
      } else {
        const data = await searchNews(item.target);
        const summary = await summarizeNews(data.articles);
        result = { data, summary };

        const relevanceThreshold = Number(configStore.get("relevance_threshold")) || 0.7;
        if (summary.relevance >= relevanceThreshold) {
          await pushToLark(`📰 ${item.target} 新闻速报`, summary, item.target, data.articles[0]?.url);
        }
      }

      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "watchlist_id is required" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Trigger failed" },
      { status: 500 }
    );
  }
}
