import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { patchCall, getRequest, updateRequest } from "@/lib/store";

// The operator answers a question Fo asked instead of calling (for example "should I dial now?").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { call_id, message } = await req.json().catch(() => ({}));
  const c = (await getRequest(id))?.calls.find((x) => x.id === call_id);
  if (!c || c.status !== "needs_reply") return NextResponse.json({ error: "Fo is not waiting for an answer." }, { status: 409 });
  if (typeof message !== "string" || !message.trim()) return NextResponse.json({ error: "Type an answer first." }, { status: 400 });
  await patchCall(id, call_id, { operator_reply: message.trim() });
  await updateRequest(id, (x) => void x.events.push({ at: new Date().toISOString(), text: "Operator answered Fo's question" }));
  return NextResponse.json({ ok: true });
}
