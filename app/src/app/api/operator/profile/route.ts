import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { requireRole } from "@/lib/guard";
import { getOperatorProfile, phoneInUseByOthers, saveOperatorProfile } from "@/lib/store";

// Operator only: display name and phone. The email and password are not editable here.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ ...(await getOperatorProfile()), email: auth.user.email ?? "" });
}

export async function PUT(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const raw = String(b.phone ?? "").trim();
  const phone = raw ? toE164(raw) : "";
  if (name.length < 2) return NextResponse.json({ error: "Enter a display name (at least 2 characters)." }, { status: 400 });
  if (phone === null) return NextResponse.json({ error: "Enter a valid phone number (with country code), or leave it empty." }, { status: 400 });
  if (phone && (await phoneInUseByOthers(phone))) return NextResponse.json({ error: "A Pro, approved person or customer already uses this number. The operator's number is reserved, so use a different one." }, { status: 409 });
  await saveOperatorProfile(name, phone);
  return NextResponse.json({ ok: true, ...(await getOperatorProfile()) });
}
