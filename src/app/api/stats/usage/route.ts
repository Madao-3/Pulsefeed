import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    // MCP call counts
    const mcpStats = db
      .prepare(
        `SELECT source, tool_name, status, COUNT(*) as count
         FROM fetch_logs
         WHERE created_at > datetime('now', '-30 days')
         GROUP BY source, tool_name, status`
      )
      .all();

    // LLM token usage
    const llmStats = db
      .prepare(
        `SELECT
           provider, model,
           SUM(prompt_tokens) as total_prompt_tokens,
           SUM(completion_tokens) as total_completion_tokens,
           SUM(total_tokens) as total_tokens,
           SUM(estimated_cost) as total_cost,
           COUNT(*) as call_count
         FROM llm_usage
         WHERE created_at > datetime('now', '-30 days')
         GROUP BY provider, model`
      )
      .all();

    // Push stats
    const pushStats = db
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM push_logs
         WHERE created_at > datetime('now', '-30 days')
         GROUP BY status`
      )
      .all();

    // Today's counts
    const todayMcp = db
      .prepare(
        `SELECT source, COUNT(*) as count
         FROM fetch_logs
         WHERE created_at > datetime('now', 'start of day')
         GROUP BY source`
      )
      .all();

    const todayLlm = db
      .prepare(
        `SELECT SUM(total_tokens) as tokens, SUM(estimated_cost) as cost
         FROM llm_usage
         WHERE created_at > datetime('now', 'start of day')`
      )
      .get() as { tokens: number | null; cost: number | null };

    return NextResponse.json({
      mcp: mcpStats,
      llm: llmStats,
      push: pushStats,
      today: {
        mcp: todayMcp,
        llm_tokens: todayLlm?.tokens || 0,
        llm_cost: todayLlm?.cost || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get usage stats" },
      { status: 500 }
    );
  }
}
