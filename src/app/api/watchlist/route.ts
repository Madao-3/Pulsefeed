import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const items = db
      .prepare("SELECT * FROM watchlist ORDER BY created_at DESC")
      .all();
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, target, tags, interval_ms, enabled, config } = body;

    if (!type || !target) {
      return NextResponse.json({ error: "type and target are required" }, { status: 400 });
    }

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO watchlist (type, target, tags, interval_ms, enabled, config)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        type,
        target,
        JSON.stringify(tags || []),
        interval_ms || 900000,
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        JSON.stringify(config || {})
      );

    const item = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create watchlist item" },
      { status: 500 }
    );
  }
}
