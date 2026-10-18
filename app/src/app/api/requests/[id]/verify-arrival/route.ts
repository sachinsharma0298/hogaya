import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";

// Retired: arrival is now confirmed by the CUSTOMER (confirm-arrival), and the completion code is submitted by the Pro.
export async function POST() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ error: "The arrival call was replaced: the customer confirms the arrival and the Pro submits the completion code." }, { status: 410 });
}
