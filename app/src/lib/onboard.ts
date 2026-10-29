// Creating a real Pro (with their approved number). Used when the operator onboards a Pro and when they approve a pending one.
import type { Category } from "./categories";
import { addApproved, addProvider } from "./store";
import type { CallLang } from "./call-scripts/hogaya-context";
import type { Provider } from "./types";

export async function createApprovedPro(o: { name: string; phone: string; email: string; area: string; visit: number; categories: Category[]; consentDate: string; consentText?: string; callLang?: CallLang; by: string; note: string }): Promise<Provider> {
  const p = await addProvider({
    id: `p-${Math.random().toString(36).slice(2, 8)}`, name: o.name, category: o.categories[0], categories: o.categories, area: o.area, visit_charge: `₹${o.visit}`,
    phone: o.phone, email: o.email, consent_ai_call: true, consent_date: o.consentDate, consent_text: o.consentText, call_lang: o.callLang, opt_out: false, reliability: 70, on_time_pct: 0, jobs: 0, no_shows: 0, demo: false,
    onboarded_by: o.by, onboarded_at: new Date().toISOString(),
  });
  await addApproved({ phone: o.phone, kind: "pro", name: o.name, email: o.email, consent_at: o.consentDate, added_by: o.by, note: o.note });
  return p;
}
