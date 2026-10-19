import { NextResponse } from "next/server";
import { deleteAuthUsers } from "@/lib/accounts";
import { requireRole } from "@/lib/guard";
import { deleteApproved } from "@/lib/store";

// Operator only. Removes the approval and, for a customer, their login too (a Pro entry removes the Pro as well).
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const res = await deleteApproved(Number((await params).id));
  if (!res) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await deleteAuthUsers(res.authIds.filter((i) => i !== auth.user.id));
  return NextResponse.json({ ok: true });
}
