import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { clearFlags, pauseBooking, resumeBooking, transition } from "@/lib/booking";
import { retryStep } from "@/lib/engine";
import { kick } from "@/lib/kick";
import { END_STATES } from "@/lib/state";
import { getRequest, updateRequest } from "@/lib/store";

const now = () => new Date().toISOString();

// Operator controls on one booking: pause, resume, retry this step, take over manually, hand back to autopilot,
// cancel, clear flags, and the demo "Fast-forward to T-60".
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { action } = await req.json().catch(() => ({}));
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const fail = (msg: string, status = 409) => NextResponse.json({ error: msg }, { status });
  const log = async (text: string) => await updateRequest(id, (x) => void x.events.push({ at: now(), text }));

  switch (action) {
    case "pause":
      if (r.state === "cancelled" || END_STATES.includes(r.state)) return fail("This booking is already finished.");
      await pauseBooking(id);
      break;
    case "resume":
      if (r.state !== "paused" && r.state !== "flagged") return fail("This booking is not paused or flagged.");
      await resumeBooking(id);
      kick(id);
      break;
    case "clear_flags":
      await clearFlags(id);
      kick(id);
      break;
    case "retry":
      if (r.state === "paused") return fail("Resume the booking first.");
      if (r.state === "cancelled") return fail("This booking is cancelled.");
      await clearFlags(id);
      await log("Operator retried this step");
      await retryStep(id); // a live retry places a real call: it is the operator's click
      kick(id);
      break;
    case "take_over":
      await updateRequest(id, (x) => { x.manual = true; x.events.push({ at: now(), text: "Operator took over manually: autopilot will not touch this booking" }); });
      break;
    case "hand_back":
      await updateRequest(id, (x) => { x.manual = false; x.events.push({ at: now(), text: "Operator handed this booking back to autopilot" }); });
      kick(id);
      break;
    case "cancel":
      if (END_STATES.includes(r.state)) return fail("This booking is already finished.");
      await updateRequest(id, (x) => { x.state = "cancelled"; x.prev_state = undefined; x.events.push({ at: now(), text: "Operator cancelled this booking" }); });
      break;
    case "fast_forward": {
      const b = r.booking;
      if (!b || b.reconfirmed_at || b.provider_confirmed === false) return fail("Only a confirmed booking that has not been reconfirmed can be fast-forwarded.");
      await updateRequest(id, (x) => { x.booking!.reconfirm_at = now(); });
      await transition(id, "reconfirm_due", "Fast-forwarded to T–60 (demo)");
      kick(id); // starts the reconfirm only if the booking runs by itself
      break;
    }
    case "archive":
      await updateRequest(id, (x) => { x.archived = true; x.events.push({ at: now(), text: "Operator archived this booking" }); });
      break;
    case "unarchive":
      await updateRequest(id, (x) => { x.archived = false; });
      break;
    default:
      return fail("Unknown action.", 400);
  }
  return NextResponse.json({ ok: true, state: (await getRequest(id))?.state });
}
