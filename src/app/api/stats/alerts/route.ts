import { NextResponse } from "next/server";
import { getAlerts } from "@/lib/monitor";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = getAlerts();

    // Check API failure rate
    const db = getDb();
    const recentFetches = db
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM fetch_logs
         WHERE created_at > datetime('now', '-1 hour')
         GROUP BY status`
      )
      .all() as Array<{ status: string; count: number }>;

    const total = recentFetches.reduce((sum, r) => sum + r.count, 0);
    const errors = recentFetches
      .filter((r) => r.status === "error" || r.status === "timeout")
      .reduce((sum, r) => sum + r.count, 0);

    if (total > 0 && errors / total > 0.2) {
      alerts.push({
        id: "api-failure-rate",
        level: "danger",
        message: `API 调用失败率 ${Math.round((errors / total) * 100)}%（过去1小时）`,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(alerts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get alerts" },
      { status: 500 }
    );
  }
}
