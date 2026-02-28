import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const item = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(Number(id)) as {
      enabled: number;
    } | undefined;

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newEnabled = item.enabled ? 0 : 1;
    db.prepare("UPDATE watchlist SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      newEnabled,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM watchlist WHERE id = ?").get(Number(id));
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle" },
      { status: 500 }
    );
  }
}
