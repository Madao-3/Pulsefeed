import { configStore } from "../config-store";
import { getDb } from "../db";

// Cost per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
};

interface LlmResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Returns the base URL for chat completions (WITHOUT trailing /chat/completions)
function getProviderBaseUrl(provider: string, customEndpoint?: string): string {
  // If user set a custom endpoint, use it directly
  if (customEndpoint) {
    // Strip trailing slash
    return customEndpoint.replace(/\/+$/, "");
  }
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number
): Promise<LlmResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content[0]?.text || "",
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  };
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number
): Promise<LlmResponse> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content || "",
    usage: data.usage,
  };
}

export async function callLlm(
  systemPrompt: string,
  userMessage: string,
  purpose: string,
  fetchLogId?: number
): Promise<string> {
  const provider = (configStore.get("llm_provider") as string) || "anthropic";
  const model = (configStore.get("llm_model") as string) || "claude-sonnet-4-20250514";
  const apiKey = configStore.get("llm_api_key") as string;
  const maxTokens = Number(configStore.get("llm_max_tokens")) || 1024;
  const temperature = Number(configStore.get("llm_temperature")) || 0.3;

  if (!apiKey) throw new Error("LLM API key not configured");

  let result: LlmResponse;

  const customEndpoint = configStore.get("llm_endpoint") as string;

  if (provider === "anthropic" && !customEndpoint) {
    result = await callAnthropic(apiKey, model, systemPrompt, userMessage, maxTokens, temperature);
  } else {
    const baseUrl = getProviderBaseUrl(provider, customEndpoint);
    result = await callOpenAICompatible(
      baseUrl,
      apiKey,
      model,
      systemPrompt,
      userMessage,
      maxTokens,
      temperature
    );
  }

  // Log usage
  const pricing = PRICING[model] || { input: 0, output: 0 };
  const cost =
    (result.usage.prompt_tokens * pricing.input +
      result.usage.completion_tokens * pricing.output) /
    1_000_000;

  const db = getDb();
  db.prepare(
    `INSERT INTO llm_usage (provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, purpose, fetch_log_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(
    provider,
    model,
    result.usage.prompt_tokens,
    result.usage.completion_tokens,
    result.usage.total_tokens,
    cost,
    purpose,
    fetchLogId || null
  );

  return result.content;
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const provider = (configStore.get("llm_provider") as string) || "anthropic";
    const apiKey = configStore.get("llm_api_key") as string;
    const customEndpoint = configStore.get("llm_endpoint") as string;
    const model = (configStore.get("llm_model") as string) || "claude-sonnet-4-20250514";

    if (!apiKey) return { ok: false, message: "API key not configured" };

    // If custom endpoint is set, always use OpenAI-compatible test
    if (customEndpoint) {
      const baseUrl = getProviderBaseUrl(provider, customEndpoint);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.text();
      return { ok: res.ok, message: res.ok ? "Connected" : `HTTP ${res.status}: ${body.slice(0, 100)}` };
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: "Hi" }] }),
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: res.ok, message: res.ok ? "Connected" : `HTTP ${res.status}` };
    }

    // Default: OpenAI-compatible
    const baseUrl = getProviderBaseUrl(provider);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: "Hi" }] }),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, message: res.ok ? "Connected" : `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
