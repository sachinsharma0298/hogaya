// All data lives in Postgres (Supabase in production, an embedded Postgres locally). See src/lib/db.ts and supabase/migrations.
// The shape the rest of the app uses (HogayaRequest with its calls and events inside) is rebuilt from the tables here.
import type { Category } from "./categories";
import { canonPhone, toE164 } from "./phone";
import { iso, jsonParam, pgArray, q, tx, type Queryable, type Row } from "./db";
import { isCallLang, type CallLang } from "./call-scripts/hogaya-context";
import type { CallRecord, HogayaRequest, Provider, Review, Role, Settings, User } from "./types";

// ---- simulated providers (never stored, never called) ----------------------------------------------------
// Used only for "Demo: simulated calls" bookings. They are not people: they exist so the flow can be shown to anyone.
const SIM: [Category, string, string, number, number, number][] = [
  ["electrician", "ramesh", "Ramesh Kumar", 94, 96, 31], ["electrician", "suresh", "Suresh Yadav", 88, 90, 17],
  ["plumber", "mohan", "Mohan Lal", 91, 93, 22], ["plumber", "dinesh", "Dinesh Sharma", 86, 88, 14],
  ["ac", "rajesh", "Rajesh Verma", 93, 95, 26], ["ac", "anil", "Anil Gupta", 85, 87, 12],
  ["pump", "harish", "Harish Chand", 90, 92, 19], ["pump", "pramod", "Pramod Singh", 84, 86, 11],
  ["washing_machine", "sanjay", "Sanjay Mishra", 92, 94, 24], ["washing_machine", "vikas", "Vikas Tiwari", 83, 85, 9],
  ["ro", "manoj", "Manoj Pandey", 95, 97, 33], ["ro", "deepak", "Deepak Joshi", 87, 89, 15],
  ["fridge", "ashok", "Ashok Saini", 89, 91, 18], ["fridge", "rakesh", "Rakesh Chauhan", 82, 84, 10],
  ["geyser", "naresh", "Naresh Kumar", 91, 93, 21], ["geyser", "satish", "Satish Rawat", 85, 87, 13],
  ["inverter", "ajay", "Ajay Thakur", 90, 92, 20], ["inverter", "sunil", "Sunil Dubey", 81, 83, 8],
  ["carpenter", "bablu", "Bablu Vishwakarma", 93, 95, 28], ["carpenter", "kishan", "Kishan Lal", 86, 88, 16],
];
const SIM_PROVIDERS: Provider[] = SIM.map(([category, key, name, reliability, on_time_pct, jobs], i) => ({
  id: `sim-${key}`, name, category, categories: [category], phone: "", email: "", consent_ai_call: true, consent_date: "2026-10-17",
  opt_out: false, reliability, on_time_pct, jobs, no_shows: 0, demo: true, area: "Noida, Sector 62",
  visit_charge: ["₹100", "₹150", "₹200"][i % 3],
}));
export const isSimulated = (id: string) => id.startsWith("sim-");

// ---- providers (Pros) ------------------------------------------------------------------------------------

const langOf = (v: unknown): CallLang | undefined => (isCallLang(v) ? v : undefined);

function providerFromRow(r: Row): Provider {
  const categories = (r.categories as string[]) ?? [];
  return {
    id: r.id as string, name: r.name as string, category: r.category as Category,
    categories: categories.length ? (categories as Category[]) : [r.category as Category],
    area: (r.area as string) || undefined, visit_charge: (r.visit_charge as string) || undefined,
    phone: r.phone as string, email: (r.email as string) || undefined,
    consent_ai_call: r.consent_ai_call as boolean, consent_date: r.consent_date as string, consent_text: (r.consent_text as string) || undefined, opt_out: r.opt_out as boolean,
    reliability: r.reliability as number, on_time_pct: r.on_time_pct as number, jobs: r.jobs as number,
    no_shows: r.no_shows as number, demo: r.demo as boolean,
    working_hours: (r.working_hours as string) || undefined, bio: (r.bio as string) || undefined, call_lang: langOf(r.call_lang),
    pending_changes: (r.pending_changes as Provider["pending_changes"]) ?? undefined,
    onboarded_by: (r.onboarded_by as string) || undefined, onboarded_at: iso(r.onboarded_at), verified: r.onboarded_at != null,
  };
}

async function writeProvider(c: Queryable, p: Provider, insert: boolean) {
  const cols = [p.id, p.name, p.category, pgArray(p.categories ?? [p.category]), p.area ?? "", p.visit_charge ?? "", p.phone, p.email ?? "",
    p.consent_ai_call, p.consent_date, p.opt_out, p.reliability, p.on_time_pct, p.jobs, p.no_shows ?? 0, p.demo, p.onboarded_by ?? "", p.onboarded_at ?? null, p.consent_text ?? "", p.working_hours ?? "", p.bio ?? "", p.pending_changes ? JSON.stringify(p.pending_changes) : null, p.call_lang ?? null];
  if (insert) {
    await c.query(
      `insert into providers (id,name,category,categories,area,visit_charge,phone,email,consent_ai_call,consent_date,opt_out,reliability,on_time_pct,jobs,no_shows,demo,onboarded_by,onboarded_at,consent_text,working_hours,bio,pending_changes,call_lang)
       values ($1,$2,$3,$4::text[],$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19,$20,$21,$22::text::jsonb,$23)`, cols);
  } else {
    await c.query(
      `update providers set name=$2,category=$3,categories=$4::text[],area=$5,visit_charge=$6,phone=$7,email=$8,consent_ai_call=$9,consent_date=$10,opt_out=$11,
       reliability=$12,on_time_pct=$13,jobs=$14,no_shows=$15,demo=$16,onboarded_by=$17,onboarded_at=$18::timestamptz,consent_text=$19,working_hours=$20,bio=$21,pending_changes=$22::text::jsonb,call_lang=$23 where id=$1`, cols);
  }
}

