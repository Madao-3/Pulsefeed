import { NextResponse } from "next/server";
import { configStore } from "./config-store";

/**
 * GPT Actions API Key 验证
 * GPT 在 Actions 里配置 API Key (Bearer token)，每次请求带上
 * Key 存在 SQLite configs 表里，通过 Settings 页面管理
 */
export function verifyGptAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer <your-api-key>" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const storedKey = configStore.get("gpt_api_key") as string;

  if (!storedKey || storedKey.length === 0) {
    return NextResponse.json(
      { error: "GPT API key not configured. Set it in PulseFeed Settings → GPT Actions." },
      { status: 503 }
    );
  }

  if (token !== storedKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 403 });
  }

  return null; // Auth passed
}

/**
 * CORS headers for GPT Actions
 * OpenAI 的 GPT 从 chat.openai.com 发起请求
 */
export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function corsResponse() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
