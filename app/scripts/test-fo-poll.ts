// npm run test:fo-poll -> checks how the engine follows a live Fo call, using a scripted stand-in for Fo. No network, no calls.
import assert from "node:assert/strict";
import { beginLiveCall, callMarker, pollLiveCall, recoverLiveCall, SUMMARY_WAIT_MS, WORKING_LIMIT_MS, type FoApi } from "../src/lib/fo-poll";
import type { CallRecord } from "../src/lib/types";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const call = (o: Partial<CallRecord> = {}): CallRecord => ({ id: "c", kind: "provider", status: "calling", started_at: ago(1000), fo_conversation_id: "conv-1", ...o });
const fake = (o: { reply?: Partial<{ status: "working" | "complete" | "failed"; response: string; progress: string }>; turns?: string[] }): FoApi => ({
  askFo: async () => ({ status: "working", conversationId: "conv-1", progress: "Starting" }),
  getFoReply: async () => ({ status: "complete", ...(o.reply ?? {}) }),
  getFoConversation: async () => ({ turns: (o.turns ?? []).map((text) => ({ role: "assistant", text })) }),
  listFoConversations: async () => ({ conversations: [] }),
});
const SUMMARY = "Ramesh can come at 6 PM. {answered: true, status: confirmed}";

(async () => {
  assert.deepEqual(await beginLiveCall("brief", fake({})), { conversationId: "conv-1", progress: "Starting" });
  assert.equal((await pollLiveCall(call(), 5, fake({ reply: { status: "working", progress: "Dialing" } }))).status, "working");
  assert.equal((await pollLiveCall(call(), 5, fake({ reply: { status: "failed", response: "boom" } }))).status, "failed");
  console.log("ok  working and failed Fo replies");

  // Fo says it is dialing: remember how many messages exist, the next new one is the summary
  const dialing = await pollLiveCall(call(), 5, fake({ reply: { response: "I'm dialing Ramesh now." }, turns: ["Starting.", "I'm dialing Ramesh now."] }));
  assert.deepEqual(dialing, { status: "waiting", baseline: 2 });
  // still nothing new
  assert.equal((await pollLiveCall(call({ status: "waiting_summary", meta: { baseline: 2, waiting_since: ago(60_000) } }), 5, fake({ reply: { response: "I'm dialing Ramesh now." }, turns: ["Starting.", "I'm dialing Ramesh now."] }))).status, "working");
  // a new message with no JSON is still the summary (Fo's JSON format is never relied on)
  const plain = await pollLiveCall(call({ status: "waiting_summary", meta: { baseline: 2, waiting_since: ago(60_000) } }), 5, fake({ turns: ["a", "b", "Ramesh said yes, he will come at sawa chhe."] }));
  assert.deepEqual(plain, { status: "summary", text: "Ramesh said yes, he will come at sawa chhe." });
  const withJson = await pollLiveCall(call({ status: "waiting_summary", meta: { baseline: 2 } }), 5, fake({ turns: ["a", "b", SUMMARY] }));
  assert.equal(withJson.status, "summary");
  console.log("ok  dialing -> waiting for a NEW message -> summary (with or without JSON)");

  // summary straight away
  assert.equal((await pollLiveCall(call(), 5, fake({ reply: { response: SUMMARY }, turns: ["x", SUMMARY] }))).status, "summary");
  // a question instead of calling
  assert.equal((await pollLiveCall(call(), 5, fake({ reply: { response: "Shall I dial now?" }, turns: ["Shall I dial now?"] }))).status, "question");
  assert.equal((await pollLiveCall(call({ status: "waiting_summary", meta: { baseline: 1 } }), 5, fake({ turns: ["a", "Do you want me to retry the number?"] }))).status, "question");
  console.log("ok  questions from Fo are passed to the operator");

  // timeouts
  const late = await pollLiveCall(call({ status: "waiting_summary", meta: { baseline: 2, waiting_since: ago(SUMMARY_WAIT_MS + 5000) } }), 5, fake({ turns: ["a", "b"] }));
  assert.equal(late.status, "timeout");
  const stuck = await pollLiveCall(call({ started_at: ago(WORKING_LIMIT_MS + 5000) }), 5, fake({ reply: { status: "working" } }));
  assert.equal(stuck.status, "failed");
  assert.equal((await pollLiveCall(call({ fo_conversation_id: undefined, started_at: ago(400_000) }), 5, fake({}))).status, "working"); // polling never decides a lost start: recovery does
  console.log("ok  10-minute summary timeout and 20-minute working limit");

  // ---- a call whose start was never confirmed: found again in Fo's history, never resent
  const sentMessages: string[] = [];
  const hist = (convs: { id: string; channel: string; ago: number; text?: string }[]): FoApi => ({
    askFo: async (m) => { sentMessages.push(m); return { status: "working", conversationId: "x" }; },
    getFoReply: async () => ({ status: "complete" }),
    getFoConversation: async (id) => ({ turns: [{ role: "user", text: convs.find((c) => c.id === id)?.text ?? "" }] }),
    listFoConversations: async () => ({ conversations: convs.map((c) => ({ conversationId: c.id, channel: c.channel, startedAt: ago(c.ago) })) }),
  });
  const lost = call({ id: "c-abc", fo_conversation_id: undefined, started_at: ago(120_000) });
  assert.equal((await recoverLiveCall(call({ id: "c-abc", fo_conversation_id: undefined, started_at: ago(10_000) }), hist([]))).status, "wait", "too early to say");
  const found = await recoverLiveCall(lost, hist([{ id: "other", channel: "chat", ago: 60_000, text: "something else" }, { id: "mine", channel: "chat", ago: 100_000, text: `Please call ... ${callMarker("c-abc")}` }, { id: "v", channel: "voice", ago: 50_000 }]));
  assert.deepEqual(found, { status: "found", conversationId: "mine" });
  assert.equal((await recoverLiveCall(lost, hist([]))).status, "wait", "nothing in Fo's history yet, but only 2 minutes: not sure enough to retry");
  assert.equal((await recoverLiveCall(call({ id: "c-abc", fo_conversation_id: undefined, started_at: ago(6 * 60_000) }), hist([{ id: "old", channel: "chat", ago: 3_600_000, text: "an hour ago" }]))).status, "lost", "after 5 minutes with nothing new in Fo's history: safe to retry");
  assert.equal((await recoverLiveCall(call({ id: "c-abc", fo_conversation_id: undefined, started_at: ago(11 * 60_000) }), hist([{ id: "u", channel: "chat", ago: 300_000, text: "unrelated chat" }]))).status, "ambiguous", "something new but not ours: a person must check");
  assert.equal((await recoverLiveCall(lost, { ...hist([]), listFoConversations: async () => { throw new Error("down"); } })).status, "wait", "if Fo's history cannot be read, that proves nothing");
  assert.equal(sentMessages.length, 0, "recovery never sends anything to Fo");
  console.log("ok  lost start: found by its reference tag; 'safe to retry' only after 5 minutes with nothing new in Fo's history; unclear cases wait for a person; recovery never sends a message");
  console.log("ALL PASSED");
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
