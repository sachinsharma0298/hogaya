import Anthropic from "@anthropic-ai/sdk";
import { requireRole } from "@/lib/guard";
import { NextResponse } from "next/server";

// One short request to confirm ANTHROPIC_API_KEY works. The key is never returned or logged.
export async function POST() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY is empty" }, { status: 500 });
  try {
    const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
    const res = await new Anthropic().messages.create({
      model,
      max_tokens: 20,
      messages: [{ role: "user", content: "Reply with the word ready" }],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    return NextResponse.json({ ok: true, model, text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***") : "failed" }, { status: 500 });
  }
}
