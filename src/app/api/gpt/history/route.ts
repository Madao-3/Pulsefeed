import { NextResponse } from "next/server";
import { verifyGptAuth, corsHeaders, corsResponse } from "@/lib/gpt-auth";
import { getDb } from "@/lib/db";

export async function OPTIONS() {
  return corsResponse();
}

// 获取最近的推送历史（精简版，适合 GPT 上下文）
export async function GET(request: Request) {
  const authError = verifyGptAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 20);

  const db = getDb();
  const logs = db
    .prepare(
      `SELECT
         p.status, p.summary, p.created_at,
         f.source,
         w.target, w.type
       FROM push_logs p
       LEFT JOIN fetch_logs f ON p.fetch_log_id = f.id
       LEFT JOIN watchlist w ON f.watchlist_id = w.id
       ORDER BY p.created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    status: string;
    summary: string | null;
    created_at: string;
    source: string | null;
    target: string | null;
    type: string | null;
  }>;

  const result = logs.map((log) => ({
    time: log.created_at,
    status: log.status,
    source: log.source === "opentwitter" ? "Twitter" : "News",
    target: log.target || "—",
    summary: log.summary || "—",
  }));

  return NextResponse.json({ history: result, count: result.length }, { headers: corsHeaders() });
}
