import { NextResponse } from "next/server";
import { validPhone } from "@/lib/auth";
import { requireRole } from "@/lib/guard";
import { getOperatorProfile, saveOperatorProfile } from "@/lib/store";

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
  const phone = String(b.phone ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Enter a display name (at least 2 characters)." }, { status: 400 });
  if (phone && !validPhone(phone)) return NextResponse.json({ error: "Enter a valid 10-digit phone, or leave it empty." }, { status: 400 });
  await saveOperatorProfile(name, phone);
  return NextResponse.json({ ok: true, ...(await getOperatorProfile()) });
}
