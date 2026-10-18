import { NextResponse } from "next/server";
import { requireBookingAccess } from "@/lib/guard";
import { recordOutcome } from "@/lib/outcome";
import { getRequest, updateRequest } from "@/lib/store";

// The customer's "Job done" button. It completes the booking and updates the Pro's reliability, once.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireBookingAccess(id, { customerOnly: true });
  if ("error" in access) return access.error;
  const r = await getRequest(id);
  if (!r?.booking || r.booking.provider_confirmed === false) return NextResponse.json({ error: "This booking is not confirmed yet." }, { status: 409 });
  if (r.booking.job_done_at) return NextResponse.json({ ok: true });
  if (r.state === "cancelled") return NextResponse.json({ error: "This booking is cancelled." }, { status: 409 });
  await updateRequest(id, (x) => {
    x.booking!.job_done_at = new Date().toISOString();
    x.events.push({ at: new Date().toISOString(), text: "Customer pressed Job done" });
  });
  const res = await recordOutcome(id, "completed");
  if (!res.ok && res.status !== 409) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
