import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { kick } from "@/lib/kick";
import { getRequest, updateRequest } from "@/lib/store";

// Operator button "Call now": the ONLY thing that lets a live call start.
export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (!r.awaiting_call) return NextResponse.json({ error: "No call is waiting for approval." }, { status: 409 });
  await updateRequest(id, (x) => void (x.call_approved = x.awaiting_call));
  kick(id);
  return NextResponse.json({ ok: true });
}