/** Real (onboarded) Pros only: what the operator console lists. */
export async function listProviders(): Promise<Provider[]> {
  return (await q("select * from providers order by created_at")).map(providerFromRow);
}
/** Real Pros plus the simulated ones: for looking a provider up by id and for demo bookings. */
export async function getProviders(): Promise<Provider[]> {
  return [...(await listProviders()), ...SIM_PROVIDERS];
}
export const simulatedProviders = () => SIM_PROVIDERS.map((p) => ({ ...p }));

export async function addProvider(p: Provider): Promise<Provider> {
  await tx((c) => writeProvider(c, p, true));
  return p;
}

export async function updateProvider(id: string, fn: (p: Provider) => void): Promise<Provider | undefined> {
  const sim = SIM_PROVIDERS.find((p) => p.id === id);
  if (sim) { const copy = { ...sim }; fn(copy); return copy; } // simulated Pros are never changed or stored
  return tx(async (c) => {
    const rows = await c.query("select * from providers where id=$1 for update", [id]);
    if (!rows[0]) return undefined;
    const p = providerFromRow(rows[0]);
    fn(p);
    await writeProvider(c, p, false);
    return p;
  });
}

// ---- requests (bookings) ---------------------------------------------------------------------------------

const CTL_KEYS = ["awaiting_call", "call_approved", "skip_rest", "skipped", "customer_declined", "screen_confirm_open"] as const;

const callFromRow = (r: Row): CallRecord => {
  const c: CallRecord = { id: r.id as string, kind: r.kind as CallRecord["kind"], status: r.status as CallRecord["status"], started_at: iso(r.started_at)! };
  if (r.provider_id) c.provider_id = r.provider_id as string;
  if (r.provider_name) c.provider_name = r.provider_name as string;
  if (r.ended_at) c.ended_at = iso(r.ended_at);
  if (r.fo_conversation_id) c.fo_conversation_id = r.fo_conversation_id as string;
  if (r.progress) c.progress = r.progress as string;
  if (r.question) c.question = r.question as string;
  if (r.operator_reply) c.operator_reply = r.operator_reply as string;
  if (r.demo) c.demo = true;
  if (r.summary_text) c.summary_text = r.summary_text as string;
  if (r.json) c.json = r.json as CallRecord["json"];
  if (r.meta && Object.keys(r.meta as object).length) c.meta = r.meta as CallRecord["meta"];
  return c;
};

function requestFromRows(r: Row, calls: Row[], events: Row[]): HogayaRequest {
  const ctl = (r.ctl ?? {}) as Record<string, unknown>;
  const booking = r.booking ? { ...(r.booking as object), arrival_code: (r.arrival_code as string) ?? "" } : undefined;
  const out = {
    id: r.id, created_at: iso(r.created_at)!, category: r.category, problem: r.problem, sector: r.sector, address: (r.address as string) ?? "",
    time_window: r.time_window, notes: r.notes ?? undefined,
    customer: {
      name: (r.customer_name as string) ?? "", phone: (r.customer_phone as string) ?? "", consent_ai_call: Boolean(r.customer_consent),
      consent_at: iso(r.customer_consent_at) ?? "", user_id: (r.customer_id as string) ?? undefined,
    },
    state: r.state, prev_state: r.prev_state ?? undefined, flags: r.flags, notifications: r.notifications,
    manual: r.manual || undefined, archived: r.archived || undefined, step: r.step, demo: r.demo,
    current_provider_name: r.current_provider_name ?? undefined, matched: r.matched ?? [],
    calls: calls.map(callFromRow),
    customer_choice: r.customer_choice ?? undefined, not_selected: r.not_selected ?? undefined, booking,
    events: events.map((e) => ({ at: iso(e.at)!, text: e.text as string })),
    ...Object.fromEntries(CTL_KEYS.filter((k) => ctl[k] !== undefined).map((k) => [k, ctl[k]])),
  };
  return out as unknown as HogayaRequest;
}

const SELECT_REQ = `select r.*, p.customer_name, p.customer_phone, p.customer_consent, p.customer_consent_at, p.address, p.arrival_code
  from requests r left join request_private p on p.request_id = r.id`;

async function hydrate(c: Queryable, rows: Row[]): Promise<HogayaRequest[]> {
  if (!rows.length) return [];
  const ids = pgArray(rows.map((r) => r.id as string));
  const calls = await c.query("select * from calls where request_id = any($1::text[]) order by seq", [ids]);
  const events = await c.query("select * from events where request_id = any($1::text[]) order by id", [ids]);
  const by = (list: Row[], id: string) => list.filter((x) => x.request_id === id);
  return rows.map((r) => requestFromRows(r, by(calls, r.id as string), by(events, r.id as string)));
}

