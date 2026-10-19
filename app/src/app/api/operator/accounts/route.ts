import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { accountsAvailable, createAuthUser, validPassword } from "@/lib/accounts";
import { requireRole } from "@/lib/guard";
import { findProviderByEmail, isOperatorPhone, listUsers, OPERATOR_PHONE_ERROR } from "@/lib/store";

// Operator only: the people who have an account, and creating (or resetting the password of) a customer or Pro account.
// A Pro account needs a Pro the operator already onboarded with that email. The operator account is the one OPERATOR_EMAIL.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ accounts: (await listUsers()).map((u) => ({ id: u.id, role: u.role, name: u.name, email: u.email ?? "", phone: u.phone ? `•••• ${u.phone.replace(/\D/g, "").slice(-4)}` : "", provider_id: u.provider_id, status: u.review ?? "approved" })), canCreate: accountsAvailable() });
}

export async function POST(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  if (!accountsAvailable()) return NextResponse.json({ error: "Creating accounts needs Supabase (not available here)." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const role = b.role === "pro" || b.role === "customer" ? b.role : null;
  const name = String(b.name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().toLowerCase();
  const phone = toE164(b.phone);
  if (!role || name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || !phone) return NextResponse.json({ error: "Enter the role, name, a valid email and a valid phone number (with country code)." }, { status: 400 });
  if (await isOperatorPhone(phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  if (!validPassword(b.password)) return NextResponse.json({ error: "The password needs 8 to 72 characters." }, { status: 400 });
  if (role === "pro" && !(await findProviderByEmail(email))) return NextResponse.json({ error: "Onboard this Pro first (Providers tab) with this same email." }, { status: 409 });
  const res = await createAuthUser({ email, password: b.password, name, phone, replaceIfExists: true });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, id: res.id });
}
