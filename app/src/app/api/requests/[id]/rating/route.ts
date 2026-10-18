import { NextResponse } from "next/server";
import { requireBookingAccess } from "@/lib/guard";
import { transition } from "@/lib/booking";
import { getRequest, updateRequest } from "@/lib/store";

// The customer's rating and feedback after "Job done". It closes the booking.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireBookingAccess(id, { customerOnly: true });
  if ("error" in access) return access.error;
  const { stars, feedback } = await req.json().catch(() => ({}));
  const r = await getRequest(id);
  if (!r?.booking?.job_done_at) return NextResponse.json({ error: "Press Job done first." }, { status: 409 });
  if (r.booking.rating) return NextResponse.json({ ok: true });
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) return NextResponse.json({ error: "Pick 1 to 5 stars." }, { status: 400 });
  await updateRequest(id, (x) => {
    x.booking!.rating = { stars: n, feedback: typeof feedback === "string" ? feedback.slice(0, 500) : "", at: new Date().toISOString() };
    x.events.push({ at: new Date().toISOString(), text: `Customer rated ${n}/5` });
  });
  await transition(id, "closed");
  return NextResponse.json({ ok: true });
}