/** What gets written for a request, split by table, so we only write what changed. */
function pack(r: HogayaRequest) {
  const { arrival_code, ...booking } = (r.booking ?? {}) as Record<string, unknown>;
  const ctl: Record<string, unknown> = {};
  for (const k of CTL_KEYS) if ((r as unknown as Record<string, unknown>)[k] !== undefined) ctl[k] = (r as unknown as Record<string, unknown>)[k];
  const req = [
    r.id, r.created_at, r.customer.user_id ?? null, r.category, r.problem, r.sector, r.time_window, r.notes ?? null, r.state, r.prev_state ?? null,
    r.step, r.demo, Boolean(r.manual), Boolean(r.archived), r.current_provider_name ?? null, pgArray(r.matched ?? []), pgArray(r.not_selected),
    (r.booking?.provider_id as string | undefined) ?? null, jsonParam(r.customer_choice), r.booking ? jsonParam(booking) : null,
    jsonParam(r.flags ?? []), jsonParam(r.notifications ?? []), jsonParam(ctl),
  ];
  const priv = [r.id, r.customer.name, r.customer.phone, Boolean(r.customer.consent_ai_call), r.customer.consent_at || null, r.address,
    typeof arrival_code === "string" ? arrival_code : ""];
  return { req, priv, calls: new Map(r.calls.map((c) => [c.id, JSON.stringify(c)])), eventCount: r.events.length };
}
type Packed = ReturnType<typeof pack>;

const REQ_SQL = {
  insert: `insert into requests (id,created_at,customer_id,category,problem,sector,time_window,notes,state,prev_state,step,demo,manual,archived,current_provider_name,matched,not_selected,
    chosen_provider_id,customer_choice,booking,flags,notifications,ctl)
    values ($1,$2::timestamptz,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::text[],$17::text[],$18,$19::text::jsonb,$20::text::jsonb,$21::text::jsonb,$22::text::jsonb,$23::text::jsonb)`,
  update: `update requests set created_at=$2::timestamptz,customer_id=$3::uuid,category=$4,problem=$5,sector=$6,time_window=$7,notes=$8,state=$9,prev_state=$10,step=$11,demo=$12,manual=$13,
    archived=$14,current_provider_name=$15,matched=$16::text[],not_selected=$17::text[],chosen_provider_id=$18,customer_choice=$19::text::jsonb,booking=$20::text::jsonb,flags=$21::text::jsonb,
    notifications=$22::text::jsonb,ctl=$23::text::jsonb where id=$1`,
};
const PRIV_SQL = `insert into request_private (request_id,customer_name,customer_phone,customer_consent,customer_consent_at,address,arrival_code)
  values ($1,$2,$3,$4,$5::timestamptz,$6,$7)
  on conflict (request_id) do update set customer_name=excluded.customer_name, customer_phone=excluded.customer_phone, customer_consent=excluded.customer_consent,
  customer_consent_at=excluded.customer_consent_at, address=excluded.address, arrival_code=excluded.arrival_code`;
const CALL_SQL = `insert into calls (id,request_id,kind,provider_id,provider_name,status,started_at,ended_at,fo_conversation_id,progress,question,operator_reply,demo,summary_text,json,meta)
  values ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,$10,$11,$12,$13,$14,$15::text::jsonb,$16::text::jsonb)
  on conflict (id) do update set kind=excluded.kind, provider_id=excluded.provider_id, provider_name=excluded.provider_name, status=excluded.status, started_at=excluded.started_at,
  ended_at=excluded.ended_at, fo_conversation_id=excluded.fo_conversation_id, progress=excluded.progress, question=excluded.question, operator_reply=excluded.operator_reply,
  demo=excluded.demo, summary_text=excluded.summary_text, json=excluded.json, meta=excluded.meta`;

const callParams = (rid: string, c: CallRecord) => [c.id, rid, c.kind, c.provider_id ?? null, c.provider_name ?? null, c.status, c.started_at, c.ended_at ?? null,
  c.fo_conversation_id ?? null, c.progress ?? null, c.question ?? null, c.operator_reply ?? null, Boolean(c.demo), c.summary_text ?? null, jsonParam(c.json), JSON.stringify(c.meta ?? {})];

async function saveRequest(c: Queryable, r: HogayaRequest, before: Packed | undefined) {
  const now = pack(r);
  if (!before) await c.query(REQ_SQL.insert, now.req);
  else if (JSON.stringify(now.req) !== JSON.stringify(before.req)) await c.query(REQ_SQL.update, now.req);
  if (!before || JSON.stringify(now.priv) !== JSON.stringify(before.priv)) await c.query(PRIV_SQL, now.priv);
  for (const call of r.calls) {
    if (before?.calls.get(call.id) === now.calls.get(call.id)) continue;
    await c.query(CALL_SQL, callParams(r.id, call));
  }
  for (const e of r.events.slice(before?.eventCount ?? 0)) await c.query("insert into events (request_id, at, text) values ($1,$2::timestamptz,$3)", [r.id, e.at, e.text]);
}

