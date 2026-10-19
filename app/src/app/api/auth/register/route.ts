import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { isOperatorPhone, OPERATOR_PHONE_ERROR } from "@/lib/store";
import { accountsAvailable, createAuthUser, MAX_SIGNUPS_PER_HOUR, reservedEmail, signupsLastHour, validPassword } from "@/lib/accounts";

// Open registration: name, email, phone and a password the person chooses. The phone number is NOT verified (no OTP yet),
// so a self-registered account is only ever a plain customer, and live calls still need the operator's approved list.
export async function POST(req: Request) {
  if (!accountsAvailable()) return NextResponse.json({ error: "Registration is not available on this server." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().toLowerCase();
  const phone = toE164(b.phone);
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || !phone) return NextResponse.json({ error: "Enter your name, a valid email and a valid phone number (choose the country code)." }, { status: 400 });
  if (await isOperatorPhone(phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  if (!validPassword(b.password)) return NextResponse.json({ error: "Choose a password of 8 to 72 characters." }, { status: 400 });
  if (await reservedEmail(email)) return NextResponse.json({ error: "This email is set up by Hogaya. Ask the operator to create your account." }, { status: 403 });
  if ((await signupsLastHour()) >= MAX_SIGNUPS_PER_HOUR) return NextResponse.json({ error: "Too many new accounts right now. Please try again later." }, { status: 429 });
  const res = await createAuthUser({ email, password: b.password, name, phone });
  if (!res.ok) return NextResponse.json({ error: res.exists ? "An account with this email already exists. Please sign in." : "Could not create the account." }, { status: res.exists ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
