import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { flagBooking, notify, transition } from "@/lib/booking";
import { requireBookingAccess } from "@/lib/guard";
import { updateRequest } from "@/lib/store";

const CODE_HOURS = 24;

// The CUSTOMER confirms (or denies) that the Pro has arrived. Confirming issues the one-time completion code for this booking.
// The customer gives it to the Pro when the job is done; the Pro submits it in the Pro app to complete the booking.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireBookingAccess(id, { customerOnly: true });
  if ("error" in access) return access.error;
  const r = access.request;
  const b = r.booking;
  if (!b || !b.pro_arrived_at) return NextResponse.json({ error: "The Pro has not said they have arrived yet." }, { status: 409 });
  if (b.arrival_verified_at) return NextResponse.json({ ok: true, already: true }); // pressing twice never issues a second code
  if (r.state === "cancelled" || r.state === "paused" || r.state === "flagged") return NextResponse.json({ error: "This booking is on hold." }, { status: 409 });
  const { arrived } = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (arrived === false) {
    await updateRequest(id, (x) => { x.booking!.pro_arrived_at = undefined; x.events.push({ at: now, text: "Customer says the Pro has NOT arrived" }); });
    await transition(id, b.reconfirmed_at ? "reconfirmed" : "booked");
    await flagBooking(id, "The Pro said they arrived but the customer says they have not: please check");
    return NextResponse.json({ ok: true, denied: true });
  }

  const code = String(randomInt(100000, 1000000)); // 6 digits, tied to this booking only
  await updateRequest(id, (x) => {
    if (x.booking!.arrival_verified_at) return; // another click got here first
    x.booking!.arrival_verified_at = now;
    x.booking!.arrival_code = code;
    x.booking!.code_issued_at = now;
    x.booking!.code_expires_at = new Date(Date.now() + CODE_HOURS * 3600_000).toISOString();
    x.booking!.code_attempts = 0;
    x.events.push({ at: now, text: "Customer confirmed the Pro has arrived: completion code issued" });
  });
  await transition(id, "arrived");
  await notify(id, "arrived", { name: (access.user.name ?? "").split(" ")[0] });
  return NextResponse.json({ ok: true });
}