export async function listRequests(opts: { customerId?: string } = {}): Promise<HogayaRequest[]> {
  const rows = opts.customerId
    ? await q(`${SELECT_REQ} where r.customer_id = $1::uuid order by r.created_at desc`, [opts.customerId])
    : await q(`${SELECT_REQ} order by r.created_at desc`);
  return tx((c) => hydrate(c, rows));
}

export async function getRequest(id: string): Promise<HogayaRequest | undefined> {
  const rows = await q(`${SELECT_REQ} where r.id = $1`, [id]);
  return (await tx((c) => hydrate(c, rows)))[0];
}

export async function insertRequest(r: HogayaRequest) {
  await tx(async (c) => {
    await saveRequest(c, r, undefined);
    if (r.customer.consent_ai_call) {
      // The customer's tick-box on the booking form is kept as a consent record too.
      await c.query("insert into consents (subject_kind, subject_id, phone, consented_at, channel, recorded_by) values ('customer',$1,$2,$3::timestamptz,'booking-form','customer')",
        [r.customer.user_id ?? canonPhone(r.customer.phone), canonPhone(r.customer.phone), r.customer.consent_at || r.created_at]);
    }
  });
}

/** Read-modify-write one request. The row is locked while we change it, so two writers never overwrite each other. */
export async function updateRequest(id: string, fn: (r: HogayaRequest) => void): Promise<HogayaRequest | undefined> {
  return tx(async (c) => {
    const rows = await c.query(`${SELECT_REQ} where r.id = $1 for update of r`, [id]);
    const r = (await hydrate(c, rows))[0];
    if (!r) return undefined;
    const before = pack(r);
    fn(r);
    await saveRequest(c, r, before);
    return r;
  });
}

export async function patchCall(requestId: string, callId: string, patch: Partial<CallRecord>) {
  return updateRequest(requestId, (r) => {
    const c = r.calls.find((x) => x.id === callId);
    if (!c) return;
    Object.assign(c, patch);
    if (patch.status && ["done", "failed", "timed_out"].includes(patch.status)) c.ended_at = new Date().toISOString();
  });
}

/** True while any live call is still running or waiting for the operator. */
export async function hasActiveLiveCall(): Promise<boolean> {
  return (await q("select 1 from calls where not demo and status in ('calling','waiting_summary','needs_reply','unconfirmed') limit 1")).length > 0;
}

/** Erase everything except the operator account, the Fo sign-in, the categories and the database structure (operator only).
 *  Removes bookings (calls and events go with them), Pros, approved numbers and every other account's profile. The caller removes the Auth logins. */
export async function resetAllData(): Promise<{ removedRequests: number; removedProviders: number; removedApproved: number; removedAccounts: number }> {
  return tx(async (c) => {
    const n = async (t: string) => (await c.query<{ n: number }>(`select count(*)::int as n from ${t}`))[0].n;
    const out = { removedRequests: await n("requests"), removedProviders: await n("providers"), removedApproved: await n("approved_numbers"), removedAccounts: 0 };
    await c.query("delete from requests"); // calls, events and private details go with them
    await c.query("delete from providers");
    await c.query("delete from pending_pros");
    await c.query("delete from person_notes");
    await c.query("delete from password_resets");
    await c.query("delete from approved_numbers");
    out.removedAccounts = (await c.query<{ id: string }>("delete from profiles where role <> 'operator' returning id")).length;
    await c.query("update settings set autopilot=false, simulate_no_reconfirm=false where id=1");
    return out;
  });
}

/** Delete one Pro with their approval and their login profile. Returns the Auth user ids to remove, or undefined if there is no such Pro. */
export async function deleteProvider(id: string): Promise<{ authIds: string[] } | undefined> {
  return tx(async (c) => {
    const p = (await c.query("select phone, email from providers where id=$1 for update", [id]))[0];
    if (!p) return undefined;
    await c.query("delete from approved_numbers where kind='pro' and phone=$1", [canonPhone(p.phone)]);
    const gone = await c.query<{ id: string }>("delete from profiles where provider_id=$1 and role <> 'operator' returning id", [id]);
    await c.query("delete from providers where id=$1", [id]);
    return { authIds: gone.map((r) => r.id) };
  });
}

/** Delete one approved entry. A customer's login goes too, and a Pro entry takes the matching Pro with it. */
export async function deleteApproved(id: number): Promise<{ authIds: string[] } | undefined> {
  const a = (await q("select * from approved_numbers where id=$1", [id]))[0];
  if (!a) return undefined;
  if (a.kind === "pro") {
    const pro = (await q("select id from providers where phone=$1 limit 1", [a.phone]))[0];
    if (pro) return deleteProvider(pro.id as string);
    await q("delete from approved_numbers where id=$1", [id]);
    return { authIds: [] };
  }
  return tx(async (c) => {
    await c.query("delete from approved_numbers where id=$1", [id]);
    const email = (a.email as string) ?? "";
    const gone = email ? await c.query<{ id: string }>("select id from profiles where lower(email)=lower($1) and role = 'customer'", [email]) : [];
    for (const g of gone) { await c.query("update requests set customer_id=null where customer_id=$1::uuid", [g.id]); await c.query("delete from profiles where id=$1::uuid", [g.id]); }
    return { authIds: gone.map((r) => r.id) };
  });
}

