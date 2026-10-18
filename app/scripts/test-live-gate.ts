// npm run test:live-gate -> start a REHEARSAL server first (it never calls Fo):
//   PGLITE_DIR=memory FO_DRY_RUN=1 AGENT_MODE=real DEV_LOGIN=1 PORT=3100 npm run start
// then run with BASE=http://localhost:3100. Checks who gets live (rehearsed) calls and who gets "Demo: simulated calls".
import assert from "node:assert/strict";

const B = process.env.BASE ?? "http://localhost:3100";
class Jar {
  c = new Map<string, string>();
  async f(path: string, init: { method?: string; json?: unknown } = {}) {
    const headers: Record<string, string> = { cookie: [...this.c].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (init.json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(B + path, { method: init.method ?? "GET", headers, body: init.json === undefined ? undefined : JSON.stringify(init.json), redirect: "manual" });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); }
    return res;
  }
  async j<T = Record<string, unknown>>(path: string, init: { method?: string; json?: unknown } = {}) { const r = await this.f(path, init); return { status: r.status, body: (await r.json().catch(() => ({}))) as T }; }
}
const login = async (body: Record<string, unknown>) => { const j = new Jar(); const r = await j.f("/api/auth/login", { method: "POST", json: { code: "123456", ...body } }); assert.equal(r.status, 200); return j; };
const book = (j: Jar, o: Record<string, unknown>) => j.j<{ id: string; demo: boolean; error?: string }>("/api/requests", { method: "POST", json: { category: "electrician", problem: "Fan not working", sector: "Sector 62", address: "Test address", time_window: "Today evening", consent: true, ...o } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const O = await login({ role: "operator", name: "Op" });
  const pro = await O.j<{ provider: { id: string } }>("/api/providers", { method: "POST", json: { name: "Test Electrician", phone: "6000001011", email: "pro@test.in", area: "Noida", visit_charge: "150", categories: ["electrician"], consent: true } });
  assert.equal(pro.status, 200);
  assert.equal((await O.j("/api/providers", { method: "POST", json: { name: "Dup", phone: "6000001011", email: "x@test.in", area: "N", visit_charge: "100", categories: ["plumber"], consent: true } })).status, 409);
  assert.equal((await O.j("/api/providers", { method: "POST", json: { name: "NoConsent", phone: "6000001012", email: "y@test.in", area: "N", visit_charge: "100", categories: ["plumber"] } })).status, 400);
  const ap = await O.j<{ approved: { kind: string }[] }>("/api/approved");
  assert.ok(ap.body.approved.some((a) => a.kind === "pro"), "onboarded Pro is on the approved list");
  console.log("ok  onboarding a Pro records consent, rejects duplicates and missing consent, and approves the Pro's number");

  const stranger = await login({ role: "customer", name: "Stranger", phone: "6000000011", email: "stranger@test.in" });
  const b1 = await book(stranger, { name: "Stranger", phone: "6000000011" });
  assert.equal(b1.body.demo, true);
  const r1 = (await stranger.j<{ request: { demo: boolean; matched: string[] } }>(`/api/requests/${b1.body.id}`)).body.request;
  assert.ok(r1.matched.every((m) => m.startsWith("sim-")) || r1.matched.length === 0, "an unapproved customer only ever meets simulated Pros");
  console.log("ok  an unapproved customer gets Demo: simulated calls with simulated Pros only");

  const ok = await O.j<{ link?: string }>("/api/approved", { method: "POST", json: { kind: "customer", name: "Approved Cust", phone: "6000000022", email: "approved@test.in", consent: true } });
  assert.equal(ok.status, 200); assert.ok(ok.body.link, "a booking link is returned");
  assert.equal((await O.j("/api/approved", { method: "POST", json: { kind: "customer", name: "No email", phone: "6000000023", consent: true } })).status, 400);
  const good = await login({ role: "customer", name: "Approved Cust", phone: "6000000022", email: "approved@test.in" });
  const wrongEmail = await login({ role: "customer", name: "Imposter", phone: "6000000024", email: "imposter@test.in" });
  assert.equal((await book(wrongEmail, { name: "Imposter", phone: "6000000022" })).body.demo, true, "typing an approved number with another email stays demo");
  assert.equal((await book(good, { name: "Approved Cust", phone: "6000000025" })).body.demo, true, "right email but another number stays demo");
  assert.equal((await book(good, { name: "Approved Cust", phone: "6000000022", category: "plumber" })).body.demo, true, "no approved Pro for this category stays demo");
  console.log("ok  approval needs email AND number AND an approved Pro for the category");
  const live2 = await book(good, { name: "Approved Cust", phone: "6000000022" });
  assert.equal(live2.status, 200); assert.equal(live2.body.demo, false, "approved customer + approved Pro = live (rehearsal)");
  await sleep(3500);
  const det = (await O.j<{ request: { matched: string[]; state: string; calls: { demo?: boolean }[]; awaiting_call?: string } }>(`/api/requests/${live2.body.id}`)).body.request;
  assert.deepEqual(det.matched, [pro.body.provider.id], "live booking only matches the real approved Pro");
  assert.equal(det.awaiting_call, pro.body.provider.id, "with Autopilot OFF the live call waits for the operator's click");
  assert.equal(det.calls.length, 0, "no call before the click");
  console.log("ok  live (rehearsal) booking matches only the approved Pro and waits for the operator's Call now");
  assert.equal((await book(good, { name: "Approved Cust", phone: "6000000022" })).status, 429);
  console.log("ok  the 4th request in a day is rate-limited (429)");
  await O.j("/api/settings", { method: "POST", json: { autopilot: false } });
  console.log("ALL PASSED");
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
