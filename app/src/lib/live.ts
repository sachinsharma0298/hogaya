// The rule that decides whether a booking may ever use REAL Fo calls. Everything else runs the same flow with simulated calls.
import { MODE } from "./mode";
import { isApproved, listProviders } from "./store";
import type { Category } from "./categories";
import type { Provider, User } from "./types";

/** Real Pros for a category whose number is on the approved list, with consent recorded and not opted out. */
export async function approvedPros(category: Category): Promise<Provider[]> {
  const out: Provider[] = [];
  for (const p of await listProviders()) {
    if (!(p.categories ?? [p.category]).includes(category) || !p.consent_ai_call || !p.consent_date || p.opt_out) continue;
    if (await isApproved("pro", p.phone)) out.push(p);
  }
  return out;
}

/**
 * Live only when ALL of these hold: the server is in real mode; this customer (email + phone) is on the approved list;
 * at least one approved Pro does this job. Anything else is "Demo: simulated calls": nobody is ever phoned.
 */
export async function decideLive(user: User, phone: string, category: Category): Promise<{ live: boolean; why: string }> {
  if (MODE !== "real") return { live: false, why: "Live calls are switched off on this server." };
  if (!(await isApproved("customer", phone, user.email))) return { live: false, why: "This customer is not on the approved list for live calls." };
  if ((await approvedPros(category)).length === 0) return { live: false, why: "No approved Pro does this job yet." };
  return { live: true, why: "" };
}

export const MAX_REQUESTS_PER_USER_PER_DAY = Number(process.env.MAX_REQUESTS_PER_USER_PER_DAY ?? 3);
export const MAX_REQUESTS_PER_DAY = Number(process.env.MAX_REQUESTS_PER_DAY ?? 200);