/** Delete one login profile (never the operator's). Returns false if it does not exist or is the operator. */
export async function deleteProfile(id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  return tx(async (c) => {
    const u = (await c.query("select role from profiles where id=$1::uuid for update", [id]))[0];
    if (!u || u.role === "operator") return false;
    await c.query("update requests set customer_id=null where customer_id=$1::uuid", [id]);
    await c.query("delete from profiles where id=$1::uuid", [id]);
    return true;
  });
}

// ---- settings --------------------------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const r = (await q("select autopilot, simulate_no_reconfirm from settings where id=1"))[0];
  return { autopilot: Boolean(r?.autopilot), simulate_no_reconfirm: Boolean(r?.simulate_no_reconfirm) };
}
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const cur = { ...(await getSettings()), ...patch };
  await q("update settings set autopilot=$1, simulate_no_reconfirm=$2 where id=1", [cur.autopilot, cur.simulate_no_reconfirm]);
  return cur;
}

// ---- operator profile (display name and phone live in settings, so the number never blocks a Pro or customer using it) ----

export const DEFAULT_OPERATOR_NAME = "Virat";
export async function getOperatorProfile(): Promise<{ name: string; phone: string }> {
  const r = (await q("select operator_name, operator_phone from settings where id=1"))[0];
  return { name: ((r?.operator_name as string) || "").trim() || DEFAULT_OPERATOR_NAME, phone: (r?.operator_phone as string) ?? "" };
}
export async function saveOperatorProfile(name: string, phone: string) {
  await q("update settings set operator_name=$1, operator_phone=$2 where id=1", [name, canonPhone(phone)]);
}

/** The operator's number is reserved: no customer or Pro may use it. */
export async function isOperatorPhone(raw: string): Promise<boolean> {
  const op = (await getOperatorProfile()).phone;
  return Boolean(op) && canonPhone(op) === canonPhone(raw);
}
export const OPERATOR_PHONE_ERROR = "This number is reserved for the Hogaya operator. Please use a different number.";
/** Is this number already used by a Pro, an approved person or a customer account? (Used before reserving it for the operator.) */
export async function phoneInUseByOthers(raw: string): Promise<boolean> {
  const e = canonPhone(raw);
  const n = (await q<{ n: number }>(
    `select (select count(*) from providers where phone=$1) + (select count(*) from approved_numbers where phone=$1)
          + (select count(*) from profiles where phone=$1 and role <> 'operator') as n`, [e]))[0]?.n;
  return Number(n) > 0;
}

// ---- accounts (profiles) ---------------------------------------------------------------------------------

const userFromRow = (r: Row): User => ({
  id: r.id as string, role: r.role as Role, name: r.name as string, phone: r.phone as string, email: (r.email as string) || undefined,
  provider_id: (r.provider_id as string) || undefined, created_at: iso(r.created_at)!,
  review: r.review as Review, reviewed_at: iso(r.reviewed_at), reviewed_by: (r.reviewed_by as string) || undefined,
  must_change_password: Boolean(r.must_change_password), approval_seen: Boolean(r.approval_seen), call_lang: langOf(r.call_lang),
});
export async function findUser(id: string): Promise<User | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const r = (await q("select * from profiles where id=$1::uuid", [id]))[0];
  return r ? userFromRow(r) : undefined;
}
export async function findUserByPhone(role: Role, phone: string): Promise<User | undefined> {
  if (phone.startsWith("dev-")) return (await listUsers()).find((u) => u.role === role && u.phone === phone); // local test accounts
  const e = canonPhone(phone);
  if (!e.startsWith("+")) return undefined;
  return (await listUsers()).find((u) => u.role === role && canonPhone(u.phone) === e);
}
/** Local development only: a stand-in for a Supabase Auth user, so a profile can exist without a real sign-in. */
export async function ensureLocalAuthUser(id: string, email: string) {
  if ((await (await import("./db")).getDb()).engine !== "pglite") throw new Error("Local login is only available on the local database.");
  await q("insert into auth.users (id, email) values ($1::uuid, $2) on conflict (id) do nothing", [id, email]);
}
export async function findProviderByEmail(email: string): Promise<Provider | undefined> {
  const r = (await q("select * from providers where lower(email)=lower($1) and email <> '' limit 1", [email]))[0];
  return r ? providerFromRow(r) : undefined;
}
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const r = (await q("select * from profiles where lower(email)=lower($1) and email <> ''", [email]))[0];
  return r ? userFromRow(r) : undefined;
}
export async function findUserByProvider(providerId: string): Promise<User | undefined> {
  const r = (await q("select * from profiles where provider_id=$1", [providerId]))[0];
  return r ? userFromRow(r) : undefined;
}
export async function listUsers(): Promise<User[]> {
  return (await q("select * from profiles order by created_at")).map(userFromRow);
}
export async function saveUser(u: User): Promise<User> {
  // The review decision is written only when the profile is first created; later changes go through setReviewByEmail.
  const review = u.review ?? (u.role === "customer" ? "pending" : "approved");
  await q(
    `insert into profiles (id, role, name, phone, email, provider_id, created_at, review, reviewed_at, reviewed_by, approval_seen, call_lang) values ($1::uuid,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9::timestamptz,$10,$11,$12)
     on conflict (id) do update set role=excluded.role, name=excluded.name, phone=excluded.phone, email=excluded.email, provider_id=excluded.provider_id`,
    [u.id, u.role, u.name, u.phone, u.email ?? "", u.provider_id ?? null, u.created_at, review, u.reviewed_at ?? null, u.reviewed_by ?? "", u.approval_seen ?? review !== "approved", u.call_lang ?? null]);
  return (await findUser(u.id)) ?? u;
}

