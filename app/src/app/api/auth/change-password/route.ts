import { NextResponse } from "next/server";
import { setAuthPassword, validPassword } from "@/lib/accounts";
import { getSessionUser } from "@/lib/auth";
import { setMustChangePassword } from "@/lib/store";

// A signed-in person chooses a new password (used after the operator's temporary one). Supabase Auth keeps it, hashed; we never store or log it.
export async function POST(req: Request) {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (u.role === "operator") return NextResponse.json({ error: "The operator sets their password with npm run operator:password." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!validPassword(b.password)) return NextResponse.json({ error: "Choose a password of 8 to 72 characters." }, { status: 400 });
  const err = await setAuthPassword(u.id, b.password, false);
  if (err) return NextResponse.json({ error: err }, { status: 503 });
  await setMustChangePassword(u.id, false);
  return NextResponse.json({ ok: true });
}
