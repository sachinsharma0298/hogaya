// One place for "a person" in the operator console: a customer or a Pro, whether they have signed in yet or not.
// A person is found by a key: a login id (uuid), a Pro application id (pp-...), a Pro record id (p-...) or an email.
import { deleteAuthUserByEmail, deleteAuthUsers } from "./accounts";
import { createApprovedPro } from "./onboard";
import { PRO_ONBOARD_CONSENT } from "./consent";
import { canonPhone, phoneCountry, toE164 } from "./phone";
import {
  addApproved, deletePersonLeftovers, deleteProfile, deleteProvider, findApprovedCustomerByEmail, findPendingProAny, findProviderByEmail, findUser, findUserByEmail,
  findUserByProvider, getPersonNotes, isApproved, isOperatorPhone, listProviders, listRequests, OPERATOR_PHONE_ERROR, removeApprovedByPhone, setPendingProStatus,
  setReview, setReviewByEmail, updatePendingPro, updateProfileDetails, updateProvider, type PendingPro,
} from "./store";
import type { Category } from "./categories";
import type { Provider, Review, User } from "./types";

const UUID = /^[0-9a-f-]{36}$/i;

interface Found { profile?: User; provider?: Provider; pending?: PendingPro; email: string }

async function resolve(key: string): Promise<Found | undefined> {
  let profile: User | undefined, provider: Provider | undefined, pending: PendingPro | undefined;
  if (UUID.test(key)) profile = await findUser(key);
  else if (key.startsWith("pp-")) pending = await findPendingProAny({ id: key });
  else if (key.includes("@")) { profile = await findUserByEmail(key); }
  else provider = (await listProviders()).find((p) => p.id === key);
  const email = (profile?.email || pending?.email || provider?.email || (key.includes("@") ? key : "")).toLowerCase();
  if (!profile && !email && !provider) return undefined;
  if (!provider) provider = profile?.provider_id ? (await listProviders()).find((p) => p.id === profile!.provider_id) : email ? await findProviderByEmail(email) : undefined;
  if (!profile) profile = provider ? await findUserByProvider(provider.id) : email ? await findUserByEmail(email) : undefined;
  if (!pending && email) pending = await findPendingProAny({ email });
  if (!profile && !provider && !pending) return undefined;
  if (profile?.role === "operator") return undefined; // the operator is not a "person" to review
  return { profile, provider, pending, email: email || provider?.email || "" };
}

/** The key to link to: the login id when there is one, otherwise the Pro record or application. */
export const personKey = (f: { profile?: User; provider?: Provider; pending?: PendingPro }) => f.profile?.id ?? f.provider?.id ?? f.pending?.id ?? "";

async function statusOf(f: Found): Promise<Review> {
  if (f.provider) return (await isApproved("pro", f.provider.phone)) ? "approved" : "rejected";
  if (f.pending && f.pending.status !== "approved") return f.pending.status ?? "pending";
  if (f.profile) {
    if (f.profile.review === "pending" && f.email && (await findApprovedCustomerByEmail(f.email))) return "approved";
    return f.profile.review ?? "pending";
  }
  return "pending";
}

export interface PersonDetail {
  key: string; name: string; email: string; phone: string; country: string; role: "customer" | "pro"; status: Review;
  has_login: boolean; signed_up_at?: string; reviewed_at?: string; reviewed_by?: string; notes: string; password_reset_requested?: boolean;
  pro?: { categories: Category[]; area: string; visit_charge: string; consent_text: string; consent_at: string; reliability: number; on_time_pct: number; jobs: number; no_shows: number; opt_out: boolean };
  bookings: { id: string; category: string; state: string; problem: string; created_at: string }[];
}

const countryName = (phone: string) => {
  const c = phoneCountry(phone);
  if (!c) return "";
  return `${new Intl.DisplayNames(["en"], { type: "region" }).of(c) ?? c} (${c})`;
};

