import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(Number(id));
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.target !== undefined) { fields.push("target = ?"); values.push(body.target); }
    if (body.tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(body.tags)); }
    if (body.interval_ms !== undefined) { fields.push("interval_ms = ?"); values.push(body.interval_ms); }
    if (body.enabled !== undefined) { fields.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
    if (body.config !== undefined) { fields.push("config = ?"); values.push(JSON.stringify(body.config)); }

    if (fields.length > 0) {
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(Number(id));
      db.prepare(`UPDATE watchlist SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(Number(id));
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM watchlist WHERE id = ?").run(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
