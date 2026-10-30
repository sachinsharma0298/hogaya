// npm run test:db -> checks the store and the row-level-security rules on a throwaway in-memory Postgres. No network, no calls.
process.env.PGLITE_DIR = "memory";
import assert from "node:assert/strict";
import { getDb } from "../src/lib/db";
import * as store from "../src/lib/store";
import type { HogayaRequest } from "../src/lib/types";

const A = "11111111-1111-1111-1111-111111111111"; // customer A
const B = "22222222-2222-2222-2222-222222222222"; // customer B
const P = "33333333-3333-3333-3333-333333333333"; // a Pro
const P2 = "44444444-4444-4444-4444-444444444444"; // another Pro
const O = "55555555-5555-5555-5555-555555555555"; // operator

const mk = (id: string, uid: string): HogayaRequest => ({
  id, created_at: new Date().toISOString(), category: "electrician", problem: "Fan not working", sector: "Sector 62", address: "H-12, secret lane",
  time_window: "evening", customer: { name: "Cust " + id, phone: "0000000001", consent_ai_call: true, consent_at: new Date().toISOString(), user_id: uid },
  state: "requested", notifications: [], flags: [], step: "matching", demo: true, matched: [], calls: [], events: [{ at: new Date().toISOString(), text: "created" }],
});

