import { NextResponse } from "next/server";
import { deleteAllAuthUsersExceptOperator } from "@/lib/accounts";
import { requireRole } from "@/lib/guard";
import { hasActiveLiveCall, resetAllData } from "@/lib/store";

// Operator button "Reset all data" (the page makes you type RESET first, and it is checked again here).
// Keeps: the operator account, the Fo sign-in, the 10 categories and the database structure. Nothing is reseeded.
export async function POST(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== "RESET") return NextResponse.json({ error: "Type RESET to confirm." }, { status: 400 });
  if (await hasActiveLiveCall()) {
    return NextResponse.json({ error: "A live Fo call is still in progress. Wait for it to finish, then reset." }, { status: 409 });
  }
  const out = await resetAllData();
  const removedLogins = await deleteAllAuthUsersExceptOperator();
  return NextResponse.json({ ok: true, ...out, removedLogins });
}
