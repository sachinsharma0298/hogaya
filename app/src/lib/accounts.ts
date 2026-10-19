// Creating password accounts. Passwords are never stored by us: Supabase Auth keeps them (hashed) and checks them.
import { operatorEmail } from "./auth";
import { q } from "./db";
import { findApprovedCustomerByEmail, findProviderByEmail } from "./store";
import { supabaseAdmin, supabaseConfigured } from "./supabase/server";

export const accountsAvailable = () => supabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Emails that carry special rights (operator, Pro, approved-for-live-calls customer). Nobody may self-register them:
 *  the server marks self-registered emails as confirmed without checking the inbox, so otherwise anyone could take them over. */
export async function reservedEmail(email: string): Promise<string | null> {
  const e = email.toLowerCase();
  if (operatorEmail() && e === operatorEmail()) return "operator";
  if (await findProviderByEmail(e)) return "pro";
  if (await findApprovedCustomerByEmail(e)) return "approved customer";
  return null;
}

export const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 8 && p.length <= 72;

/** Create a confirmed Supabase Auth user (no email is sent, so the hourly email limit never applies). */
export async function createAuthUser(o: { email: string; password: string; name: string; phone: string; replaceIfExists?: boolean }): Promise<{ ok: true; id: string } | { ok: false; exists?: boolean; error: string }> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email: o.email, password: o.password, email_confirm: true, user_metadata: { full_name: o.name, phone: o.phone } });
  if (!error && data.user) return { ok: true, id: data.user.id };
  if (/already|registered|exists/i.test(error?.message ?? "")) {
    if (!o.replaceIfExists) return { ok: false, exists: true, error: "An account with this email already exists." };
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list.data.users.find((x) => x.email?.toLowerCase() === o.email.toLowerCase());
    if (!u) return { ok: false, error: "Could not find the existing account." };
    const upd = await admin.auth.admin.updateUserById(u.id, { password: o.password, email_confirm: true });
    return upd.error ? { ok: false, error: upd.error.message } : { ok: true, id: u.id };
  }
  return { ok: false, error: error?.message ?? "Could not create the account." };
}

/** A site-wide brake on sign-ups (no phone OTP yet): at most this many new accounts per hour. */
export async function signupsLastHour(): Promise<number> {
  return Number((await q<{ n: number }>("select count(*)::int n from auth.users where created_at > now() - interval '1 hour'"))[0]?.n ?? 0);
}
export const MAX_SIGNUPS_PER_HOUR = Number(process.env.MAX_SIGNUPS_PER_HOUR ?? 30);

/** Remove Supabase Auth logins (their profile rows are already gone). Locally there is no Supabase, so the stand-in table is cleaned instead. */
export async function deleteAuthUsers(ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (accountsAvailable()) {
    for (const id of ids) await supabaseAdmin().auth.admin.deleteUser(id);
  } else if ((await (await import("./db")).getDb()).engine === "pglite") {
    await q("delete from auth.users where id = any($1::uuid[])", [`{${ids.join(",")}}`]);
  }
}

/** Remove every Auth login except the operator's (used by "Reset all data"). */
export async function deleteAllAuthUsersExceptOperator(): Promise<number> {
  const op = operatorEmail();
  if (!accountsAvailable()) {
    if ((await (await import("./db")).getDb()).engine !== "pglite") return 0;
    return (await q("delete from auth.users where lower(coalesce(email,'')) <> $1 returning id", [op])).length;
  }
  const admin = supabaseAdmin();
  let removed = 0;
  for (let page = 1; page < 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = (data?.users ?? []).filter((u) => (u.email ?? "").toLowerCase() !== op);
    for (const u of users) { await admin.auth.admin.deleteUser(u.id); removed++; }
    if ((data?.users ?? []).length < 1000) break;
  }
  return removed;
}
