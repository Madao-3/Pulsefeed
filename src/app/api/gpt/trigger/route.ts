import { NextResponse } from "next/server";
import { verifyGptAuth, corsHeaders, corsResponse } from "@/lib/gpt-auth";
import { getDb } from "@/lib/db";
import { fetchUserTweets } from "@/lib/mcp/twitter";
import { searchNews } from "@/lib/mcp/news";
import { summarizeTweets, summarizeNews } from "@/lib/llm/summarizer";
import { pushToLark } from "@/lib/push/lark";
import { configStore } from "@/lib/config-store";

export async function OPTIONS() {
  return corsResponse();
}

// 手动触发某个 watchlist 项的抓取
export async function POST(request: Request) {
  const authError = verifyGptAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { watchlist_id } = body;

  if (!watchlist_id) {
    return NextResponse.json(
      { error: "Required: watchlist_id" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const db = getDb();
  const item = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(watchlist_id) as {
    id: number;
    type: string;
    target: string;
  } | undefined;

  if (!item) {
    return NextResponse.json(
      { error: `Watchlist item ${watchlist_id} not found` },
      { status: 404, headers: corsHeaders() }
    );
  }

  try {
    let summaryText = "";

    if (item.type === "twitter_kol") {
      const data = await fetchUserTweets(item.target);
      const summary = await summarizeTweets(data.tweets);
      summaryText = summary.summary;

      const threshold = Number(configStore.get("relevance_threshold")) || 0.7;
      if (summary.relevance >= threshold) {
        await pushToLark(`🐦 ${item.target} 新动态`, summary, `@${item.target}`, data.tweets[0]?.url);
      }
    } else {
      const data = await searchNews(item.target);
      const summary = await summarizeNews(data.articles);
      summaryText = summary.summary;

      const threshold = Number(configStore.get("relevance_threshold")) || 0.7;
      if (summary.relevance >= threshold) {
        await pushToLark(`📰 ${item.target} 新闻速报`, summary, item.target, data.articles[0]?.url);
      }
    }

    return NextResponse.json(
      { ok: true, target: item.target, summary: summaryText },
      { headers: corsHeaders() }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Trigger failed" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
