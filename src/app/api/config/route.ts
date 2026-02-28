import { NextResponse } from "next/server";
import { configStore } from "@/lib/config-store";
import { maskApiKey } from "@/lib/utils";

const SENSITIVE_KEYS = new Set([
  "llm_api_key",
  "opentwitter_api_key",
  "opennews_api_key",
  "lark_webhook_url",
  "gpt_api_key",
]);

export async function GET() {
  try {
    const all = configStore.getAll();
    // Mask sensitive values for frontend
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(all)) {
      if (SENSITIVE_KEYS.has(key) && typeof value === "string" && value.length > 0) {
        masked[key] = maskApiKey(value);
      } else {
        masked[key] = value;
      }
    }
    return NextResponse.json(masked);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    configStore.setMany(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update config" },
      { status: 500 }
    );
  }
}
