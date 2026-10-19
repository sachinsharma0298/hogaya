// Who is signed in. Production: Supabase Auth (email magic link or Google). The operator is ONE email, set in OPERATOR_EMAIL.
// Local development only (DEV_LOGIN=1 and no DATABASE_URL): a cookie-based stand-in so the app can be tried without Supabase.
import { cookies } from "next/headers";
import { canonPhone, toE164 } from "./phone";
import { findApprovedCustomerByEmail, findPendingProAny, findProviderByEmail, findUser, getOperatorProfile, isApproved, saveUser, setMustChangePassword, setReview } from "./store";
import { supabaseConfigured, supabaseServer } from "./supabase/server";
import type { Review, Role, User } from "./types";

export const DEV_COOKIE = "hogaya_dev_session";
export const DEMO_CODE = "123456"; // dev login only

export const operatorEmail = () => (process.env.OPERATOR_EMAIL ?? "").trim().toLowerCase();
/** The stand-in login exists only on a developer's Mac: never when a real database is connected. */
export const devLoginEnabled = () => process.env.DEV_LOGIN === "1" && !process.env.DATABASE_URL;

/** Make sure a signed-in Supabase user has a profile with the right role. The role is decided here, never by the user.
 *  A new profile also gets its review status: Pros, the operator and customers Hogaya already approved start Approved,
 *  a Pro whose application was rejected starts Rejected, and everyone else starts Pending until the operator decides. */
export async function ensureProfile(au: { id: string; email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): Promise<User> {
  const email = (au.email ?? "").trim().toLowerCase();
  const op = operatorEmail();
  const isOperator = Boolean(op) && email === op && Boolean(au.email_confirmed_at);
  const provider = email ? await findProviderByEmail(email) : undefined;
  const role: Role = isOperator ? "operator" : provider ? "pro" : "customer";
  const existing = await findUser(au.id);
  const lookApproved = !existing || existing.review === "pending" || !existing.phone; // skip the extra query for people already settled
  const approvedEntry = lookApproved && role === "customer" && email ? await findApprovedCustomerByEmail(email) : undefined; // a customer Hogaya added: their name and number are already known
  const name = existing?.name || approvedEntry?.name || String(au.user_metadata?.full_name ?? au.user_metadata?.name ?? provider?.name ?? email.split("@")[0] ?? "");
  const want = { role, provider_id: role === "pro" ? provider?.id : undefined };
  // A person Hogaya approved as a customer (the operator too) has their number filled in from that record.
  const approvedPhone = existing?.phone || !approvedEntry ? undefined : approvedEntry.phone;
  if (existing) {
    const stale = existing.role !== want.role || existing.provider_id !== want.provider_id || Boolean(approvedPhone);
    const promote = existing.review !== "approved" && (role === "pro" ? await isApproved("pro", provider!.phone) : Boolean(approvedEntry));
    if (!stale && !promote) return existing;
    if (stale) await saveUser({ ...existing, role, name, phone: existing.phone || approvedPhone || canonPhone(au.user_metadata?.phone), email, provider_id: want.provider_id });
    // A Pro (or a customer the operator approved on the list) is Approved, whatever the profile said before.
    if (promote) await setReview(existing.id, "approved", approvedEntry?.added_by ?? provider?.onboarded_by ?? "");
    return (await findUser(au.id))!;
  }
  const application = email ? await findPendingProAny({ email }) : undefined;
  const review: Review = role !== "customer" || approvedEntry ? "approved" : application?.status === "rejected" ? "rejected" : "pending";
  const decidedBy = approvedEntry?.added_by ?? provider?.onboarded_by ?? "";
  const user = await saveUser({
    id: au.id, role, name, phone: approvedEntry ? approvedEntry.phone : canonPhone(au.user_metadata?.phone), email, provider_id: want.provider_id, created_at: new Date().toISOString(),
    review, reviewed_at: review === "pending" ? undefined : new Date().toISOString(), reviewed_by: review === "pending" ? undefined : application?.reviewed_by || decidedBy,
    approval_seen: !(application?.status === "approved"), // someone who applied and was approved sees "Approved by Hogaya" once
  });
  if (au.app_metadata?.must_change_password === true) await setMustChangePassword(au.id, true);
  return (await findUser(au.id)) ?? user;
}

/** The operator's name and phone come from "My profile" (default name: Virat), not from the sign-in email. */
async function withOperatorProfile(u: User | undefined): Promise<User | undefined> {
  if (u?.role !== "operator") return u;
  const p = await getOperatorProfile();
  return { ...u, name: p.name, phone: p.phone || u.phone };
}

export async function getSessionUser(): Promise<User | undefined> {
  if (devLoginEnabled()) {
    const id = (await cookies()).get(DEV_COOKIE)?.value;
    if (id) return withOperatorProfile(await findUser(id));
  }
  if (!supabaseConfigured()) return undefined;
  const { data } = await (await supabaseServer()).auth.getUser(); // asks Supabase to verify the token: not just reading a cookie
  return data.user ? withOperatorProfile(await ensureProfile(data.user)) : undefined;
}

export async function setDevSession(userId: string) {
  (await cookies()).set(DEV_COOKIE, userId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  (await cookies()).delete(DEV_COOKIE);
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
}

export const isRole = (r: unknown): r is Role => r === "customer" || r === "pro" || r === "operator";

/** Is this a valid phone number (any country; a bare 10-digit number is Indian)? */
export const validPhone = (raw: string) => toE164(raw) !== null;

/** Only follow redirects that stay on this site. */
export const safeNext = (next: string | null | undefined, fallback = "/") => (next && /^\/(?![/\\])/.test(next) ? next : fallback);
