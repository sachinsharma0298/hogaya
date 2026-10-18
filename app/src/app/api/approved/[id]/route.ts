import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { removeApproved } from "@/lib/store";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const ok = await removeApproved(Number((await params).id));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
