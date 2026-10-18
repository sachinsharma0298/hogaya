import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { startCall } from "@/lib/engine";
import { kick } from "@/lib/kick";
import { hasCallInFlight } from "@/lib/live-actions";
import { getRequest } from "@/lib/store";

// Operator button: Call customer now. For live requests this is the click that places the real call.
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (hasCallInFlight(r)) return NextResponse.json({ error: "Another call for this request is still in progress." }, { status: 409 });
  if (r.booking) return NextResponse.json({ error: "Already booked." }, { status: 409 });
  if (r.step !== "shortlist_ready") return NextResponse.json({ error: "The shortlist is not ready yet." }, { status: 409 });
  if (!r.customer.consent_ai_call) return NextResponse.json({ error: "The customer did not consent to an AI call." }, { status: 403 });
  const res = await startCall(id, "customer"); // sends the brief to Fo and returns; the tick engine follows the call
  kick(id);
  return startReply(res);
}

function startReply(res: string) {
  if (res === "started") return NextResponse.json({ ok: true });
  if (res === "line") return NextResponse.json({ ok: true, queued: true, note: "Another live call is running: this one starts when it finishes." });
  return NextResponse.json({ error: "The call was not started. See the timeline for why." }, { status: 409 });
}
