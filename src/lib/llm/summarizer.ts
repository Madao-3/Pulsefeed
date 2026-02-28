import { callLlm } from "./client";
import type { Tweet } from "../mcp/twitter";
import type { NewsArticle } from "../mcp/news";

const SUMMARIZE_SYSTEM_PROMPT = `你是一个 Web3 行业分析助手。请对以下内容生成简洁的中文摘要，包含：
1. 核心观点（1-2句话）
2. 相关性评分（0-1，与 Web3/Crypto/DeFi/Gold/Macro 的相关度）
3. 重要性评分（0-1，对行业的影响程度）
4. 关键标签（2-4个）

请以 JSON 格式返回：
{
  "summary": "摘要内容",
  "relevance": 0.8,
  "importance": 0.7,
  "tags": ["#Gold", "#RWA"]
}`;

export interface SummaryResult {
  summary: string;
  relevance: number;
  importance: number;
  tags: string[];
}

export async function summarizeTweets(
  tweets: Tweet[],
  fetchLogId?: number
): Promise<SummaryResult> {
  if (tweets.length === 0) {
    return { summary: "无新内容", relevance: 0, importance: 0, tags: [] };
  }

  const content = tweets
    .map((t) => `@${t.author} (${t.created_at}):\n${t.text}`)
    .join("\n\n---\n\n");

  const result = await callLlm(
    SUMMARIZE_SYSTEM_PROMPT,
    `以下是来自 Twitter 的最新推文：\n\n${content}`,
    "summarize",
    fetchLogId
  );

  return parseSummaryResult(result);
}

export async function summarizeNews(
  articles: NewsArticle[],
  fetchLogId?: number
): Promise<SummaryResult> {
  if (articles.length === 0) {
    return { summary: "无新内容", relevance: 0, importance: 0, tags: [] };
  }

  const content = articles
    .map((a) => `[${a.source}] ${a.title}\n${a.description}\n${a.url}`)
    .join("\n\n---\n\n");

  const result = await callLlm(
    SUMMARIZE_SYSTEM_PROMPT,
    `以下是最新的行业新闻：\n\n${content}`,
    "summarize",
    fetchLogId
  );

  return parseSummaryResult(result);
}

function parseSummaryResult(raw: string): SummaryResult {
  try {
    // Extract JSON from potential markdown code block
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || raw,
        relevance: Math.min(1, Math.max(0, Number(parsed.relevance) || 0)),
        importance: Math.min(1, Math.max(0, Number(parsed.importance) || 0)),
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }
  } catch {
    // fallback
  }
  return { summary: raw, relevance: 0.5, importance: 0.5, tags: [] };
}
