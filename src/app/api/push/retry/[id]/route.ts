import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { configStore } from "@/lib/config-store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const log = db.prepare("SELECT * FROM push_logs WHERE id = ?").get(Number(id)) as {
      id: number;
      message_body: string;
      summary: string;
      fetch_log_id: number;
    } | undefined;

    if (!log) {
      return NextResponse.json({ error: "Push log not found" }, { status: 404 });
    }

    const webhookUrl = configStore.get("lark_webhook_url") as string;
    if (!webhookUrl) {
      return NextResponse.json({ ok: false, message: "Lark webhook not configured" }, { status: 400 });
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: log.message_body,
      signal: AbortSignal.timeout(10_000),
    });

    const ok = res.ok;
    const body = await res.text();

    // Log the retry
    db.prepare(
      `INSERT INTO push_logs (channel, status, message_body, summary, fetch_log_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run("lark", ok ? "success" : "error", log.message_body, log.summary, log.fetch_log_id, ok ? null : body);

    return NextResponse.json({ ok, message: ok ? "Retry succeeded" : `HTTP ${res.status}` });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Retry failed" },
      { status: 500 }
    );
  }
}
