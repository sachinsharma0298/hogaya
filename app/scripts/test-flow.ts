// npm run test:flow -> the whole booking flow with MOCK calls only. Never calls anyone.
// Needs two local servers (see the commands in the header of scripts/run-flow-tests.sh):
//   REHEARSAL (BASE, port 3100): FO_DRY_RUN=1 AGENT_MODE=real  -> live-style booking, mock calls, a real Pro account for the Pro steps
//   SIMULATED (DEMO_BASE, port 3000): AGENT_MODE=demo          -> "Demo: simulated calls" bookings (what a stranger gets)
import assert from "node:assert/strict";
import { DICTS } from "../src/lib/translations";

const BASE = process.env.BASE ?? "http://localhost:3100";
const DEMO = process.env.DEMO_BASE ?? "http://localhost:3000";
type Call = { kind: string; status: string; demo?: boolean; json?: Record<string, unknown>; meta?: { recipient?: string; attempt?: number }; provider_id?: string };
type R = { id: string; state: string; demo: boolean; matched: string[]; flags: { reason: string; resolved_at?: string }[]; events: { text: string }[]; calls: Call[]; awaiting_call?: string;
  booking?: { provider_id: string; arrival_code: string; reconfirmed_at?: string; on_the_way_at?: string; pro_arrived_at?: string; arrival_verified_at?: string; outcome?: string; job_done_at?: string; code_attempts?: number; code_expires_at?: string; ranking?: { stars: number }; rating?: unknown } };
