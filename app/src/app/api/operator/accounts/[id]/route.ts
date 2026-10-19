import { NextResponse } from "next/server";
import { deleteAuthUsers } from "@/lib/accounts";
import { requireRole } from "@/lib/guard";
import { deleteProfile } from "@/lib/store";

// Operator only: delete a login account. The operator account can never be deleted.
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (id === auth.user.id) return NextResponse.json({ error: "The operator account can't be deleted." }, { status: 403 });
  if (!(await deleteProfile(id))) return NextResponse.json({ error: "Account not found, or it is the operator account." }, { status: 404 });
  await deleteAuthUsers([id]);
  return NextResponse.json({ ok: true });
}
