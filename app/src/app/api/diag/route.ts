import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { askFo, getFoReply, listFoConversations } from "@/lib/fo-mcp";
import { decideLive } from "@/lib/live";
import { MODE } from "@/lib/mode";
import { isSignedIn } from "@/lib/fo-mcp";
import { getSettings, listApproved } from "@/lib/store";

export const maxDuration = 300;

// Health checks for the live server. Operator (signed in) or the timer secret only. Places NO phone call:
//   ?check=fo         sends Fo the harmless message "Reply with the word ready" and reads the reply
//   ?check=claude     one tiny request to Claude
//   ?check=guardrail  asks the live rules who would get a real call (nothing is created)
//   ?check=status     mode, Autopilot, Fo sign-in, counts
async function allowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return (await getSessionUser())?.role === "operator";
}

export async function GET(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const check = new URL(req.url).searchParams.get("check") ?? "status";
  const started = Date.now();
  try {
    if (check === "status") {
      return NextResponse.json({ agentMode: MODE, autopilot: (await getSettings()).autopilot, foSignedIn: await isSignedIn(), approved: (await listApproved()).map((a) => a.kind) });
    }
    if (check === "fo") {
      if (!(await isSignedIn())) return NextResponse.json({ ok: false, error: "Fo is not signed in. Open /api/fo/connect as the operator." });
      let r = await askFo("Reply with the word ready", { newConversation: true });
      const log = [`ask_fo -> ${r.status}`];
      while (r.status === "working" && Date.now() - started < 50_000) {
        r = await getFoReply(r.conversationId!, 20);
        log.push(`get_fo_reply -> ${r.status}`);
      }
      return NextResponse.json({ ok: r.status === "complete", status: r.status, response: r.response, log, seconds: Math.round((Date.now() - started) / 1000) });
    }
    if (check === "sleep") {
      // Proves how long a function may really run on this plan (waits, then answers). Harmless.
      const secs = Math.min(120, Math.max(1, Number(new URL(req.url).searchParams.get("s") ?? 5)));
      await new Promise((r) => setTimeout(r, secs * 1000));
      return NextResponse.json({ ok: true, waited_seconds: secs });
    }
    if (check === "fo_recent") {
      const t0 = Date.now();
      const r = await listFoConversations();
      const list = ((r.conversations ?? r.items ?? r) as unknown[]) ?? [];
      return NextResponse.json({ ms: Date.now() - t0, count: Array.isArray(list) ? list.length : null, recent: (Array.isArray(list) ? list : []).slice(0, 6).map((c) => JSON.stringify(c).slice(0, 220)) });
    }
    if (check === "fo_timing") {
      // A LONG harmless message (no call, no email): how long does ask_fo take to answer?
      const t0 = Date.now();
      const r = await askFo("This is a connection test only. Please do NOT call anyone and do NOT send any email or text. Just reply with the single word ready. " + "Context: ".padEnd(1500, "x"), { newConversation: true });
      return NextResponse.json({ ask_fo_ms: Date.now() - t0, status: r.status, progress: r.progress });
    }
    if (check === "claude") {
      if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY is not set" });
      const res = await new Anthropic().messages.create({ model: "claude-sonnet-5-5", max_tokens: 16, messages: [{ role: "user", content: "Reply with the word ready" }] });
      const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
      return NextResponse.json({ ok: true, response: text, seconds: Math.round((Date.now() - started) / 1000) });
    }
    if (check === "guardrail") {
      const approved = (await listApproved()).find((a) => a.kind === "customer");
      const stranger = await decideLive({ id: "x", role: "customer", name: "Stranger", phone: "", email: "stranger@example.com", created_at: "" }, "6000000011", "electrician");
      const wrongEmail = approved ? await decideLive({ id: "x", role: "customer", name: "x", phone: "", email: "stranger@example.com", created_at: "" }, approved.phone, "electrician") : null;
      const rightPerson = approved ? await decideLive({ id: "x", role: "customer", name: "x", phone: "", email: approved.email, created_at: "" }, approved.phone, "electrician") : null;
      return NextResponse.json({
        agentMode: MODE,
        stranger_gets_live_call: stranger.live, stranger_reason: stranger.why,
        approved_number_with_wrong_email_gets_live_call: wrongEmail?.live ?? null,
        approved_customer_gets_live_call: rightPerson?.live ?? null, approved_customer_reason: rightPerson?.why ?? "no approved customer",
      });
    }
    return NextResponse.json({ error: "Unknown check." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e instanceof Error ? e.message : String(e)).replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 300) }, { status: 200 });
  }
}
