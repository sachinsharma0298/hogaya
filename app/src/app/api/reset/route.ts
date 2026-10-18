import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { hasActiveLiveCall, resetDemoData } from "@/lib/store";

// Operator button "Reset demo data" (the page asks for confirmation first).
export async function POST() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  if (await hasActiveLiveCall()) {
    return NextResponse.json({ error: "A live Fo call is still in progress. Wait for it to finish, then reset." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, ...resetDemoData() });
}