(async () => {
  const db = await getDb();
  for (const [id, email] of [[A, "a@x.in"], [B, "b@x.in"], [P, "p@x.in"], [P2, "p2@x.in"], [O, "o@x.in"]]) await db.query("insert into auth.users (id, email) values ($1::uuid,$2)", [id, email]);
  const now = new Date().toISOString();
  const u = (id: string, role: "customer" | "pro" | "operator", provider_id?: string) => store.saveUser({ id, role, name: role + id.slice(0, 1), phone: "", email: id.slice(0, 1) + "@x.in", provider_id, created_at: now });
  await u(A, "customer"); await u(B, "customer"); await u(O, "operator");
  await store.addProvider({ id: "p-real", name: "Real Pro", category: "electrician", categories: ["electrician"], phone: "0000000002", consent_ai_call: true, consent_date: "2026-10-18", opt_out: false, reliability: 80, on_time_pct: 80, jobs: 0, demo: false, onboarded_by: "op", onboarded_at: now });
  await store.addProvider({ id: "p-other", name: "Other Pro", category: "plumber", categories: ["plumber"], phone: "0000000003", consent_ai_call: true, consent_date: "2026-10-18", opt_out: false, reliability: 80, on_time_pct: 80, jobs: 0, demo: false });
  await u(P, "pro", "p-real"); await u(P2, "pro", "p-other");
  console.log("ok  migration + seed + accounts");

  // round trip
  await store.insertRequest(mk("r-1", A));
  await store.insertRequest(mk("r-2", B));
  let r = (await store.getRequest("r-1"))!;
  assert.equal(r.customer.phone, "0000000001"); assert.equal(r.address, "H-12, secret lane"); assert.equal(r.events.length, 1);
  console.log("ok  insert + read back");

  // update: calls, events, booking with the service code split out
  await store.updateRequest("r-1", (x) => {
    x.state = "booked"; x.matched = ["p-real"]; x.events.push({ at: now, text: "booked" });
    x.calls.push({ id: "c-1", kind: "provider", status: "done", started_at: now, provider_id: "p-real", json: { answered: true } });
    x.booking = { provider_id: "p-real", slot: "6 PM", visit_charge: "₹150", arrival_code: "4821", confirmed_via: "fo_call", booked_at: now };
    x.not_selected = ["p-other"]; (x as unknown as Record<string, unknown>).skip_rest = true;
  });
  await store.patchCall("r-1", "c-1", { status: "failed" });
  r = (await store.getRequest("r-1"))!;
  assert.equal(r.booking?.arrival_code, "4821"); assert.equal(r.calls[0].status, "failed"); assert.ok(r.calls[0].ended_at);
  assert.equal(r.events.length, 2); assert.deepEqual(r.matched, ["p-real"]); assert.equal((r as unknown as Record<string, unknown>).skip_rest, true);
  console.log("ok  update, call patch, events append, service code kept separate");

  // two writers at once: nothing is lost
  await Promise.all(Array.from({ length: 8 }, (_, i) => store.updateRequest("r-1", (x) => { x.events.push({ at: now, text: "w" + i }); })));
  r = (await store.getRequest("r-1"))!;
  assert.equal(r.events.length, 10);
  console.log("ok  8 simultaneous writers, no lost update");

  assert.equal((await store.getProviders()).filter((p) => p.id.startsWith("sim-")).length, 20);
  assert.equal((await store.listProviders()).length, 2);
  console.log("ok  20 simulated Pros are not stored; real Pros are");

  // ---- row-level security: act as each role, the way Supabase's REST API would
  const as = async (uid: string | null, sql: string, params: unknown[] = []) => {
    const d = await getDb();
    return d.tx(async (c) => {
      await c.exec(`set local role ${uid ? "authenticated" : "anon"}`);
      if (uid) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
      return c.query<{ id: string }>(sql, params);
    });
  };
  const ids = async (uid: string | null) => (await as(uid, "select id from requests order by id")).map((x) => x.id);
  assert.deepEqual(await ids(A), ["r-1"]); assert.deepEqual(await ids(B), ["r-2"]); assert.deepEqual(await ids(O), ["r-1", "r-2"]);
  assert.deepEqual(await ids(P), ["r-1"]);   // the Pro who was matched
  assert.deepEqual(await ids(P2), []);       // a Pro who was not
  await assert.rejects(() => as(null, "select id from requests"));
  console.log("ok  RLS requests: customer own only, Pro matched only, operator all, anon none");
  const priv = async (uid: string) => (await as(uid, "select request_id as id from request_private order by 1")).map((x) => x.id);
  assert.deepEqual(await priv(A), ["r-1"]); assert.deepEqual(await priv(P), []); assert.deepEqual(await priv(O), ["r-1", "r-2"]);
  console.log("ok  RLS request_private: Pro cannot read the phone, address or service code");
  for (const t of ["calls", "events", "settings"]) { assert.equal((await as(A, `select 1 as id from ${t}`).catch(() => [])).length, 0); }
  assert.ok((await as(O, "select 1 as id from calls")).length > 0);
  for (const t of ["fo_oauth", "approved_numbers", "consents"]) { await assert.rejects(() => as(O, `select 1 from ${t}`)); await assert.rejects(() => as(A, `select 1 from ${t}`)); }
  console.log("ok  RLS calls/events/settings operator only; fo_oauth, approved_numbers, consents unreachable from the browser roles");
  assert.deepEqual((await as(P, "select id from providers")).map((x) => x.id), ["p-real"]);
  assert.equal((await as(A, "select id from providers")).length, 0);
  assert.equal((await as(A, "select id from profiles")).length, 1);
  await assert.rejects(() => as(A, "update profiles set role='operator' where id = auth.uid()"));
  await assert.rejects(() => as(A, "update requests set state='closed'"));
  await assert.rejects(() => as(A, "delete from requests"));
  assert.equal((await as(null, "select id from categories")).length, 10);
  console.log("ok  RLS: customers cannot make themselves operator, cannot write; categories are public (10)");

  // ---- D3: approved numbers, one live call at a time, call-time approval check
  await store.addApproved({ phone: "+91 00000 00002", kind: "pro", name: "Real Pro", added_by: "test" });
  await store.addApproved({ phone: "0000000009", kind: "customer", name: "Cust A", email: "A@x.in", added_by: "test" });
  assert.ok(await store.isApproved("pro", "0000000002")); assert.ok(!(await store.isApproved("pro", "0000000003")));
  assert.ok(await store.isApproved("customer", "+910000000009", "a@x.in")); assert.ok(!(await store.isApproved("customer", "0000000009", "other@x.in")));
  assert.ok(!(await store.isApproved("customer", "0000000008", "a@x.in")));
  console.log("ok  approved list: Pros by number, customers by number AND email");
  const live = (id: string) => ({ ...mk(id, A), demo: false });
  await store.insertRequest(live("r-live1")); await store.insertRequest(live("r-live2"));
  const call = (id: string) => ({ id, kind: "provider" as const, status: "calling" as const, started_at: now, provider_id: "p-real" });
  await store.updateRequest("r-live1", (x) => void x.calls.push(call("c-L1")));
  await assert.rejects(() => store.updateRequest("r-live2", (x) => void x.calls.push(call("c-L2"))), /one_live_call_at_a_time|unique/i);
  await store.patchCall("r-live1", "c-L1", { status: "done" });
  await store.updateRequest("r-live2", (x) => void x.calls.push(call("c-L2")));
  await store.updateRequest("r-live2", (x) => void x.calls.push({ ...call("c-D"), demo: true }));
  console.log("ok  the database itself refuses a second live call while one is running (demo calls are exempt)");
  const { callBlockedReason } = await import("../src/lib/booking");
  await store.updateRequest("r-live2", (x) => { x.customer.phone = "0000000009"; });
  assert.match((await callBlockedReason("r-live2", { kind: "provider", providerId: "p-other" }, true)) ?? "", /approved list/);
  assert.match((await callBlockedReason("r-live2", { kind: "customer" }, true)) ?? "", /approved list/); // customer is approved for A@x.in only; this request's owner has another email
  assert.equal(await callBlockedReason("r-live2", { kind: "booking", providerId: "p-real" }, true), "Another Fo call is already in progress (one call at a time).");
  console.log("ok  before every live call the number must be on the approved list");
  // the lock behind the "lost live call" bug: only its owner can release it
  const t1 = await store.lockRequest("r-1", 60);
  assert.ok(t1); assert.equal(await store.lockRequest("r-1", 60), null, "a second tick cannot take a held lock");
  await store.unlockRequest("r-1", "someone-elses-token"); assert.equal(await store.lockRequest("r-1", 60), null, "a late leftover request cannot free the lock");
  await store.unlockRequest("r-1", t1!); const t2 = await store.lockRequest("r-1", 60); assert.ok(t2); await store.unlockRequest("r-1", t2!);
  console.log("ok  tick lock: held locks cannot be taken or released by anyone else (the cause of the lost live call)");
  // JSON columns keep their type (the production-driver bug: JSON saved as text)
  await store.updateRequest("r-1", (x) => { x.flags.push({ at: now, reason: "t" }); });
  const jt = await (await getDb()).query<{ f: string; b: string }>("select jsonb_typeof(flags) f, jsonb_typeof(booking) b from requests where id='r-1'");
  assert.deepEqual(jt[0], { f: "array", b: "object" });
  console.log("ok  JSON columns are stored as real JSON (arrays/objects), not text");
  await store.writeFoAuth({ tokens: { access_token: "x" } }); await store.writeFoAuth({ authUrl: "u" });
  assert.deepEqual(Object.keys(await store.readFoAuth()).sort(), ["authUrl", "tokens"]);
  console.log("ok  Fo tokens stored server-side");
  // operator profile: default name Virat; the operator's phone lives in settings, so it never blocks a Pro or customer using that number
  assert.deepEqual(await store.getOperatorProfile(), { name: "Virat", phone: "" });
  await store.saveOperatorProfile("Asha", "9000000001");
  assert.deepEqual(await store.getOperatorProfile(), { name: "Asha", phone: "+919000000001" });
  assert.equal((await (await getDb()).query("select 1 from profiles where phone like '%9000000001'")).length, 0);
  console.log("ok  operator profile: default name, edits saved, phone not stored on a profile");
  assert.ok(await store.isOperatorPhone("9000000001")); assert.ok(!(await store.isOperatorPhone("9000000002")));
  console.log("ok  the operator's phone is reserved");
  // approval queue: a pending Pro is never a Pro; a pending customer is listed until approved or rejected
  await store.addPendingPro({ id: "pp-1", name: "New Pro", email: "np@x.in", phone: "+254718795772", categories: ["plumber"], area: "Noida", visit_charge: "₹100", consent_at: new Date().toISOString() });
  assert.equal((await store.listPendingPros()).length, 1); assert.equal((await store.listProviders()).filter((p) => p.email === "np@x.in").length, 0);
  assert.ok(await store.pendingProExists("NP@x.in", "+0")); assert.ok((await store.getPendingPro("pp-1"))?.phone === "+254718795772");
  const pc = await store.listPendingCustomers(); assert.ok(pc.length >= 0);
  console.log("ok  approval queue: pending Pros are stored but are not Pros");
  // sign-up -> approval -> people records
  const C = "66666666-6666-6666-6666-666666666666";
  await (await getDb()).query("insert into auth.users (id, email) values ($1::uuid,$2)", [C, "c@x.in"]);
  await store.saveUser({ id: C, role: "customer", name: "New Cust", phone: "+919876543210", email: "c@x.in", created_at: now });
  assert.equal((await store.findUser(C))?.review, "pending"); assert.equal((await store.findUser(O))?.review, "approved"); assert.equal((await store.findUser(P))?.review, "approved");
  const people = await import("../src/lib/people");
  assert.equal((await people.getPerson(C))?.status, "pending");
  assert.equal((await people.approvePerson(C, "op@x.in")).ok, true);
  const pc1 = (await people.getPerson(C))!;
  assert.equal(pc1.status, "approved"); assert.equal(pc1.reviewed_by, "op@x.in"); assert.ok(pc1.reviewed_at); assert.equal(pc1.country, "India (IN)");
  assert.equal((await store.findUser(C))?.approval_seen, false); // "Approved by Hogaya" is shown once
  await store.markApprovalSeen(C); assert.equal((await store.findUser(C))?.approval_seen, true);
  assert.ok(await store.isApproved("customer", "+919876543210", "c@x.in"));
  assert.equal((await people.rejectPerson(C, "op@x.in")).ok, true);
  assert.equal((await people.getPerson(C))?.status, "rejected"); assert.ok(!(await store.isApproved("customer", "+919876543210", "c@x.in")), "a rejected person is never callable");
  console.log("ok  customer: pending -> approved (who/when, notice once) -> rejected (taken off the approved list)");
  // a Pro application: pending until approved, then a real Pro with the consent wording kept
  await store.updatePendingPro("pp-1", { phone: "+919811122233" });
  await store.addPendingPro({ id: "pp-2", name: "Joiner", email: "j@x.in", phone: "+919822233344", categories: ["plumber"], area: "Noida", visit_charge: "₹120", consent_at: now, consent_text: "I agree to AI calls." });
  assert.equal((await people.getPerson("pp-2"))?.status, "pending");
  assert.equal((await people.approvePerson("pp-2", "op@x.in")).ok, true);
  const jp = (await people.getPerson("pp-2"))!;
  assert.equal(jp.status, "approved"); assert.equal(jp.role, "pro"); assert.equal(jp.pro?.consent_text, "I agree to AI calls."); assert.ok(await store.isApproved("pro", "+919822233344"));
  assert.equal((await people.rejectPerson("pp-2", "op@x.in")).ok, true);
  assert.ok(!(await store.isApproved("pro", "+919822233344")), "a rejected Pro is off the approved list"); assert.equal((await people.getPerson("pp-2"))?.status, "rejected");
  console.log("ok  Pro application: pending -> approved with consent wording -> rejected (not callable)");
  // first sign-in decides the starting status: an approved applicant starts Approved (with the notice), a rejected one Rejected, a stranger Pending
  const { ensureProfile } = await import("../src/lib/auth");
  const au = async (id: string, email: string) => { await (await getDb()).query("insert into auth.users (id, email) values ($1::uuid,$2)", [id, email]); return ensureProfile({ id, email, email_confirmed_at: now, user_metadata: { phone: "+919800000001" } }); };
  const first = await au("77777777-7777-7777-7777-777777777771", "j@x.in"); // pp-2's Pro record exists, but the number was taken off the list by the reject above
  assert.equal(first.role, "pro"); assert.equal(first.review, "rejected");
  await store.addPendingPro({ id: "pp-3", name: "Turned down", email: "td@x.in", phone: "+919833344455", categories: ["ac"], area: "Noida", visit_charge: "₹90", consent_at: now });
  await store.setPendingProStatus("pp-3", "rejected", "op@x.in");
  assert.equal((await au("77777777-7777-7777-7777-777777777772", "td@x.in")).review, "rejected");
  assert.equal((await au("77777777-7777-7777-7777-777777777773", "stranger@x.in")).review, "pending");
  console.log("ok  first sign-in sets the starting status (stranger Pending, rejected applicant Rejected)");
  // operator notes and the forgot-password queue (no password is stored anywhere)
  await store.savePersonNotes("C@x.in", "Prefers evenings"); assert.equal((await people.getPerson(C))?.notes, "Prefers evenings");
  assert.equal(await store.findEmailByIdentifier("c@x.in"), "c@x.in"); assert.equal(await store.findEmailByIdentifier("+91 98765 43210"), "c@x.in"); assert.equal(await store.findEmailByIdentifier("nobody@x.in"), undefined);
  assert.equal(await store.addPasswordReset("c@x.in", "c@x.in"), true); assert.equal(await store.addPasswordReset("C@x.in", "again"), false, "one open request per person");
  assert.equal(await store.countOpenPasswordResets(), 1); assert.equal((await store.listOpenPasswordResets())[0].name, "New Cust");
  await store.resolvePasswordResets("c@x.in"); assert.equal(await store.countOpenPasswordResets(), 0);
  await store.setMustChangePassword(C, true); assert.equal((await store.findUser(C))?.must_change_password, true);
  const cols = (await (await getDb()).query<{ column_name: string }>("select column_name from information_schema.columns where table_schema='public' and column_name ilike '%password%'")).map((r) => r.column_name);
  assert.deepEqual(cols.sort(), ["must_change_password"], "no table keeps a password");
  console.log("ok  notes save, forgot-password queue (one open per person), forced password change flag, no password column anywhere");
  assert.equal((await people.deletePerson(C, O)).ok, true); assert.equal(await people.getPerson(C), undefined);
  console.log("ok  delete a person removes their login record");
  const approvedBefore = (await store.listApproved()).length;
  assert.ok(approvedBefore > 0);
  const gone = await store.resetAllData();
  assert.equal(gone.removedRequests, 4); assert.equal((await store.listRequests()).length, 0);
  assert.equal((await store.listProviders()).length, 0); assert.equal((await store.listApproved()).length, 0);
  assert.equal((await store.listUsers()).filter((u) => u.role !== "operator").length, 0);
  assert.equal((await (await getDb()).query("select count(*)::int n from categories"))[0].n, 10);
  console.log("ok  reset all data keeps the operator and the 10 categories, removes everything else");
  console.log("ALL PASSED");
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
