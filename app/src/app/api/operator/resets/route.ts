import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { listOpenPasswordResets } from "@/lib/store";

// Operator only: people who asked for a password reset. Never contains a password.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ resets: await listOpenPasswordResets() });
}
