import { NextResponse } from "next/server";
import { verifyGptAuth, corsHeaders, corsResponse } from "@/lib/gpt-auth";
import { getDb } from "@/lib/db";

export async function OPTIONS() {
  return corsResponse();
}

// 获取关注列表
export async function GET(request: Request) {
  const authError = verifyGptAuth(request);
  if (authError) return authError;

  const db = getDb();
  const items = db
    .prepare("SELECT id, type, target, tags, interval_ms, enabled FROM watchlist ORDER BY created_at DESC")
    .all() as Array<{
    id: number;
    type: string;
    target: string;
    tags: string;
    interval_ms: number;
    enabled: number;
  }>;

  const result = items.map((item) => ({
    id: item.id,
    type: item.type === "twitter_kol" ? "Twitter KOL" : "News Keyword",
    target: item.target,
    tags: JSON.parse(item.tags || "[]"),
    interval: `${item.interval_ms / 60000}min`,
    enabled: !!item.enabled,
  }));

  return NextResponse.json({ watchlist: result, total: result.length }, { headers: corsHeaders() });
}

// 添加关注项
export async function POST(request: Request) {
  const authError = verifyGptAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { type, target, tags, interval_minutes } = body;

  if (!type || !target) {
    return NextResponse.json(
      { error: "Required: type ('twitter_kol' or 'news_keyword') and target" },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!["twitter_kol", "news_keyword"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'twitter_kol' or 'news_keyword'" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const db = getDb();
  const intervalMs = (interval_minutes || 15) * 60_000;
  const result = db
    .prepare(
      "INSERT INTO watchlist (type, target, tags, interval_ms) VALUES (?, ?, ?, ?)"
    )
    .run(type, target.replace(/^@/, ""), JSON.stringify(tags || []), intervalMs);

  return NextResponse.json(
    { ok: true, id: result.lastInsertRowid, message: `Added ${target} to watchlist` },
    { status: 201, headers: corsHeaders() }
  );
}
