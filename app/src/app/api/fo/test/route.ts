import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { askFo, getFoConversation, getFoReply, type FoReply } from "@/lib/fo-mcp";

// Plan A check: ask_fo, then keep calling get_fo_reply until complete or failed (max ~3 minutes).
// Harmless message only: no calls, no email.
export async function POST() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const started = Date.now();
  const log: string[] = [];
  try {
    let r: FoReply = await askFo("Reply with the word ready", { newConversation: true });
    log.push(`ask_fo -> ${r.status}${r.progress ? ` (${r.progress})` : ""}`);
    while (r.status === "working" && Date.now() - started < 180_000) {
      r = await getFoReply(r.conversationId!);
      log.push(`get_fo_reply -> ${r.status}${r.progress ? ` (${r.progress})` : ""}`);
    }
    // Also check that the conversation can be read back (that is where Fo posts its call summary).
    const conv = r.conversationId ? await getFoConversation(r.conversationId) : { turns: [] };
    log.push(`get_fo_conversation -> ${conv.turns.length} turns (${conv.turns.map((t) => t.role).join(", ")})`);
    // And that get_fo_reply on a finished conversation still answers.
    const again = r.conversationId ? await getFoReply(r.conversationId, 0) : null;
    log.push(`get_fo_reply (again, after complete) -> ${again?.status}`);
    return NextResponse.json({ ok: r.status === "complete", status: r.status, response: r.response, log, seconds: Math.round((Date.now() - started) / 1000) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), log }, { status: 500 });
  }
}
