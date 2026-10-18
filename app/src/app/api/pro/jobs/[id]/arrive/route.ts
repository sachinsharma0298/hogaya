import { NextResponse } from "next/server";
import { notify, transition } from "@/lib/booking";
import { requireRole } from "@/lib/guard";
import { getRequest, updateRequest } from "@/lib/store";

// The Pro says "I have arrived". This does NOT finish anything: the customer must confirm it first (step 9),
// and only then is the completion code issued.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("pro");
  if ("error" in auth) return auth.error;
  const u = auth.user;
  const r = await getRequest(id);
  const b = r?.booking;
  if (!r || !b || b.provider_id !== u.provider_id || b.provider_confirmed === false) return NextResponse.json({ error: "This is not your booked job." }, { status: 403 });
  if (r.state === "cancelled" || r.state === "paused" || r.state === "flagged") return NextResponse.json({ error: "This booking is on hold." }, { status: 409 });
  if (b.pro_arrived_at) return NextResponse.json({ ok: true, already: true }); // pressing twice changes nothing
  if (!["booked", "reconfirm_due", "reconfirmed"].includes(r.state)) return NextResponse.json({ error: "This job cannot be marked as arrived now." }, { status: 409 });
  const now = new Date().toISOString();
  await updateRequest(id, (x) => {
    x.booking!.pro_arrived_at = now;
    x.events.push({ at: now, text: `${u.name} says they have arrived: waiting for the customer to confirm` });
  });
  await transition(id, "pro_arrived");
  await notify(id, "pro_arrived", { name: u.name.split(" ")[0] });
  return NextResponse.json({ ok: true });
}
