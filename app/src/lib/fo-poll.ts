// A live Fo call, one short look at a time (the 8.2 loop, cut into pieces that fit in a serverless request):
//   begin -> ask_fo with the brief
//   poll  -> ONE get_fo_reply (and, once Fo is on the call, ONE read of the conversation), then return
// The tick engine (engine.ts) calls poll again a minute later (or sooner). Nothing here waits for minutes.
import { askFo, getFoConversation, getFoReply, listFoConversations, type FoReply, type FoTurn } from "./fo-mcp";
import type { CallKind, CallRecord } from "./types";

export const WORKING_LIMIT_MS = 20 * 60_000; // Fo can work for 10+ minutes
export const SUMMARY_WAIT_MS = 10 * 60_000; // after "complete", wait up to 10 minutes for the call summary (8.6)

// The JSON keys each kind of call ends with. Fo's own JSON may use unquoted keys.
const KEYS: Record<CallKind, string[][]> = {
  provider: [["answered", "status"]],
  customer: [["confirmed", "preferred_option"]],
  booking: [["confirmed", "slot"]],
  reconfirm: [["reconfirmed"], ["can_make_it"]],
  arrival: [["arrived"], ["provider_gave_code"], ["code_digits"]],
  on_the_way: [["on_the_way"]],
};
const hasKey = (t: string, k: string) => new RegExp(`${k}["']?\\s*:`, "i").test(t);
/** True when the message carries the JSON this kind of call should end with. */
export const looksLikeSummary = (t: string, kind: CallKind) => KEYS[kind].some((set) => set.every((k) => hasKey(t, k)));
const endsWithJson = (t: string) => /\{[\s\S]*\}\s*(```)?\s*$/.test(t.trim());
export const looksLikeQuestion = (t: string) =>
  !endsWithJson(t) && (/\?\s*$/.test(t.trim()) || /\b(shall i|should i|do you want me to|say go|just say|confirm the intro|give the word)\b/i.test(t));

/** Fo says the call never happened ("This call couldn't be placed"). Nothing to wait for. */
export const couldNotPlace = (t: string) => /couldn['’]?t be placed|could not be placed|unable to place (the|this) call|call (was )?not placed/i.test(t);
/** Fo's JSON says the call was not completed (status "incomplete": cut off, or nothing usable was said). */
export const isIncomplete = (t: string) => /status["']?\s*:\s*["']?incomplete/i.test(t);
const INCOMPLETE_WHY = "Fo returned status 'incomplete': the call was cut off or nothing usable was said. It was NOT redialled; use Retry this step if you want another try.";

/** The reference tag put at the end of every brief, so a call whose start we lost can be found again in Fo's history. */
export const callMarker = (callId: string) => `HG-${callId}`;

export type Recovery =
  | { status: "wait" } // too early to say
  | { status: "found"; conversationId: string } // Fo has the request: follow it, never resend
  | { status: "lost" } // Fo's history shows NOTHING new since the call began: safe to try again
  | { status: "ambiguous" }; // Fo has newer conversations that we cannot match: a person must check

/**
 * The start of a live call was not confirmed (timeout, or the server stopped). The call may already be happening, so we must
 * NEVER send the request again. Look for it in Fo's history instead: every brief ends with an internal reference (HG-<call id>).
 */
export async function recoverLiveCall(call: CallRecord, api: FoApi = realApi): Promise<Recovery> {
  const started = new Date(call.started_at).getTime();
  const age = Date.now() - started;
  if (age < 45_000) return { status: "wait" }; // the original request may still be answering
  let items: { conversationId: string; channel?: string; startedAt: string }[] = [];
  try {
    const r = await api.listFoConversations();
    items = ((r.conversations ?? r.items ?? []) as typeof items) ?? [];
  } catch {
    return { status: "wait" }; // cannot see Fo's history right now: that is not proof of anything
  }
  const newer = items.filter((c) => new Date(c.startedAt).getTime() >= started - 15_000).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const marker = callMarker(call.id);
  for (const c of newer.filter((x) => (x.channel ?? "chat") === "chat").slice(0, 6)) {
    try {
      const turns = (await api.getFoConversation(c.conversationId)).turns;
      if (turns.some((t) => t.text.includes(marker))) return { status: "found", conversationId: c.conversationId };
    } catch { /* try the next one */ }
  }
  if (newer.length === 0) return age >= 5 * 60_000 ? { status: "lost" } : { status: "wait" };
  return age >= 10 * 60_000 ? { status: "ambiguous" } : { status: "wait" };
}

export type Polled =
  | { status: "working"; progress?: string }
  | { status: "waiting"; baseline: number } // Fo is on the call: the next NEW message from Fo is the summary
  | { status: "summary"; text: string }
  | { status: "question"; text: string }
  | { status: "failed"; error: string }
  | { status: "timeout"; text: string };

/** The three Fo tools we use. A test can pass a scripted stand-in, so the logic is checked without calling Fo. */
export interface FoApi {
  askFo: (message: string, opts?: { newConversation?: boolean; conversationId?: string }) => Promise<FoReply>;
  getFoReply: (conversationId: string, waitSeconds?: number) => Promise<FoReply>;
  getFoConversation: (conversationId: string) => Promise<{ turns: FoTurn[] }>;
  listFoConversations: () => Promise<Record<string, unknown>>;
}
const realApi: FoApi = { askFo, getFoReply, getFoConversation, listFoConversations };

const assistantTurns = async (api: FoApi, conversationId: string) => (await api.getFoConversation(conversationId)).turns.filter((t) => t.role === "assistant");

/** Send the brief to Fo. Returns the Fo conversation id and Fo's first progress line. */
export async function beginLiveCall(message: string, api: FoApi = realApi): Promise<{ conversationId: string; progress?: string }> {
  const r = await api.askFo(message, { newConversation: true });
  if (!r.conversationId) throw new Error("Fo did not return a conversation");
  return { conversationId: r.conversationId, progress: r.progress };
}

/** Send the operator's answer to a question Fo asked. */
export async function replyLiveCall(conversationId: string, answer: string, api: FoApi = realApi) {
  await api.askFo(answer, { conversationId });
}

/**
 * One look at a live call. `waitSeconds` is how long get_fo_reply may wait for Fo's next step (keep it short).
 * Anything new that Fo says after it started dialing and that is not a question is the call summary, with or without JSON.
 */
export async function pollLiveCall(call: CallRecord, waitSeconds: number, api: FoApi = realApi): Promise<Polled> {
  const conv = call.fo_conversation_id;
  const now = Date.now();
  if (!conv) return { status: "working" }; // the engine recovers a call with no conversation id (it never resends)

  if (call.status === "waiting_summary") {
    const baseline = call.meta?.baseline ?? 1;
    const waitingSince = call.meta?.waiting_since ? new Date(call.meta.waiting_since).getTime() : now;
    const reply = await api.getFoReply(conv, Math.max(1, Math.min(waitSeconds, 10)));
    const turns = await assistantTurns(api, conv);
    const newest = turns.length > baseline ? turns[turns.length - 1].text : "";
    // The last message too, even if it was already there when we counted (Fo can finish between our two reads): each call is its own conversation.
    const latest = turns.length ? turns[turns.length - 1].text : "";
    const texts = [newest, reply.response ?? "", latest].filter(Boolean);
    for (const text of texts) {
      if (looksLikeSummary(text, call.kind)) return isIncomplete(text) ? { status: "failed", error: INCOMPLETE_WHY } : { status: "summary", text };
    }
    // "couldn't be placed" is NOT final: Fo redials inside the same conversation. Keep reading it until a real result or the timeout.
    if (newest && !couldNotPlace(newest)) return looksLikeQuestion(newest) ? { status: "question", text: newest } : { status: "summary", text: newest };
    if (reply.response && looksLikeSummary(reply.response, call.kind)) return { status: "summary", text: reply.response };
    if (now - waitingSince > SUMMARY_WAIT_MS) return { status: "timeout", text: turns.length ? turns[turns.length - 1].text : "" };
    return { status: "working", progress: reply.progress };
  }

  // status "calling": Fo is still working on the request
  if (now - new Date(call.started_at).getTime() > WORKING_LIMIT_MS) return { status: "failed", error: "Fo is still working after 20 minutes" };
  const r = await api.getFoReply(conv, Math.max(1, waitSeconds));
  if (r.status === "working") return { status: "working", progress: r.progress };
  if (r.status === "failed") return { status: "failed", error: r.response ?? "Fo reported a failure" };
  const text = r.response ?? "";
  if (looksLikeSummary(text, call.kind) || (endsWithJson(text) && !looksLikeQuestion(text))) return isIncomplete(text) ? { status: "failed", error: INCOMPLETE_WHY } : { status: "summary", text };
  // "couldn't be placed" is Fo's first try failing; it redials in the same conversation, so follow it like any dialing call.
  if (!couldNotPlace(text) && looksLikeQuestion(text)) return { status: "question", text };
  // Fo says it is dialing or on the call. The next new message from Fo will be the summary.
  return { status: "waiting", baseline: (await assistantTurns(api, conv)).length };
}
