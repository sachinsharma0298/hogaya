import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { recheckCall } from "@/lib/engine";
import { kick } from "@/lib/kick";
import { getRequest } from "@/lib/store";

// "Check again" for a call whose summary did not arrive in time, or whose summary Claude could not read. No new call is ever placed.
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { call_id } = await req.json().catch(() => ({}));
  const c = (await getRequest(id))?.calls.find((x) => x.id === call_id);
  if (!c || !["timed_out", "needs_review"].includes(c.status)) return NextResponse.json({ error: "Nothing to check." }, { status: 409 });
  await recheckCall(id, call_id); // reads Fo's conversation again (or re-reads the saved summary): no new call
  kick(id);
  return NextResponse.json({ ok: true });
}