export async function getPerson(key: string): Promise<PersonDetail | undefined> {
  const f = await resolve(key);
  if (!f) return undefined;
  const { profile: u, provider: p, pending: x } = f;
  const isPro = Boolean(p || x);
  const phone = canonPhone(p?.phone ?? x?.phone ?? u?.phone ?? "");
  const status = await statusOf(f);
  const all = await listRequests();
  const mine = isPro && p
    ? all.filter((r) => r.matched.includes(p.id) || r.calls.some((c) => c.provider_id === p.id))
    : u ? all.filter((r) => r.customer.user_id === u.id) : [];
  return {
    key: personKey(f), name: p?.name ?? x?.name ?? u?.name ?? "", email: f.email, phone, country: countryName(phone), role: isPro ? "pro" : "customer", status, has_login: Boolean(u),
    signed_up_at: x?.created_at ?? u?.created_at ?? p?.onboarded_at,
    reviewed_at: x?.reviewed_at ?? u?.reviewed_at ?? (p && status === "approved" ? p.onboarded_at : undefined),
    reviewed_by: x?.reviewed_by || u?.reviewed_by || (p && status === "approved" ? p.onboarded_by : undefined),
    notes: f.email ? await getPersonNotes(f.email) : "",
    pro: isPro ? {
      categories: p ? ((p.categories ?? [p.category]) as Category[]) : x?.categories ?? [], area: p?.area ?? x?.area ?? "", visit_charge: p?.visit_charge ?? x?.visit_charge ?? "",
      consent_text: p?.consent_text || x?.consent_text || (p ? PRO_ONBOARD_CONSENT : "(wording not saved)"), consent_at: p?.consent_date ?? x?.consent_at ?? "",
      reliability: p?.reliability ?? 0, on_time_pct: p?.on_time_pct ?? 0, jobs: p?.jobs ?? 0, no_shows: p?.no_shows ?? 0, opt_out: p?.opt_out ?? false,
    } : undefined,
    bookings: mine.slice(0, 50).map((r) => ({ id: r.id, category: r.category, state: r.state, problem: r.problem, created_at: r.created_at })),
  };
}

type Result = { ok: true } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Result => ({ ok: false, error, status });

export async function approvePerson(key: string, by: string): Promise<Result> {
  const f = await resolve(key);
  if (!f) return fail("Not found.", 404);
  const { profile: u, provider: p, pending: x } = f;
  if (p) { // an existing Pro: put their number back on the approved list
    if (await isOperatorPhone(p.phone)) return fail(OPERATOR_PHONE_ERROR, 409);
    if (!p.consent_ai_call) return fail("This Pro has no recorded consent to AI calls.");
    await addApproved({ phone: p.phone, kind: "pro", name: p.name, email: p.email, consent_at: p.consent_date, added_by: by, note: "Approved from the person page" });
    await updateProvider(p.id, (z) => { z.opt_out = false; });
  } else if (x) { // a Pro application
    if (await isOperatorPhone(x.phone)) return fail(OPERATOR_PHONE_ERROR, 409);
    if ((await listProviders()).some((z) => z.phone === x.phone)) return fail("A Pro with this phone already exists.", 409);
    await createApprovedPro({ name: x.name, phone: x.phone, email: x.email, area: x.area, visit: Number(x.visit_charge.replace(/[^\d.]/g, "")), categories: x.categories, consentDate: x.consent_at.slice(0, 10), consentText: x.consent_text, by, note: "Approved from the pending list" });
    await setPendingProStatus(x.id, "approved", by);
  } else if (u) { // a customer
    const phone = toE164(u.phone);
    if (!phone || !u.email) return fail("This customer has no valid phone or email. Add them from the Approved tab instead.");
    if (await isOperatorPhone(phone)) return fail(OPERATOR_PHONE_ERROR, 409);
    await addApproved({ phone, kind: "customer", name: u.name || u.email, email: u.email, added_by: by, note: "Approved from the pending list" });
  }
  if (u) await setReview(u.id, "approved", by);
  await setReviewByEmail(f.email, "approved", by);
  return { ok: true };
}

