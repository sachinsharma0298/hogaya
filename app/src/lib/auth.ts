// Who is signed in. Production: Supabase Auth (email magic link or Google). The operator is ONE email, set in OPERATOR_EMAIL.
// Local development only (DEV_LOGIN=1 and no DATABASE_URL): a cookie-based stand-in so the app can be tried without Supabase.
import { cookies } from "next/headers";
import { findApprovedCustomerByEmail, findProviderByEmail, findUser, saveUser } from "./store";
import { supabaseConfigured, supabaseServer } from "./supabase/server";
import type { Role, User } from "./types";

export const DEV_COOKIE = "hogaya_dev_session";
export const DEMO_CODE = "123456"; // dev login only

export const operatorEmail = () => (process.env.OPERATOR_EMAIL ?? "").trim().toLowerCase();
/** The stand-in login exists only on a developer's Mac: never when a real database is connected. */
export const devLoginEnabled = () => process.env.DEV_LOGIN === "1" && !process.env.DATABASE_URL;

/** Make sure a signed-in Supabase user has a profile with the right role. The role is decided here, never by the user. */
export async function ensureProfile(au: { id: string; email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> }): Promise<User> {
  const email = (au.email ?? "").trim().toLowerCase();
  const op = operatorEmail();
  const isOperator = Boolean(op) && email === op && Boolean(au.email_confirmed_at);
  const provider = email ? await findProviderByEmail(email) : undefined;
  const role: Role = isOperator ? "operator" : provider ? "pro" : "customer";
  const existing = await findUser(au.id);
  const approved = !existing && role === "customer" && email ? await findApprovedCustomerByEmail(email) : undefined; // a customer Hogaya added: their name and number are already known
  const name = existing?.name || approved?.name || String(au.user_metadata?.full_name ?? au.user_metadata?.name ?? provider?.name ?? email.split("@")[0] ?? "");
  const want = { role, provider_id: role === "pro" ? provider?.id : undefined };
  // A person Hogaya approved as a customer (the operator too) has their number filled in from that record.
  const approvedPhone = existing?.phone || role === "pro" || !email ? undefined : (await findApprovedCustomerByEmail(email))?.phone;
  if (existing && existing.role === want.role && existing.provider_id === want.provider_id && !approvedPhone) return existing;
  return saveUser({ id: au.id, role, name, phone: existing?.phone || (approved ? `+91${approved.phone}` : approvedPhone ? `+91${approvedPhone}` : String(au.user_metadata?.phone ?? "")), email, provider_id: want.provider_id, created_at: existing?.created_at ?? new Date().toISOString() });
}

export async function getSessionUser(): Promise<User | undefined> {
  if (devLoginEnabled()) {
    const id = (await cookies()).get(DEV_COOKIE)?.value;
    if (id) return findUser(id);
  }
  if (!supabaseConfigured()) return undefined;
  const { data } = await (await supabaseServer()).auth.getUser(); // asks Supabase to verify the token: not just reading a cookie
  return data.user ? ensureProfile(data.user) : undefined;
}

export async function setDevSession(userId: string) {
  (await cookies()).set(DEV_COOKIE, userId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  (await cookies()).delete(DEV_COOKIE);
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
}

export const isRole = (r: unknown): r is Role => r === "customer" || r === "pro" || r === "operator";

/** Does this phone look like an Indian mobile number (10 digits, optionally with +91 or 91)? */
export const validPhone = (raw: string) => /^(\+?91)?[6-9]\d{9}$/.test(raw.replace(/[\s-]/g, ""));

/** Only follow redirects that stay on this site. */
export const safeNext = (next: string | null | undefined, fallback = "/") => (next && /^\/(?![/\\])/.test(next) ? next : fallback);
