import { NextResponse } from "next/server";
import { testConnection as testLlm } from "@/lib/llm/client";
import { testConnection as testTwitter } from "@/lib/mcp/twitter";
import { testConnection as testNews } from "@/lib/mcp/news";
import { sendTestMessage as testLark } from "@/lib/push/lark";

export async function POST(request: Request) {
  try {
    const { service } = await request.json();

    let result: { ok: boolean; message: string };

    switch (service) {
      case "llm":
        result = await testLlm();
        break;
      case "opentwitter":
        result = await testTwitter();
        break;
      case "opennews":
        result = await testNews();
        break;
      case "lark":
        result = await testLark();
        break;
      default:
        result = { ok: false, message: `Unknown service: ${service}` };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
