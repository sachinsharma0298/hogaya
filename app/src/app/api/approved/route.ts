import { NextResponse } from "next/server";
import { foMayCall, toE164 } from "@/lib/phone";
import { requireRole } from "@/lib/guard";
import { bookingLink } from "@/lib/booking-link";
import { addApproved, isOperatorPhone, listApproved, OPERATOR_PHONE_ERROR } from "@/lib/store";

// Operator only: the numbers a LIVE Fo call may reach. Everyone else gets simulated calls.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ approved: (await listApproved()).map((a) => ({ ...a, callable: foMayCall(a.phone) })) });
}

export async function POST(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "pro" || b.kind === "customer" ? b.kind : null;
  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = toE164(b.phone);
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!kind || !name || !phone) return NextResponse.json({ error: "Enter a name and a valid phone number (with country code)." }, { status: 400 });
  if (await isOperatorPhone(phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  if (kind === "customer" && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "A customer needs the email they sign in with." }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "Confirm that this person agreed to AI calls." }, { status: 400 });
  const consentAt = typeof b.consent_at === "string" && /^\d{4}-\d{2}-\d{2}/.test(b.consent_at) ? b.consent_at : undefined;
  const row = await addApproved({ phone, kind, name, email, consent_at: consentAt, added_by: auth.user.email ?? auth.user.name, note: String(b.note ?? "").slice(0, 200) });
  // A customer you approve gets a one-click booking link: you send it to them yourself (Hogaya sends nothing).
  return NextResponse.json({ ok: true, approved: row, link: kind === "customer" ? await bookingLink(email) : undefined });
}
