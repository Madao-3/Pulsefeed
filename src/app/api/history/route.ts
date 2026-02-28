import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Number(searchParams.get("offset")) || 0;
    const source = searchParams.get("source"); // 'opentwitter' | 'opennews'
    const status = searchParams.get("status"); // 'success' | 'error'
    const tag = searchParams.get("tag");

    const db = getDb();

    let where = "1=1";
    const params: unknown[] = [];

    if (source) {
      where += " AND f.source = ?";
      params.push(source);
    }

    if (status) {
      where += " AND p.status = ?";
      params.push(status);
    }

    if (tag) {
      where += " AND w.tags LIKE ?";
      params.push(`%${tag}%`);
    }

    const logs = db
      .prepare(
        `SELECT
           p.id, p.channel, p.status, p.summary, p.message_body, p.error_message, p.created_at,
           f.source, f.tool_name, f.raw_data, f.duration_ms,
           w.target, w.type, w.tags
         FROM push_logs p
         LEFT JOIN fetch_logs f ON p.fetch_log_id = f.id
         LEFT JOIN watchlist w ON f.watchlist_id = w.id
         WHERE ${where}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    const total = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM push_logs p
         LEFT JOIN fetch_logs f ON p.fetch_log_id = f.id
         LEFT JOIN watchlist w ON f.watchlist_id = w.id
         WHERE ${where}`
      )
      .get(...params) as { count: number };

    return NextResponse.json({ logs, total: total.count, limit, offset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history" },
      { status: 500 }
    );
  }
}
