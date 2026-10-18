// npm run test:access -> with the app running locally (DEV_LOGIN=1), checks who can and cannot reach what. Places no calls
// (only the demo category "geyser" is used, which always uses simulated calls).
import assert from "node:assert/strict";

const B = process.env.BASE ?? "http://localhost:3000";
class Jar {
  c = new Map<string, string>();
  async f(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (init.json !== undefined && init.method !== "GET") { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(init.json); }
    headers.cookie = [...this.c].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(B + path, { ...init, headers, redirect: "manual" });
    for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); }
    return res;
  }
}
const login = async (body: Record<string, unknown>) => { const j = new Jar(); const r = await j.f("/api/auth/login", { method: "POST", json: { code: "123456", ...body } }); assert.equal(r.status, 200, "login " + r.status); return j; };
const status = async (j: Jar, m: string, p: string, json?: unknown) => (await j.f(p, { method: m, json })).status;

(async () => {
  const anon = new Jar();
  const ops: [string, string][] = [["GET", "/api/requests"], ["POST", "/api/reset"], ["POST", "/api/requests/archive-all"], ["GET", "/api/settings"], ["POST", "/api/settings"], ["GET", "/api/providers"],
    ["POST", "/api/requests/r-x/call-now"], ["POST", "/api/requests/r-x/call-customer"], ["POST", "/api/requests/r-x/book-provider"], ["POST", "/api/requests/r-x/reconfirm"],
    ["POST", "/api/requests/r-x/verify-arrival"], ["POST", "/api/requests/r-x/control"], ["POST", "/api/requests/r-x/reply"], ["POST", "/api/requests/r-x/skip"],
    ["POST", "/api/requests/r-x/check-again"], ["POST", "/api/requests/r-x/outcome"], ["GET", "/api/fo/connect"], ["GET", "/api/fo/status"], ["POST", "/api/fo/test"], ["POST", "/api/claude/test"]];
  for (const [m, p] of ops) assert.equal(await status(anon, m, p, {}), 401, `anon ${m} ${p}`);
  assert.equal(await status(anon, "GET", "/api/me/bookings"), 401);
  assert.equal(await status(anon, "POST", "/api/requests", { category: "geyser" }), 401);
  const op = await anon.f("/operator");
  assert.ok([307, 308].includes(op.status) && (op.headers.get("location") ?? "").includes("/login"), "operator page redirects anon to login");
  console.log("ok  signed-out visitors get 401 on every operator/customer API, and /operator redirects to login");

  const A = await login({ role: "customer", name: "Cust A", phone: "6000000001" });
  const Bj = await login({ role: "customer", name: "Cust B", phone: "6000000002" });
  for (const [m, p] of ops) assert.equal(await status(A, m, p, {}), 403, `customer ${m} ${p}`);
  console.log("ok  a signed-in customer gets 403 on every operator route");

  const mkReq = await A.f("/api/requests", { method: "POST", json: { category: "geyser", problem: "Geyser not heating", sector: "Sector 62", address: "Secret address 1", time_window: "Today evening", name: "Cust A", phone: "6000000001", consent: true } });
  assert.equal(mkReq.status, 200); const { id } = (await mkReq.json()) as { id: string };
  assert.equal(await status(Bj, "GET", `/api/requests/${id}`), 404, "B must not see A's booking");
  assert.equal(await status(Bj, "POST", `/api/requests/${id}/job-done`), 404);
  assert.equal(await status(Bj, "POST", `/api/requests/${id}/rating`, { stars: 5 }), 404);
  assert.equal(await status(Bj, "POST", `/api/requests/${id}/confirm`, { provider_id: "sim-naresh" }), 404);
  const mine = await A.f(`/api/requests/${id}`); assert.equal(mine.status, 200);
  const body = JSON.stringify(await mine.json());
  assert.ok(!body.includes("fo_conversation_id") && !body.includes("summary_text") && !body.includes("6000000001"), "customer view hides Fo ids, transcripts and phones");
  const list = (await (await Bj.f("/api/me/bookings")).json()) as { bookings: { id: string }[] };
  assert.ok(!list.bookings.some((b) => b.id === id));
  console.log("ok  customers see only their own booking, and never Fo conversation ids, call transcripts or phone numbers");

  const O = await login({ role: "operator", name: "Op" });
  assert.equal(await status(O, "GET", "/api/requests"), 200);
  assert.equal(await status(O, "GET", `/api/requests/${id}`), 200);
  assert.equal((await O.f("/operator")).status, 200);
  console.log("ok  operator reads the console, any booking, and the /operator page");
  console.log("ALL PASSED");
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
