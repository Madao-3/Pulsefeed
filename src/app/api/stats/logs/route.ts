import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

    const db = getDb();
    const logs = db
      .prepare(
        `SELECT
           f.id, f.source, f.tool_name, f.status, f.error_message, f.duration_ms, f.created_at,
           w.target, w.type,
           p.status as push_status, p.summary
         FROM fetch_logs f
         LEFT JOIN watchlist w ON f.watchlist_id = w.id
         LEFT JOIN push_logs p ON p.fetch_log_id = f.id
         ORDER BY f.created_at DESC
         LIMIT ?`
      )
      .all(limit);

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get logs" },
      { status: 500 }
    );
  }
}
