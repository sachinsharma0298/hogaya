import { NextResponse } from "next/server";
import { addPasswordReset, countOpenPasswordResets, findEmailByIdentifier } from "@/lib/store";

const MAX_OPEN = 100; // a brake: nobody can flood the operator's list

// "Forgot password": no email or text is sent. The request waits in the operator console, who sets a temporary password and tells the person privately.
// The answer is always the same, so nobody can use this to find out who has an account.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const typed = String(b.identifier ?? "").trim().slice(0, 120);
  if (!typed) return NextResponse.json({ error: "Enter your email or phone number." }, { status: 400 });
  if ((await countOpenPasswordResets()) < MAX_OPEN) {
    const email = await findEmailByIdentifier(typed);
    if (email) await addPasswordReset(email, typed);
  }
  return NextResponse.json({ ok: true });
}