/** Reject = never callable. An approved person is taken off the approved list; their login and records stay. */
export async function rejectPerson(key: string, by: string): Promise<Result> {
  const f = await resolve(key);
  if (!f) return fail("Not found.", 404);
  const { profile: u, provider: p, pending: x } = f;
  if (p) { await removeApprovedByPhone("pro", p.phone); await updateProvider(p.id, (z) => { z.opt_out = true; }); }
  else if (x) { if (x.status !== "rejected") await setPendingProStatus(x.id, "rejected", by); }
  else if (u) { const ph = toE164(u.phone); if (ph) await removeApprovedByPhone("customer", ph); }
  if (u) await setReview(u.id, "rejected", by);
  await setReviewByEmail(f.email, "rejected", by);
  return { ok: true };
}

export async function editPerson(key: string, b: { name?: unknown; phone?: unknown; area?: unknown; visit_charge?: unknown; categories?: unknown }): Promise<Result> {
  const f = await resolve(key);
  if (!f) return fail("Not found.", 404);
  const { profile: u, provider: p, pending: x } = f;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : undefined;
  if (name !== undefined && name.length < 2) return fail("Enter a name.");
  let phone: string | undefined;
  if (typeof b.phone === "string" && b.phone.trim()) {
    const e = toE164(b.phone);
    if (!e) return fail("Enter a valid phone number (with country code).");
    if (e !== canonPhone(p?.phone ?? x?.phone ?? u?.phone ?? "")) {
      if ((await statusOf(f)) === "approved") return fail("An approved number can't be edited: its consent was recorded for that number. Reject, change it, then approve again.", 409);
      if (await isOperatorPhone(e)) return fail(OPERATOR_PHONE_ERROR, 409);
      phone = e;
    }
  }
  const area = typeof b.area === "string" && b.area.trim() ? b.area.trim().slice(0, 60) : undefined;
  const visit = typeof b.visit_charge === "string" && /\d/.test(b.visit_charge) ? `₹${Number(b.visit_charge.replace(/[^\d.]/g, ""))}` : undefined;
  const { isCategory } = await import("./categories");
  const cats = Array.isArray(b.categories) ? (b.categories.filter(isCategory) as Category[]) : undefined;
  if (cats && cats.length === 0) return fail("Choose at least one category.");
  if (u && (name !== undefined || phone !== undefined)) await updateProfileDetails(u.id, name ?? u.name, phone);
  if (p) await updateProvider(p.id, (z) => { if (name) z.name = name; if (phone) z.phone = phone; if (area) z.area = area; if (visit) z.visit_charge = visit; if (cats) { z.categories = cats; z.category = cats[0]; } });
  if (x) await updatePendingPro(x.id, { name, phone, area, visit_charge: visit, categories: cats });
  return { ok: true };
}

export async function deletePerson(key: string, selfId: string): Promise<Result> {
  const f = await resolve(key);
  if (!f) return fail("Not found.", 404);
  const { profile: u, provider: p } = f;
  if (u && u.id === selfId) return fail("You can't delete your own account.", 403);
  const authIds: string[] = [];
  if (p) authIds.push(...((await deleteProvider(p.id))?.authIds ?? []));
  if (u) {
    const ph = toE164(u.phone);
    if (ph) await removeApprovedByPhone("customer", ph);
    if (await deleteProfile(u.id)) authIds.push(u.id);
  }
  await deleteAuthUsers([...new Set(authIds)].filter((i) => i !== selfId));
  if (!u && f.email) await deleteAuthUserByEmail(f.email); // an applicant who never signed in still has a login
  await deletePersonLeftovers(f.email);
  return { ok: true };
}

export { resolve as resolvePerson };
