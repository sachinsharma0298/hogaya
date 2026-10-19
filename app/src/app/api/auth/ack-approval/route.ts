import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markApprovalSeen } from "@/lib/store";

// The person has seen "Approved by Hogaya": do not show it again.
export async function POST() {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  await markApprovalSeen(u.id);
  return NextResponse.json({ ok: true });
}
