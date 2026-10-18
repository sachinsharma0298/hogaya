// npm run test:engine -> against a REHEARSAL server (never calls Fo):
//   PGLITE_DIR=memory FO_DRY_RUN=1 AGENT_MODE=real DEV_LOGIN=1 CRON_SECRET=test-secret MAX_REQUESTS_PER_USER_PER_DAY=50 PORT=3100 npm run start
// Walks bookings through the tick engine: manual clicks, Autopilot, the live-call line, flags, and the timer endpoint.
import assert from "node:assert/strict";

const B = process.env.BASE ?? "http://localhost:3100";
type R = { state: string; demo: boolean; awaiting_call?: string; matched: string[]; flags: { reason: string; resolved_at?: string }[]; booking?: { provider_id: string; arrival_code: string; reconfirmed_at?: string; bill?: unknown; arrival_verified_at?: string }; calls: { kind: string; status: string; demo?: boolean; summary_text?: string; json?: unknown; provider_id?: string }[]; events: { text: string }[] };
class Jar {
  c = new Map<string, string>();
  async j<T = Record<string, unknown>>(path: string, init: { method?: string; json?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { cookie: [...this.c].map(([k, v]) => `${k}=${v}`).join("; "), ...(init.headers ?? {}) };
    if (init.json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(B + path, { method: init.method ?? "GET", headers, body: init.json === undefined ? undefined : JSON.stringify(init.json), redirect: "manual" });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
  }
}
const login = async (body: Record<string, unknown>) => { const j = new Jar(); const r = await j.j("/api/auth/login", { method: "POST", json: { code: "123456", ...body } }); assert.equal(r.status, 200, JSON.stringify(r.body)); return j; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get = async (j: Jar, id: string) => (await j.j<{ request: R }>(`/api/requests/${id}`)).body.request;
async function until(j: Jar, id: string, what: string, ok: (r: R) => boolean, ms = 60_000) {
  const end = Date.now() + ms;
  let r = await get(j, id);
  while (!ok(r) && Date.now() < end) { await sleep(1500); r = await get(j, id); }
  assert.ok(ok(r), `${what} (state=${r.state}, flags=${JSON.stringify(r.flags.map((f) => f.reason))})`);
  return r;
}
const post = (j: Jar, id: string, path: string, json: unknown = {}) => j.j(`/api/requests/${id}/${path}`, { method: "POST", json });
const book = (j: Jar, o: Record<string, unknown>) => j.j<{ id: string; demo: boolean }>("/api/requests", { method: "POST", json: { category: "electrician", problem: "Fan not working", sector: "Sector 62", address: "Test address 1", time_window: "Today evening", consent: true, ...o } });

(async () => {
  // the timer endpoint
  const anon = new Jar();
  assert.equal((await anon.j("/api/tick", { method: "POST" })).status, 401);
  assert.equal((await anon.j("/api/tick", { method: "POST", headers: { authorization: "Bearer wrong" } })).status, 401);
  assert.equal((await anon.j("/api/tick", { method: "POST", headers: { authorization: "Bearer test-secret" } })).status, 200);
  console.log("ok  /api/tick: refuses strangers, accepts the timer's secret");

  const O = await login({ role: "operator", name: "Op" });
  const pro = await O.j<{ provider: { id: string } }>("/api/providers", { method: "POST", json: { name: "Test Electrician", phone: "6000001011", email: "pro@test.in", area: "Noida", visit_charge: "150", categories: ["electrician"], consent: true } });
  const pid = pro.body.provider.id;
  await O.j("/api/approved", { method: "POST", json: { kind: "customer", name: "Cust", phone: "6000000022", email: "cust@test.in", consent: true } });
  await O.j("/api/settings", { method: "POST", json: { autopilot: false } });
  const C = await login({ role: "customer", name: "Cust", phone: "6000000022", email: "cust@test.in" });

  // A. a simulated booking runs by itself while the customer watches
  const stranger = await login({ role: "customer", name: "Stranger", phone: "6000000033", email: "s@test.in" });
  const sim = await book(stranger, { name: "Stranger", phone: "6000000033", category: "geyser" });
  assert.equal(sim.body.demo, true);
  let r = await until(stranger, sim.body.id, "simulated booking reaches 'booked'", (x) => x.state === "booked");
  assert.ok(r.calls.every((c) => c.demo), "every call of a simulated booking is simulated");
  console.log("ok  A: a simulated booking runs start to finish by itself (no live calls)");

  // B. live (rehearsal) booking, Autopilot OFF: each live call waits for the operator
  const live = await book(C, { name: "Cust", phone: "6000000022" });
  assert.equal(live.body.demo, false);
  const id = live.body.id;
  r = await until(O, id, "waits for Call now", (x) => x.awaiting_call === pid);
  assert.equal(r.calls.length, 0);
  await sleep(3000);
  assert.equal((await get(O, id)).calls.length, 0, "no call without the click");
  assert.equal((await post(O, id, "call-now")).status, 200);
  r = await until(O, id, "provider call done and shortlist ready", (x) => x.state === "options_ready");
  assert.equal(r.calls.filter((c) => c.kind === "provider").length, 1);
  assert.ok(!r.calls[0].demo && r.calls[0].json, "the rehearsed live call produced JSON");
  await sleep(3000);
  assert.equal((await get(O, id)).calls.length, 1, "without Autopilot nothing else starts by itself");
  assert.equal((await post(O, id, "call-customer")).status, 200);
  r = await until(O, id, "customer chose", (x) => ["customer_chose", "booking_provider", "booked"].includes(x.state) || x.calls.some((c) => c.kind === "customer" && c.status === "done"));
  assert.equal((await post(O, id, "book-provider")).status, 200);
  r = await until(O, id, "booked", (x) => x.state === "booked");
  console.log("ok  B: with Autopilot OFF every live call waits for the operator's click, and the engine follows each call to its summary");

  // C. the new arrival flow: Pro says arrived, the customer confirms, the code is issued, the Pro submits it
  const P = await login({ role: "pro", provider_id: pid });
  assert.equal((await P.j(`/api/pro/jobs/${id}/arrive`, { method: "POST" })).status, 200);
  assert.equal((await C.j(`/api/requests/${id}/confirm-arrival`, { method: "POST", json: { arrived: true } })).status, 200);
  const code = (await get(C, id)).booking!.arrival_code;
  assert.match(code, /^\d{6}$/);
  assert.equal((await P.j(`/api/pro/jobs/${id}/code`, { method: "POST", json: { code: code === "000000" ? "111111" : "000000" } })).body.ok, false);
  assert.equal((await P.j(`/api/pro/jobs/${id}/code`, { method: "POST", json: { code } })).body.completed, true);
  console.log("ok  C: Pro arrives, customer confirms, code issued; a wrong code is refused and the right one completes");

  // D. Autopilot ON: a new live booking runs the whole way (provider, customer, booking calls) with no clicks, then T-60 reconfirm
  await O.j("/api/settings", { method: "POST", json: { autopilot: true } });
  const auto = await book(C, { name: "Cust", phone: "6000000022" });
  r = await until(O, auto.body.id, "Autopilot books by itself", (x) => x.state === "booked", 90_000);
  assert.deepEqual(r.calls.map((c) => c.kind), ["provider", "customer", "booking"]);
  assert.ok(r.calls.every((c) => !c.demo));
  assert.ok(r.booking?.provider_id === pid);
  assert.equal((await post(O, auto.body.id, "control", { action: "fast_forward" })).status, 200);
  r = await until(O, auto.body.id, "T-60 reconfirm runs by itself", (x) => x.state === "reconfirmed");
  console.log("ok  D: Autopilot ON runs provider, customer, booking and the T-60 reconfirm with no clicks");

  // E. the single live line: two bookings at once never have two live calls in flight
  const e1 = await book(C, { name: "Cust", phone: "6000000022" });
  const e2 = await book(C, { name: "Cust", phone: "6000000022" });
  let maxInFlight = 0;
  for (let i = 0; i < 25; i++) {
    const all = await O.j<{ requests: R[] }>("/api/requests");
    const n = all.body.requests.reduce((a, x) => a + x.calls.filter((c) => !c.demo && ["calling", "waiting_summary", "needs_reply"].includes(c.status)).length, 0);
    maxInFlight = Math.max(maxInFlight, n);
    if ([e1, e2].every((e) => all.body.requests.find((x) => (x as unknown as { id: string }).id === e.body.id)?.state === "booked")) break;
    await sleep(1500);
  }
  assert.ok(maxInFlight <= 1, `max live calls in flight was ${maxInFlight}`);
  await until(O, e1.body.id, "first queued booking books", (x) => x.state === "booked", 90_000);
  await until(O, e2.body.id, "second queued booking books", (x) => x.state === "booked", 90_000);
  console.log(`ok  E: two live bookings at once: at most ${maxInFlight} live call in flight, and both finish`);

  // F. Claude fails: the booking is flagged, Fo's summary stays visible, nothing crashes
  const f = await book(C, { name: "Cust", phone: "6000000022", problem: "Fan broken [claude-fail]" });
  r = await until(O, f.body.id, "flagged when Claude fails", (x) => x.flags.some((fl) => /Claude could not read/.test(fl.reason)), 60_000);
  const bad = r.calls.find((c) => c.status === "needs_review");
  assert.ok(bad && bad.summary_text && !bad.json, "call is 'needs_review' with Fo's summary kept and no JSON");
  assert.equal(r.state, "flagged");
  console.log("ok  F: if Claude fails the booking is flagged and Fo's summary is shown, not lost");

  // G. pause stops new calls
  await O.j("/api/settings", { method: "POST", json: { autopilot: true } });
  const g = await book(C, { name: "Cust", phone: "6000000022" });
  assert.equal((await post(O, g.body.id, "control", { action: "pause" })).status, 200);
  await sleep(5000);
  r = await get(O, g.body.id);
  assert.equal(r.state, "paused");
  assert.ok(r.calls.filter((c) => c.status === "calling").length <= 1);
  assert.equal((await post(O, g.body.id, "control", { action: "cancel" })).status, 200);
  console.log("ok  G: a paused booking does not move; cancel works");
  await O.j("/api/settings", { method: "POST", json: { autopilot: false } });
  console.log("ALL PASSED");
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
