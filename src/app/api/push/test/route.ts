import { NextResponse } from "next/server";
import { sendTestMessage } from "@/lib/push/lark";

export async function POST() {
  try {
    const result = await sendTestMessage();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
