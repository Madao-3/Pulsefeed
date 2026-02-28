import { NextResponse } from "next/server";
import { verifyGptAuth, corsHeaders, corsResponse } from "@/lib/gpt-auth";
import { getSystemMetrics } from "@/lib/monitor";
import { getDb } from "@/lib/db";
import { formatBytes, formatDuration } from "@/lib/utils";

export async function OPTIONS() {
  return corsResponse();
}

export async function GET(request: Request) {
  const authError = verifyGptAuth(request);
  if (authError) return authError;

  const metrics = getSystemMetrics();
  const db = getDb();

  const todayFetches = db
    .prepare(
      "SELECT COUNT(*) as count FROM fetch_logs WHERE created_at > datetime('now', 'start of day')"
    )
    .get() as { count: number };

  const todayPushes = db
    .prepare(
      "SELECT status, COUNT(*) as count FROM push_logs WHERE created_at > datetime('now', 'start of day') GROUP BY status"
    )
    .all() as Array<{ status: string; count: number }>;

  const activeWatchlist = db
    .prepare("SELECT COUNT(*) as count FROM watchlist WHERE enabled = 1")
    .get() as { count: number };

  return NextResponse.json(
    {
      system: {
        cpu: `${metrics.cpu.usage}%`,
        memory: `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)} (${metrics.memory.percentage}%)`,
        uptime: formatDuration(metrics.uptime),
        db_size: formatBytes(metrics.disk.dbSize),
      },
      today: {
        fetches: todayFetches.count,
        pushes_success: todayPushes.find((p) => p.status === "success")?.count || 0,
        pushes_failed: todayPushes.find((p) => p.status === "error")?.count || 0,
      },
      active_monitors: activeWatchlist.count,
    },
    { headers: corsHeaders() }
  );
}