/** Record the operator's decision on every profile with this email (a person may not have signed in yet: then there is nothing to update). */
export async function setReviewByEmail(email: string, review: "approved" | "rejected", by: string) {
  if (!email) return;
  await q("update profiles set review=$2, reviewed_at=now(), reviewed_by=$3, approval_seen=($2 <> 'approved') where lower(email)=lower($1) and role <> 'operator'", [email, review, by]);
}
export async function markApprovalSeen(id: string) {
  if (/^[0-9a-f-]{36}$/i.test(id)) await q("update profiles set approval_seen=true where id=$1::uuid", [id]);
}
export async function setMustChangePassword(id: string, v: boolean) {
  await q("update profiles set must_change_password=$2 where id=$1::uuid", [id, v]);
}
export async function setUserCallLang(id: string, lang: CallLang) {
  await q("update profiles set call_lang=$2 where id=$1::uuid", [id, lang]);
}
export async function updateProfileDetails(id: string, name: string, phone?: string) {
  if (phone === undefined) await q("update profiles set name=$2 where id=$1::uuid", [id, name]);
  else await q("update profiles set name=$2, phone=$3 where id=$1::uuid", [id, name, phone]);
}

// ---- operator notes and password-reset requests ---------------------------------------------------------

export async function getPersonNotes(email: string): Promise<string> {
  return ((await q("select notes from person_notes where email=lower($1)", [email]))[0]?.notes as string) ?? "";
}
export async function savePersonNotes(email: string, notes: string) {
  await q("insert into person_notes (email, notes) values (lower($1), $2) on conflict (email) do update set notes=excluded.notes, updated_at=now()", [email, notes]);
}
export interface PasswordReset { id: number; email: string; identifier: string; name: string; role: Role | "pro"; created_at: string }
export async function listOpenPasswordResets(): Promise<PasswordReset[]> {
  return (await q(
    `select r.id, r.email, r.identifier, r.created_at,
            coalesce(nullif(p.name,''), x.name, r.email) as name, coalesce(p.role, 'customer') as role
       from password_resets r
       left join profiles p on lower(p.email) = lower(r.email)
       left join pending_pros x on lower(x.email) = lower(r.email)
      where r.status='open' order by r.created_at`)).map((r) => ({ id: Number(r.id), email: r.email as string, identifier: r.identifier as string, name: r.name as string, role: r.role as Role, created_at: iso(r.created_at)! }));
}
/** One open request per person. Returns false if there was already one. */
export async function addPasswordReset(email: string, identifier: string): Promise<boolean> {
  return (await q("insert into password_resets (email, identifier) values (lower($1), $2) on conflict do nothing returning id", [email, identifier.slice(0, 120)])).length > 0;
}
export async function resolvePasswordResets(email: string) {
  await q("update password_resets set status='done', resolved_at=now() where lower(email)=lower($1) and status='open'", [email]);
}
export async function countOpenPasswordResets(): Promise<number> {
  return Number((await q("select count(*)::int n from password_resets where status='open'"))[0]?.n ?? 0);
}
/** Who does this email or phone belong to? Returns the account email (profile, Pro application or Pro record). */
export async function findEmailByIdentifier(raw: string): Promise<string | undefined> {
  const s = raw.trim();
  if (!s) return undefined;
  if (s.includes("@")) {
    const e = s.toLowerCase();
    const hit = (await q("select email from profiles where lower(email)=$1 and role <> 'operator' union select email from pending_pros where lower(email)=$1 union select email from providers where lower(email)=$1 and email <> ''", [e]))[0];
    return hit?.email as string | undefined;
  }
  const e = canonPhone(toE164(s) ?? s);
  if (!e.startsWith("+")) return undefined;
  const u = (await listUsers()).find((x) => x.role !== "operator" && x.email && canonPhone(x.phone) === e);
  if (u) return u.email;
  const x = (await q("select email from pending_pros where phone=$1 union select email from providers where phone=$1 and email <> ''", [e]))[0];
  return x?.email as string | undefined;
}

// ---- approval queue (pending customers and Pros) --------------------------------------------------------

export interface PendingCustomer { id: string; name: string; email: string; phone: string; created_at: string }
export interface PendingPro { id: string; name: string; email: string; phone: string; categories: Category[]; area: string; visit_charge: string; consent_at: string; consent_text?: string; created_at: string; status?: Review; reviewed_at?: string; reviewed_by?: string; call_lang?: CallLang }

