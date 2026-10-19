import { NextResponse } from "next/server";
import { accountsAvailable, createAuthUser, MAX_SIGNUPS_PER_HOUR, reservedEmail, signupsLastHour, validPassword } from "@/lib/accounts";
import { isCategory, type Category } from "@/lib/categories";
import { toE164 } from "@/lib/phone";
import { addPendingPro, isOperatorPhone, listProviders, OPERATOR_PHONE_ERROR, pendingProExists } from "@/lib/store";

// Public Pro sign-up. Nothing here makes anyone callable: the application waits in "Pending Pros" until the operator approves it.
// The Supabase account (with the password they choose) is created now, but stays a plain customer login until the approval.
export async function POST(req: Request) {
  if (!accountsAvailable()) return NextResponse.json({ error: "Sign-up is not available on this server." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().toLowerCase();
  const phone = toE164(b.phone);
  const area = String(b.area ?? "").trim().slice(0, 60);
  const visit = Number(String(b.visit_charge ?? "").replace(/[^\d.]/g, ""));
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter(isCategory) as Category[];
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || !phone || !area || !(visit > 0) || categories.length === 0) {
    return NextResponse.json({ error: "Enter your name, a valid email, a valid phone (with country code), at least one category, your area and your visit charge." }, { status: 400 });
  }
  if (!validPassword(b.password)) return NextResponse.json({ error: "Choose a password of 8 to 72 characters." }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "You must agree to receive AI phone calls from Fo on behalf of Hogaya." }, { status: 400 });
  if (await isOperatorPhone(phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  if ((await reservedEmail(email)) || (await listProviders()).some((p) => p.phone === phone) || (await pendingProExists(email, phone))) {
    return NextResponse.json({ error: "This email or phone is already registered or waiting for approval." }, { status: 409 });
  }
  if ((await signupsLastHour()) >= MAX_SIGNUPS_PER_HOUR) return NextResponse.json({ error: "Too many sign-ups right now. Please try again later." }, { status: 429 });
  const res = await createAuthUser({ email, password: b.password, name, phone });
  if (!res.ok) return NextResponse.json({ error: res.exists ? "An account with this email already exists. Sign in, or use a different email." : "Could not create your account." }, { status: res.exists ? 409 : 500 });
  await addPendingPro({ id: `pp-${Math.random().toString(36).slice(2, 8)}`, name, email, phone, categories, area, visit_charge: `₹${visit}`, consent_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
