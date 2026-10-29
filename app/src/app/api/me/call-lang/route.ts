import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isCallLang } from "@/lib/call-scripts/hogaya-context";
import { setUserCallLang } from "@/lib/store";

// The signed-in customer's preferred call language ("english" or "hindi"). A Pro changes theirs on the Pro profile.
export async function GET() {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ call_lang: u.call_lang ?? null });
}

export async function PUT(req: Request) {
  const u = await getSessionUser();
  if (!u || (u.role !== "customer" && u.role !== "operator")) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!isCallLang(b.call_lang)) return NextResponse.json({ error: "Choose English or Hindi." }, { status: 400 });
  await setUserCallLang(u.id, b.call_lang);
  return NextResponse.json({ ok: true });
}