/** Self-registered customers waiting for the operator: not approved, not rejected, and not someone who applied as a Pro. */
export async function listPendingCustomers(): Promise<PendingCustomer[]> {
  const rows = await q(
    `select id, name, email, phone, created_at from profiles p
     where role='customer' and review='pending'
       and not exists (select 1 from approved_numbers a where a.kind='customer' and a.email <> '' and a.email = lower(p.email))
       and not exists (select 1 from pending_pros x where lower(x.email) = lower(p.email))
     order by created_at`);
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, email: r.email as string, phone: r.phone as string, created_at: iso(r.created_at)! }));
}
export async function setReview(id: string, review: "approved" | "rejected", by = ""): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  return (await q("update profiles set review=$2, reviewed_at=now(), reviewed_by=$3, approval_seen=($2 <> 'approved') where id=$1::uuid and role <> 'operator' returning id", [id, review, by])).length > 0;
}

const pendingProFromRow = (r: Row): PendingPro => ({
  id: r.id as string, name: r.name as string, email: r.email as string, phone: r.phone as string, categories: r.categories as Category[],
  area: r.area as string, visit_charge: r.visit_charge as string, consent_at: iso(r.consent_at)!, consent_text: (r.consent_text as string) || undefined, created_at: iso(r.created_at)!,
  status: r.status as Review, reviewed_at: iso(r.reviewed_at), reviewed_by: (r.reviewed_by as string) || undefined, call_lang: langOf(r.call_lang),
});
export async function listPendingPros(): Promise<PendingPro[]> {
  return (await q("select * from pending_pros where status='pending' order by created_at")).map(pendingProFromRow);
}
export async function getPendingPro(id: string): Promise<PendingPro | undefined> {
  const r = (await q("select * from pending_pros where id=$1 and status='pending'", [id]))[0];
  return r ? pendingProFromRow(r) : undefined;
}
/** The application by id or email, whatever its status (the newest one). */
export async function findPendingProAny(key: { id?: string; email?: string }): Promise<PendingPro | undefined> {
  const r = key.id
    ? (await q("select * from pending_pros where id=$1", [key.id]))[0]
    : (await q("select * from pending_pros where lower(email)=lower($1) order by created_at desc limit 1", [key.email ?? ""]))[0];
  return r ? pendingProFromRow(r) : undefined;
}
export async function pendingProExists(email: string, phone: string): Promise<boolean> {
  return (await q("select 1 from pending_pros where status='pending' and (lower(email)=lower($1) or phone=$2) limit 1", [email, canonPhone(phone)])).length > 0;
}
export async function addPendingPro(p: Omit<PendingPro, "created_at">) {
  await q("insert into pending_pros (id,name,email,phone,categories,area,visit_charge,consent_at,consent_text,call_lang) values ($1,$2,$3,$4,$5::text[],$6,$7,$8::timestamptz,$9,$10)",
    [p.id, p.name, p.email.toLowerCase(), canonPhone(p.phone), pgArray(p.categories), p.area, p.visit_charge, p.consent_at, p.consent_text ?? "", p.call_lang ?? null]);
}
export async function setPendingProStatus(id: string, status: "approved" | "rejected", by = "") {
  await q("update pending_pros set status=$2, reviewed_at=now(), reviewed_by=$3 where id=$1", [id, status, by]);
}

// ---- Fo sign-in tokens (server only) ---------------------------------------------------------------------

