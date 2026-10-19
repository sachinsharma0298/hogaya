import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { isCategory, type Category } from "@/lib/categories";
import { requireRole } from "@/lib/guard";
import { createApprovedPro } from "@/lib/onboard";
import { findProviderByEmail, getProviders, isOperatorPhone, listProviders, OPERATOR_PHONE_ERROR } from "@/lib/store";

export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ providers: (await getProviders()).map((p) => ({ id: p.id, name: p.name, category: p.category })) });
}

// Operator onboards a Pro: no KYC, but a recorded consent to AI calls (with its date). The Pro's number goes on the approved
// list in the same step, and the Pro signs in with this email.
export async function POST(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = toE164(b.phone);
  const email = String(b.email ?? "").trim().toLowerCase();
  const area = String(b.area ?? "").trim().slice(0, 60);
  const visit = Number(String(b.visit_charge ?? "").replace(/[^\d.]/g, ""));
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter(isCategory) as Category[];
  const consentDate = typeof b.consent_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.consent_date) ? b.consent_date : new Date().toISOString().slice(0, 10);
  if (!name || !phone || !/^\S+@\S+\.\S+$/.test(email) || !area || !(visit > 0) || categories.length === 0) {
    return NextResponse.json({ error: "Enter name, a valid phone (with country code), the email the Pro signs in with, area, visit charge and at least one category." }, { status: 400 });
  }
  if (b.consent !== true) return NextResponse.json({ error: "Confirm that the Pro agreed to AI calls." }, { status: 400 });
  if (await isOperatorPhone(phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  const existing = await listProviders();
  if (existing.some((p) => p.phone === phone) || (await findProviderByEmail(email))) return NextResponse.json({ error: "A Pro with this phone or email already exists." }, { status: 409 });

  const p = await createApprovedPro({ name, phone, email, area, visit, categories, consentDate, by: auth.user.email ?? auth.user.name, note: "Onboarded as a Pro" });
  return NextResponse.json({ ok: true, provider: { id: p.id, name: p.name } });
}