class Jar {
  c = new Map<string, string>();
  constructor(public base: string) {}
  async j<T = Record<string, unknown>>(path: string, init: { method?: string; json?: unknown } = {}) {
    const headers: Record<string, string> = { cookie: [...this.c].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (init.json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(this.base + path, { method: init.method ?? "GET", headers, body: init.json === undefined ? undefined : JSON.stringify(init.json), redirect: "manual" });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
  }
}
const login = async (base: string, body: Record<string, unknown>) => { const j = new Jar(base); const r = await j.j("/api/auth/login", { method: "POST", json: { code: "123456", ...body } }); assert.equal(r.status, 200, JSON.stringify(r.body)); return j; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get = async (j: Jar, id: string) => (await j.j<{ request: R }>(`/api/requests/${id}`)).body.request;
async function until(j: Jar, id: string, what: string, ok: (r: R) => boolean, ms = 90_000) {
  const end = Date.now() + ms; let r = await get(j, id);
  while (!ok(r) && Date.now() < end) {
    // Live-style bookings are moved by the one-minute timer in real life (and by the open console): do what the timer does.
    if (j.base === BASE) await fetch(`${BASE}/api/tick`, { method: "POST", headers: { authorization: "Bearer test-secret" } }).catch(() => {});
    await sleep(1500); r = await get(j, id);
  }
  assert.ok(ok(r), `${what} (state=${r.state}; flags=${JSON.stringify(r.flags.filter((f) => !f.resolved_at).map((f) => f.reason))}; calls=${r.calls.map((c) => c.kind + ":" + c.status).join(",")}; last events=${r.events.slice(-4).map((e) => e.text).join(" / ")})`);
  return r;
}
const post = (j: Jar, id: string, path: string, json: unknown = {}) => j.j(`/api/requests/${id}/${path}`, { method: "POST", json });
const book = (j: Jar, o: Record<string, unknown>) => j.j<{ id: string; demo: boolean }>("/api/requests", { method: "POST", json: { category: "electrician", problem: "Fan not working", sector: "Sector 62", address: "Test address 1", time_window: "Today evening", consent: true, ...o } });
let passed = 0;
const ok = (msg: string) => { passed++; console.log("ok  " + msg); };

async function simulated() {
  const S = await login(DEMO, { role: "customer", name: "Stranger", phone: "6000000033", email: "s@test.in" });
  const O = await login(DEMO, { role: "operator", name: "Op" });
  const mk = async (tag: string, cat = "geyser") => (await book(S, { category: cat, problem: `Geyser issue ${tag}`, name: "Stranger", phone: "6000000033" })).body.id;

  // the mock-call log: recipients, attempts, outcomes
  let id = await mk("");
  let r = await until(S, id, "simulated booking reaches booked", (x) => x.state === "booked");
  assert.ok(r.demo && r.calls.every((c) => c.demo), "every call is simulated");
  assert.deepEqual(r.calls.map((c) => c.kind), ["provider", "provider", "customer", "booking"]);
  assert.deepEqual(r.calls.map((c) => c.meta?.recipient), ["pro", "pro", "customer", "pro"]);
  assert.ok(r.calls.every((c) => c.meta?.attempt === 1));
  assert.equal(r.booking?.arrival_code, "", "no code exists yet");
  ok("steps 1-6 (mock): provider calls, customer call, booking call; recipients and attempt numbers are logged; no code yet");

  // final hour: one reminder call, then one confirmation call
  assert.equal((await post(O, id, "control", { action: "fast_forward" })).status, 200);
  r = await until(O, id, "reminder/reconfirm call done", (x) => x.state === "reconfirmed");
  assert.equal(r.calls.filter((c) => c.kind === "reconfirm").length, 1);
  assert.equal(r.calls.filter((c) => c.kind === "on_the_way").length, 0, "the confirmation call is NOT made at the same time as the reminder");
  assert.equal((await post(O, id, "control", { action: "fast_forward_confirm" })).status, 200);
  r = await until(O, id, "confirmation call done", (x) => !!x.booking?.on_the_way_at);
  assert.equal(r.calls.filter((c) => c.kind === "reconfirm").length, 1);
  assert.equal(r.calls.filter((c) => c.kind === "on_the_way").length, 1);
  assert.deepEqual(r.calls.filter((c) => ["reconfirm", "on_the_way"].includes(c.kind)).map((c) => c.kind), ["reconfirm", "on_the_way"]);
  await sleep(4000);
  r = await get(O, id);
  assert.equal(r.calls.filter((c) => c.kind === "on_the_way").length, 1, "exactly one confirmation call, never a second");
  ok("step 7: exactly one reminder call (T-60) followed by exactly one confirmation call (T-30)");

  // negatives with scripted mock outcomes
  id = await mk("[mock:pro_no_answer]");
  r = await until(O, id, "provider no answer exhausts retries", (x) => x.state === "flagged" || x.flags.some((f) => /No provider confirmed/.test(f.reason)), 120_000);
  const pc = r.calls.filter((c) => c.kind === "provider");
  const perPro = new Map<string, number>(); pc.forEach((c) => perPro.set(c.provider_id!, (perPro.get(c.provider_id!) ?? 0) + 1));
  assert.ok([...perPro.values()].every((n) => n === 4) && perPro.size === 2, `4 calls to each Pro, got ${JSON.stringify([...perPro.values()])}`);
  assert.ok(pc.every((c) => (c.json as { status?: string }).status === "no_reply"));
  assert.ok(r.flags.some((f) => /no answer after 4 tries/.test(f.reason)));
  ok("negative: Pro never answers -> exactly 4 calls per Pro, then a flag (retries exhausted)");

  id = await mk("[mock:pro_declines]");
  r = await until(O, id, "Pro declines -> flagged", (x) => x.flags.some((f) => /No provider confirmed/.test(f.reason)), 60_000);
  assert.equal(r.calls.filter((c) => c.kind === "provider").length, 2, "a clear 'no' is not retried");
  ok("negative: declined confirmation by the Pro -> no retries on a clear 'no', booking flagged");

  id = await mk("[mock:customer_no_answer]");
  r = await until(O, id, "customer retries exhaust", (x) => x.flags.some((f) => /no clear answer after 4 tries/.test(f.reason)), 120_000);
  assert.equal(r.calls.filter((c) => c.kind === "customer").length, 4);
  assert.ok(!r.booking);
  ok("negative: customer never answers -> exactly 4 customer calls, then a flag, nothing booked");

  id = await mk("[mock:customer_declines]");
  r = await until(O, id, "customer declines -> flagged", (x) => x.flags.some((f) => /declined every option/.test(f.reason)), 90_000);
  assert.equal(r.calls.filter((c) => c.kind === "customer").length, 1);
  assert.ok(!r.booking);
  ok("negative: customer declines -> 1 call, flagged, nothing booked");

  id = await mk("[mock:booking_declines]");
  r = await until(O, id, "booking declined -> flagged", (x) => x.flags.some((f) => /declined the booking/.test(f.reason)), 90_000);
  assert.ok(!r.booking);
  ok("negative: the Pro declines at the booking call -> flagged, nothing booked");

  // cancellation: no calls after cancel
  id = await mk("");
  await until(O, id, "calls started", (x) => x.calls.length >= 1);
  assert.equal((await post(O, id, "control", { action: "cancel" })).status, 200);
  await sleep(1500); const n1 = (await get(O, id)).calls.length;
  await sleep(8000); r = await get(O, id);
  assert.equal(r.state, "cancelled"); assert.equal(r.calls.length, n1, "no new call after cancel"); assert.ok(!r.booking);
  assert.equal((await post(O, id, "control", { action: "resume" })).status, 409, "a cancelled booking cannot be resumed");
  ok("cancellation: state cancelled, no further calls, no booking, cannot be resumed");
}

async function rehearsal() {
  const O = await login(BASE, { role: "operator", name: "Op" });
  const pro = (await O.j<{ provider: { id: string } }>("/api/providers", { method: "POST", json: { name: "Test Electrician", phone: "6000001011", email: "pro@test.in", area: "Noida", visit_charge: "150", categories: ["electrician"], consent: true } })).body.provider.id;
  const pro2 = (await O.j<{ provider: { id: string } }>("/api/providers", { method: "POST", json: { name: "Other Electrician", phone: "6000001012", email: "pro2@test.in", area: "Noida", visit_charge: "150", categories: ["electrician"], consent: true } })).body.provider.id;
  await O.j("/api/approved", { method: "POST", json: { kind: "customer", name: "Cust", phone: "6000000022", email: "cust@test.in", consent: true } });
  await O.j("/api/settings", { method: "POST", json: { autopilot: true } });
  const C = await login(BASE, { role: "customer", name: "Cust", phone: "6000000022", email: "cust@test.in" });
  const Cb = await login(BASE, { role: "customer", name: "Other", phone: "6000000044", email: "other@test.in" });
  const P = await login(BASE, { role: "pro", provider_id: pro });
  const P2 = await login(BASE, { role: "pro", provider_id: pro2 });
  const reliability = async (id: string) => (await O.j<{ providers: { id: string; reliability: number; jobs: number }[] }>("/api/requests")).body.providers.find((p) => p.id === id)!;
  // pin every booking to ONE Pro (the operator assignment) so the Pro steps can be driven
  const live = async (extra: Record<string, unknown> = {}, assign = pro) => {
    await O.j("/api/settings", { method: "POST", json: { autopilot: false } });
    const id = (await book(C, { name: "Cust", phone: "6000000022", ...extra })).body.id;
    await until(O, id, "waits for the operator's click", (x) => x.awaiting_call !== undefined || x.calls.length > 0);
    assert.equal((await post(O, id, "assign", { provider_id: assign })).status, 200);
    await O.j("/api/settings", { method: "POST", json: { autopilot: true } });
    return id;
  };
  const toBooked = async (id: string) => { const r = await until(O, id, "booked by autopilot", (x) => x.state === "booked", 120_000); return r; };

  // ---- the full flow, step by step
  const before = await reliability(pro);
  const id = await live();
  let r = await toBooked(id);
  assert.ok(!r.demo && r.calls.every((c) => !c.demo || c.kind === "on_the_way"));
  assert.deepEqual(r.calls.map((c) => c.kind), ["provider", "customer", "booking"]);
  assert.equal(r.booking?.provider_id, pro);
  const cv = await get(C, id);
  assert.equal(cv.booking?.arrival_code, "", "step 6: the customer has no code before the arrival is confirmed");
  ok("steps 1-6: booking -> provider call -> customer call -> booking call -> booked (mock calls, assigned Pro)");

  // too early / wrong actor
  assert.equal((await P.j(`/api/pro/jobs/${id}/code`, { method: "POST", json: { code: "123456" } })).status, 409, "code before arrival");
  assert.equal((await post(C, id, "confirm-arrival", { arrived: true })).status, 409, "customer cannot confirm before the Pro says arrived");
  assert.equal((await P2.j(`/api/pro/jobs/${id}/arrive`, { method: "POST" })).status, 403, "another Pro cannot act on this job");
  assert.equal((await C.j(`/api/pro/jobs/${id}/arrive`, { method: "POST" })).status, 403, "a customer is not a Pro");
  assert.equal((await post(Cb, id, "confirm-arrival", { arrived: true })).status, 404, "another customer cannot touch this booking");
  ok("negative: wrong actor or wrong order is refused (code before arrival, confirm before arrive, other Pro, customer as Pro, other customer)");

  // final hour
  await post(O, id, "control", { action: "fast_forward" });
  r = await until(O, id, "reminder call", (x) => x.state === "reconfirmed");
  await post(O, id, "control", { action: "fast_forward_confirm" });
  r = await until(O, id, "confirmation call", (x) => !!x.booking?.on_the_way_at);
  assert.deepEqual(r.calls.filter((c) => ["reconfirm", "on_the_way"].includes(c.kind)).map((c) => c.kind), ["reconfirm", "on_the_way"]);
  ok("step 7: one reminder call then one confirmation call");

  // steps 8-10
  assert.equal((await P.j(`/api/pro/jobs/${id}/arrive`, { method: "POST" })).status, 200);
  assert.equal((await P.j<{ already?: boolean }>(`/api/pro/jobs/${id}/arrive`, { method: "POST" })).body.already, true);
  r = await get(O, id); assert.equal(r.state, "pro_arrived");
  ok("step 8: the Pro confirms arrival (pressing twice changes nothing); state pro_arrived");
  const proJob = async () => (await P.j<{ jobs: { id: string; status: string; completed: boolean; can_enter_code: boolean; can_confirm_arrival: boolean }[] }>("/api/pro/jobs")).body.jobs.find((j) => j.id === id)!;
  assert.equal((await proJob()).status, "pro_arrived"); assert.equal((await proJob()).can_enter_code, false);
  assert.equal((await post(C, id, "confirm-arrival", { arrived: true })).status, 200);
  const again = await post(C, id, "confirm-arrival", { arrived: true });
  assert.equal(again.status, 200);
  r = await get(O, id); const code = r.booking!.arrival_code;
  assert.equal(r.state, "arrived"); assert.match(code, /^\d{6}$/);
  assert.equal((await get(C, id)).booking?.arrival_code, code, "the customer sees the code");
  assert.equal(r.calls.length, 5, "no extra call was caused");
  ok("steps 9-10: the customer confirms the arrival (twice = one code), a unique 6-digit code is issued and shown to the customer");
  assert.equal((await proJob()).can_enter_code, true);

  // step 11-12: wrong code, then right code, then duplicate
  const wrong = code === "000000" ? "111111" : "000000";
  const bad = await P.j<{ ok: boolean; attemptsLeft: number }>(`/api/pro/jobs/${id}/code`, { method: "POST", json: { code: wrong } });
  assert.equal(bad.body.ok, false); assert.equal(bad.body.attemptsLeft, 4);
  assert.ok((await get(O, id)).flags.some((f) => /Wrong completion code/.test(f.reason) && !f.resolved_at));
  const [a, b2] = await Promise.all([1, 2].map(() => P.j<{ ok: boolean; completed: boolean }>(`/api/pro/jobs/${id}/code`, { method: "POST", json: { code } })));
  assert.ok(a.body.completed && b2.body.completed);
  r = await get(O, id);
  assert.equal(r.state, "completed"); assert.equal(r.booking?.outcome, "completed");
  assert.equal(r.events.filter((e) => /submitted the right completion code/.test(e.text)).length, 1, "completed exactly once");
  const after = await reliability(pro);
  assert.equal(after.jobs, before.jobs + 1, "reliability updated exactly once, even with two simultaneous submits");
  assert.ok(!r.flags.some((f) => !f.resolved_at), "the wrong-code flag was settled by the right code");
  assert.equal((await P.j<{ already?: boolean }>(`/api/pro/jobs/${id}/code`, { method: "POST", json: { code } })).body.already, true);
  ok("steps 11-12: wrong code counted (4 left) and flagged; the right code completes; two simultaneous submits and a later one complete it only once");

  // step 13-15: both interfaces
  assert.equal(DICTS.en["b.done.final"], "Booking done, task Hogaya.");
  assert.equal(DICTS.en["pa.closed"], "Booking closed, booking completed.");
  const pj = await proJob(); assert.ok(pj.completed && pj.status === "completed");
  const cvf = await get(C, id); assert.equal(cvf.state, "completed"); assert.equal(cvf.booking?.outcome, "completed");
  assert.equal((await post(C, id, "rating", { stars: 5, feedback: "great" })).status, 200);
  assert.equal((await get(C, id)).state, "closed");
  ok('steps 13-15: customer page is completed ("Booking done, task Hogaya.") and the Pro job is completed ("Booking closed, booking completed."); rating closes the booking');

  // step 16: operator ranking
  const id2 = await live({ problem: "Second job" });
  assert.equal((await post(O, id2, "rank", { stars: 4 })).status, 409, "cannot rank before completion");
  assert.equal((await post(O, id, "rank", { stars: 9 })).status, 400);
  assert.equal((await post(C, id, "rank", { stars: 4 })).status, 403, "only the operator ranks");
  assert.equal((await post(O, id, "rank", { stars: 4, note: "on time" })).status, 200);
  assert.equal((await get(O, id)).booking?.ranking?.stars, 4);
  ok("step 16: the operator can rank only a completed job (1-5); customers cannot");

  // ---- negatives on the completion code (booking 2, already booked)
  await toBooked(id2);
  await P.j(`/api/pro/jobs/${id2}/arrive`, { method: "POST" });
  assert.equal((await post(C, id2, "confirm-arrival", { arrived: false })).status, 200);
  r = await get(O, id2);
  assert.ok(!r.booking?.pro_arrived_at && ["booked", "reconfirmed"].includes(r.state) || r.state === "flagged", `denied arrival goes back (state ${r.state})`);
  assert.ok(r.flags.some((f) => /customer says they have not/i.test(f.reason)));
  await post(O, id2, "control", { action: "clear_flags" });
  await P.j(`/api/pro/jobs/${id2}/arrive`, { method: "POST" });
  assert.equal((await post(C, id2, "confirm-arrival", { arrived: true })).status, 200);
  const code2 = (await get(O, id2)).booking!.arrival_code;
  const w2 = code2 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await P.j(`/api/pro/jobs/${id2}/code`, { method: "POST", json: { code: w2 } });
  assert.equal((await P.j(`/api/pro/jobs/${id2}/code`, { method: "POST", json: { code: code2 } })).status, 423, "locked after 5 wrong codes, even for the right code");
  assert.equal((await post(O, id2, "control", { action: "new_code" })).status, 200);
  const code2b = (await get(O, id2)).booking!.arrival_code;
  assert.notEqual(code2b, code2);
  assert.equal((await P.j(`/api/pro/jobs/${id2}/code`, { method: "POST", json: { code: code2 } })).body.ok, false, "the old code no longer works");
  assert.equal((await post(O, id2, "control", { action: "expire_code" })).status, 200);
  assert.equal((await P.j(`/api/pro/jobs/${id2}/code`, { method: "POST", json: { code: code2b } })).status, 410, "expired code");
  assert.equal((await post(O, id2, "control", { action: "new_code" })).status, 200);
  const code2c = (await get(O, id2)).booking!.arrival_code;
  assert.equal((await P.j(`/api/pro/jobs/${id2}/code`, { method: "POST", json: { code: code2c } })).body.completed, true);
  assert.equal((await get(O, id2)).state, "completed");
  ok("negative: customer can deny the arrival (booking goes back, flagged); 5 wrong codes lock; the old code dies when replaced; an expired code is refused (410); the operator's new code completes it");

  // ---- operator assignment, retry safety, authorization
  await O.j("/api/settings", { method: "POST", json: { autopilot: false } });
  const id3 = (await book(C, { name: "Cust", phone: "6000000022", problem: "Third job" })).body.id;
  await until(O, id3, "awaiting click", (x) => x.awaiting_call !== undefined);
  assert.equal((await post(O, id3, "assign", { provider_id: "p-nope" })).status, 400, "unknown Pro refused");
  assert.equal((await post(Cb, id3, "assign", { provider_id: pro })).status, 403, "a customer cannot assign");
  assert.equal((await post(O, id3, "assign", { provider_id: pro2 })).status, 200);
  r = await get(O, id3); assert.deepEqual(r.matched, [pro2]); assert.ok(r.events.some((e) => /Operator assigned/.test(e.text)));
  ok("operator: can assign a specific Pro (unknown Pro and customers refused)");
  // safe retries: hammer call-now + retry; never two calls in flight, never more than 4 calls to the Pro
  await until(O, id3, "awaiting click for the assigned Pro", (x) => x.awaiting_call === pro2);
  await Promise.all([post(O, id3, "call-now"), post(O, id3, "control", { action: "retry" }), post(O, id3, "control", { action: "retry" }), post(O, id3, "control", { action: "retry" })]);
  let maxIn = 0;
  for (let i = 0; i < 12; i++) { const x = await get(O, id3); maxIn = Math.max(maxIn, x.calls.filter((c) => ["calling", "waiting_summary", "needs_reply"].includes(c.status)).length); await sleep(1000); }
  r = await get(O, id3);
  assert.ok(maxIn <= 1, `in flight at once: ${maxIn}`); assert.ok(r.calls.filter((c) => c.kind === "provider").length <= 4);
  assert.ok(new Set(r.calls.map((c) => `${c.kind}:${c.meta?.attempt}:${c.provider_id}`)).size === r.calls.length, "no duplicated call (same kind, attempt and person)");
  ok("retry safety: repeated clicks never start two calls at once and never duplicate a call or a booking");

  // ---- a timeout is NOT proof that no call was placed: never resend, recover, retry only when sure
  await O.j("/api/settings", { method: "POST", json: { autopilot: true } });
  const idT = await live({ problem: "Fan broken [mock:ask_timeout]" });
  r = await until(O, idT, "found after a timeout and booked", (x) => x.state === "booked", 120_000);
  assert.equal(r.calls.filter((c) => c.kind === "provider").length, 1, "the request was NOT sent a second time");
  assert.ok(r.events.some((e) => /found the call in Fo's history/.test(e.text)));
  ok("timeout, Fo has it: marked 'may be in progress', found again, followed to the end, and sent exactly ONCE (never resent)");

  const idL = await live({ problem: "Fan broken [mock:ask_timeout_lost]" });
  r = await until(O, idL, "lost start retried", (x) => x.calls.filter((c) => c.kind === "provider").length >= 2, 120_000);
  const first = r.calls.filter((c) => c.kind === "provider")[0];
  assert.equal(first.status, "failed"); assert.ok(r.events.some((e) => /no call was placed, so it is safe to try again/.test(e.text)));
  const attemptsSeen = r.calls.filter((c) => c.kind === "provider").map((c) => c.meta?.attempt);
  assert.deepEqual(attemptsSeen.slice(0, 2), [1, 2]);
  await post(O, idL, "control", { action: "cancel" });
  ok("timeout, Fo's history proves nothing was placed: only THEN is the attempt retried");

  const idU = await live({ problem: "Fan broken [mock:ask_timeout_unknown]" });
  r = await until(O, idU, "unclear start waits for a person", (x) => x.calls.some((c) => c.status === "unconfirmed") && x.flags.some((f) => /cannot tell whether/.test(f.reason)), 60_000);
  await sleep(6000);
  r = await get(O, idU);
  assert.equal(r.calls.filter((c) => c.kind === "provider").length, 1, "an unclear start is never retried by itself");
  assert.equal((await post(Cb, idU, "control", { action: "clear_unconfirmed" })).status, 403);
  assert.equal((await post(O, idU, "control", { action: "clear_unconfirmed" })).status, 200);
  r = await until(O, idU, "retry only after the operator checked", (x) => x.calls.filter((c) => c.kind === "provider").length >= 2, 150_000);
  assert.equal(r.calls.filter((c) => c.kind === "provider")[0].status, "failed");
  await post(O, idU, "control", { action: "cancel" });
  ok("timeout, cannot tell: never retried by itself; flagged; retried only after the operator says 'I checked Fo: no call was placed'");

  // authorization
  for (const [m, p] of [["POST", `/api/requests/${id}/rank`], ["POST", `/api/requests/${id}/assign`], ["POST", `/api/requests/${id}/control`]] as const) assert.equal((await P.j(p, { method: m, json: {} })).status, 403, `Pro on ${p}`);
  assert.equal((await Cb.j(`/api/requests/${id}`)).status, 404);
  assert.equal((await P.j("/api/operator/accounts")).status, 403);
  assert.equal((await C.j("/api/operator/accounts")).status, 403);
  assert.equal((await new Jar(BASE).j("/api/operator/accounts")).status, 401);
  assert.equal((await new Jar(BASE).j("/api/auth/register", { method: "POST", json: { name: "x", email: "x@y.in", phone: "6000000099", password: "longenough1" } })).status, 503, "registration is off without Supabase");
  ok("authorization: Pros and customers cannot use operator routes; strangers see nothing; accounts API is operator-only");

  // the operator can book as a customer
  const opBook = await book(O, { name: "Op Customer", phone: "6000000055" });
  assert.equal(opBook.status, 200);
  const mine = await O.j<{ bookings: { id: string }[] }>("/api/me/bookings");
  assert.ok(mine.body.bookings.some((b) => b.id === opBook.body.id));
  ok("the operator can book as a customer and sees their own bookings in /me");
}

(async () => {
  const which = process.argv[2];
  if (which !== "rehearsal") await simulated();
  if (which !== "simulated") await rehearsal();
  console.log(`ALL PASSED (${passed} groups)`);
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