export async function readFoAuth(): Promise<Record<string, unknown>> {
  let data = ((await q("select data from fo_oauth where id=1"))[0]?.data ?? {}) as Record<string, unknown> | string;
  if (typeof data === "string") { try { data = JSON.parse(data) as Record<string, unknown>; } catch { data = {}; } } // repairs rows saved before the JSON fix
  data = data as Record<string, unknown>;
  if (Object.keys(data).length) return data;
  // Local convenience: carry the old file-based sign-in over once, so you do not have to sign in to Fo again on this Mac.
  try {
    const { default: fs } = await import("node:fs");
    const { default: path } = await import("node:path");
    const { DATA_DIR } = await import("./paths");
    const old = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "fo-auth.json"), "utf8")) as Record<string, unknown>;
    if ((await (await import("./db")).getDb()).engine === "pglite" && process.env.PGLITE_DIR !== "memory" && old.tokens) {
      await q("update fo_oauth set data=$1::text::jsonb where id=1", [JSON.stringify(old)]);
      return old;
    }
  } catch { /* no old file */ }
  return data;
}
export async function writeFoAuth(patch: Record<string, unknown>) {
  const cur = await readFoAuth();
  const next = { ...cur, ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  await q("update fo_oauth set data=$1::text::jsonb, updated_at=now() where id=1", [JSON.stringify(next)]);
}

// ---- approved phone numbers: the only numbers a LIVE Fo call may reach ------------------------------------

export interface ApprovedNumber {
  id: number; phone: string; kind: "pro" | "customer"; name: string; email: string; consent_at: string; added_by: string; note: string;
}
/** The full E.164 number: the same person however it was typed (+91, spaces, 0 in front). Two numbers match only if they are identical in full. */
export const normPhone = canonPhone;

const approvedFromRow = (r: Row): ApprovedNumber => ({
  id: Number(r.id), phone: r.phone as string, kind: r.kind as "pro" | "customer", name: r.name as string, email: r.email as string,
  consent_at: iso(r.consent_at)!, added_by: r.added_by as string, note: r.note as string,
});
export async function listApproved(): Promise<ApprovedNumber[]> {
  return (await q("select * from approved_numbers order by created_at desc")).map(approvedFromRow);
}
export async function addApproved(a: { phone: string; kind: "pro" | "customer"; name: string; email?: string; consent_at?: string; added_by: string; note?: string }): Promise<ApprovedNumber> {
  const phone = canonPhone(a.phone);
  const row = (await q(
    `insert into approved_numbers (phone, kind, name, email, consent_at, added_by, note) values ($1,$2,$3,$4,coalesce(($5::date)::timestamp at time zone 'UTC', now()),$6,$7)
     on conflict (phone, kind) do update set name=excluded.name, email=excluded.email, consent_at=excluded.consent_at, added_by=excluded.added_by, note=excluded.note
     returning *`,
    [phone, a.kind, a.name, (a.email ?? "").toLowerCase(), a.consent_at?.slice(0, 10) ?? null, a.added_by, a.note ?? ""]))[0];
  await q("insert into consents (subject_kind, subject_id, phone, consented_at, channel, recorded_by) values ($1,$2,$3,coalesce(($4::date)::timestamp at time zone 'UTC', now()),$5,$6)",
    [a.kind, a.email || phone, phone, a.consent_at?.slice(0, 10) ?? null, "operator-approved-list", a.added_by]);
  return approvedFromRow(row);
}
export async function removeApproved(id: number): Promise<boolean> {
  return (await q("delete from approved_numbers where id=$1 returning id", [id])).length > 0;
}
export async function findApprovedCustomerByEmail(email: string): Promise<ApprovedNumber | undefined> {
  const r = (await q("select * from approved_numbers where kind='customer' and email=lower($1) and email <> '' limit 1", [email]))[0];
  return r ? approvedFromRow(r) : undefined;
}
/** Is this phone on the approved list for this kind? For customers the account email must match too. */
export async function isApproved(kind: "pro" | "customer", phone: string, email?: string): Promise<boolean> {
  const e = canonPhone(phone);
  if (!e.startsWith("+")) return false;
  const r = (await q("select email from approved_numbers where phone=$1 and kind=$2", [e, kind]))[0];
  if (!r) return false;
  return kind === "pro" || !r.email || (email ?? "").toLowerCase() === r.email;
}

// ---- rate limits -----------------------------------------------------------------------------------------

/** How many bookings this customer made in the last 24 hours (and how many everyone made). */
export async function requestCounts(customerId?: string): Promise<{ mine: number; all: number }> {
  const r = (await q(
    "select count(*) filter (where customer_id = $1::uuid)::int as mine, count(*)::int as all from requests where created_at > now() - interval '24 hours'",
    [customerId ?? null]))[0];
  return { mine: Number(r?.mine ?? 0), all: Number(r?.all ?? 0) };
}

// ---- tick locks --------------------------------------------------------------------------------------------

/** Take the booking's lock for a short while. False if another tick already holds it. The lock expires by itself. */
export async function lockRequest(id: string, seconds = 60): Promise<string | null> {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ok = (await q("update requests set lock_until = now() + ($2::int * interval '1 second'), lock_token = $3 where id=$1 and (lock_until is null or lock_until < now()) returning id", [id, seconds, token])).length > 0;
  return ok ? token : null;
}
/** Release the lock, but only if it is still OURS (a late leftover request must never free another tick's lock). */
export async function unlockRequest(id: string, token: string) {
  await q("update requests set lock_until = null, lock_token = null where id=$1 and lock_token = $2", [id, token]);
}
/** Bookings a tick may need to look at, oldest first (that order is also the queue for the one live-call line). */
export async function listTickIds(): Promise<string[]> {
  return (await q<{ id: string }>("select id from requests where not archived and state not in ('closed','completed','cancelled') order by created_at asc")).map((r) => r.id);
}

/** Remove an approved-list entry without touching any login (used when the operator rejects someone). */
export async function removeApprovedByPhone(kind: "pro" | "customer", phone: string) {
  await q("delete from approved_numbers where kind=$1 and phone=$2", [kind, canonPhone(phone)]);
}
export async function updatePendingPro(id: string, patch: { name?: string; phone?: string; area?: string; visit_charge?: string; categories?: Category[] }) {
  await q("update pending_pros set name=coalesce($2,name), phone=coalesce($3,phone), area=coalesce($4,area), visit_charge=coalesce($5,visit_charge), categories=coalesce($6::text[],categories) where id=$1",
    [id, patch.name ?? null, patch.phone ?? null, patch.area ?? null, patch.visit_charge ?? null, patch.categories ? pgArray(patch.categories) : null]);
}
/** Delete everything kept about an email that is not a login: Pro applications, notes, reset requests. */
export async function deletePersonLeftovers(email: string) {
  if (!email) return;
  await q("delete from pending_pros where lower(email)=lower($1)", [email]);
  await q("delete from person_notes where email=lower($1)", [email]);
  await q("delete from password_resets where lower(email)=lower($1)", [email]);
}
