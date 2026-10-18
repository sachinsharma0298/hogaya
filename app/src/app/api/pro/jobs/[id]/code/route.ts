import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { flagBooking, notify, resolveFlagsMatching, transition } from "@/lib/booking";
import { getRequest, updateRequest } from "@/lib/store";

// The Pro types the 4-digit service code the customer gave at the door. A correct code means the Pro has arrived.
// A wrong code alerts the operator. The code itself is never sent back.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getSessionUser();
  if (u?.role !== "pro" || !u.provider_id) return NextResponse.json({ error: "Please log in as a Pro." }, { status: 401 });
  const r = await getRequest(id);
  const b = r?.booking;
  if (!r || !b || b.provider_id !== u.provider_id || b.provider_confirmed === false) return NextResponse.json({ error: "This is not your booked job." }, { status: 403 });
  if (r.state === "cancelled" || r.state === "paused") return NextResponse.json({ error: "This booking is on hold." }, { status: 409 });
  if (b.arrival_verified_at) return NextResponse.json({ ok: true, arrived: true });
  const { code } = await req.json().catch(() => ({}));
  const typed = String(code ?? "").replace(/\D/g, "");
  if (typed.length !== 4) return NextResponse.json({ error: "Enter the 4-digit code." }, { status: 400 });

  const now = new Date().toISOString();
  if (typed === b.arrival_code) {
    await updateRequest(id, (x) => {
      x.booking!.arrival_verified_at = now;
      x.booking!.arrival_flag = undefined;
      x.events.push({ at: now, text: `Arrival verified ✓: ${u.name} entered the right service code in the Pro app` });
    });
    await notify(id, "arrived", { name: u.name.split(" ")[0] });
    await transition(id, "arrived");
    await resolveFlagsMatching(id, /service code/); // the wrong-code flag is settled by the right code
    return NextResponse.json({ ok: true, arrived: true });
  }
  await updateRequest(id, (x) => {
    x.booking!.arrival_flag = `${u.name} entered a service code that does not match`;
    x.events.push({ at: now, text: `ARRIVAL NOT VERIFIED: ${u.name} entered a wrong service code in the Pro app` });
  });
  // One open flag at a time is enough: do not stack a new flag for every wrong try.
  if (!r.flags.some((f) => !f.resolved_at && /service code/.test(f.reason))) await flagBooking(id, `Wrong service code entered by ${u.name}: please check`);
  return NextResponse.json({ ok: false, arrived: false }, { status: 200 });
}
