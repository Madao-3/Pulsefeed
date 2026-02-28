import { configStore } from "../config-store";
import { getDb } from "../db";
import type { SummaryResult } from "../llm/summarizer";

interface LarkCardMessage {
  msg_type: "interactive";
  card: {
    header: {
      title: { tag: "plain_text"; content: string };
      template: string;
    };
    elements: Array<Record<string, unknown>>;
  };
}

function buildCard(
  title: string,
  summary: SummaryResult,
  source: string,
  sourceUrl?: string
): LarkCardMessage {
  const stars = "⭐".repeat(Math.round(summary.relevance * 5));
  const tagsStr = summary.tags.join(" ");

  const elements: Array<Record<string, unknown>> = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**AI 摘要**: ${summary.summary}\n\n**来源**: ${source}\n**相关性**: ${stars}\n**标签**: ${tagsStr}`,
      },
    },
  ];

  if (sourceUrl) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: "查看原文" },
          url: sourceUrl,
          type: "default",
        },
      ],
    });
  }

  // Color based on importance
  let template = "blue";
  if (summary.importance >= 0.8) template = "red";
  else if (summary.importance >= 0.6) template = "orange";
  else if (summary.importance >= 0.4) template = "yellow";

  return {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: title },
        template,
      },
      elements,
    },
  };
}

export async function pushToLark(
  title: string,
  summary: SummaryResult,
  source: string,
  sourceUrl?: string,
  fetchLogId?: number
): Promise<{ ok: boolean; message: string }> {
  const webhookUrl = configStore.get("lark_webhook_url") as string;
  if (!webhookUrl) {
    return { ok: false, message: "Lark webhook URL not configured" };
  }

  const card = buildCard(title, summary, source, sourceUrl);
  const db = getDb();

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
      signal: AbortSignal.timeout(10_000),
    });

    const body = await res.text();
    const ok = res.ok;

    db.prepare(
      `INSERT INTO push_logs (channel, status, message_body, summary, fetch_log_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(
      "lark",
      ok ? "success" : "error",
      JSON.stringify(card),
      summary.summary,
      fetchLogId || null,
      ok ? null : body
    );

    return { ok, message: ok ? "Sent" : `HTTP ${res.status}: ${body}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push failed";
    db.prepare(
      `INSERT INTO push_logs (channel, status, message_body, summary, fetch_log_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run("lark", "error", JSON.stringify(card), summary.summary, fetchLogId || null, message);
    return { ok: false, message };
  }
}

export async function sendTestMessage(): Promise<{ ok: boolean; message: string }> {
  const webhookUrl = configStore.get("lark_webhook_url") as string;
  if (!webhookUrl) return { ok: false, message: "Lark webhook URL not configured" };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: { tag: "plain_text", content: "🦞 PulseFeed 测试消息" },
            template: "green",
          },
          elements: [
            {
              tag: "div",
              text: {
                tag: "lark_md",
                content: "PulseFeed 飞书推送配置成功！小龙虾在线 🦞",
              },
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    return { ok: res.ok, message: res.ok ? "Test message sent" : `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
