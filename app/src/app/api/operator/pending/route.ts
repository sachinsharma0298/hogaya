import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { listPendingCustomers, listPendingPros } from "@/lib/store";

// Operator only: who is waiting for approval.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ customers: await listPendingCustomers(), pros: await listPendingPros() });
}
