import { NextResponse } from "next/server";
import { flagBooking, notify, resolveFlagsMatching } from "@/lib/booking";
import { requireRole } from "@/lib/guard";
import { recordOutcome } from "@/lib/outcome";
import { getRequest, updateRequest } from "@/lib/store";

const MAX_WRONG = 5;

// The Pro submits the completion code the customer gave them. A correct code completes the booking.
// Wrong codes are counted and locked after 5; an expired code needs the operator; submitting twice completes nothing twice.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("pro");
  if ("error" in auth) return auth.error;
  const u = auth.user;
  const r = await getRequest(id);
  const b = r?.booking;
  if (!r || !b || b.provider_id !== u.provider_id || b.provider_confirmed === false) return NextResponse.json({ error: "This is not your booked job." }, { status: 403 });
  if (b.outcome === "completed") return NextResponse.json({ ok: true, completed: true, already: true });
  if (r.state === "cancelled" || r.state === "paused") return NextResponse.json({ error: "This booking is on hold." }, { status: 409 });
  if (!b.arrival_verified_at || !b.arrival_code) return NextResponse.json({ error: "The customer has not confirmed your arrival yet, so there is no code to enter." }, { status: 409 });
  if ((b.code_attempts ?? 0) >= MAX_WRONG) return NextResponse.json({ error: "Too many wrong codes. Please ask the Hogaya operator.", locked: true }, { status: 423 });
  if (b.code_expires_at && new Date(b.code_expires_at).getTime() < Date.now()) {
    if (!r.flags.some((f) => !f.resolved_at && /code expired/.test(f.reason))) await flagBooking(id, `The completion code expired before ${u.name} entered it: please check`, { halt: false });
    return NextResponse.json({ error: "This code has expired. Please ask the Hogaya operator.", expired: true }, { status: 410 });
  }
  const { code } = await req.json().catch(() => ({}));
  const typed = String(code ?? "").replace(/\D/g, "");
  if (typed.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });

  const now = new Date().toISOString();
  if (typed !== b.arrival_code) {
    const attempts = (b.code_attempts ?? 0) + 1;
    await updateRequest(id, (x) => {
      x.booking!.code_attempts = attempts;
      x.events.push({ at: now, text: `Wrong completion code entered by ${u.name} (${attempts} of ${MAX_WRONG})` });
    });
    if (!r.flags.some((f) => !f.resolved_at && /wrong completion code/i.test(f.reason))) await flagBooking(id, `Wrong completion code entered by ${u.name}: please check`, { halt: false });
    return NextResponse.json({ ok: false, completed: false, attemptsLeft: Math.max(0, MAX_WRONG - attempts) }, { status: 200 });
  }
  await updateRequest(id, (x) => {
    if (x.booking!.job_done_at) return; // a second submit at the same moment completes nothing twice
    x.booking!.job_done_at = now;
    x.events.push({ at: now, text: `${u.name} submitted the right completion code: booking completed` });
  });
  const res = await recordOutcome(id, "completed"); // updates the Pro's reliability exactly once and moves the booking to "completed"
  if (res.ok) await notify(id, "completed", { name: u.name.split(" ")[0] });
  await resolveFlagsMatching(id, /completion code|code expired/i);
  return NextResponse.json({ ok: true, completed: true });
}
