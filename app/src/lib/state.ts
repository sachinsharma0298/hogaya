// The booking state machine, plus the safety rules every live call must pass.
// Kept free of store imports so it can be used from the store itself.
import type { BookingState, HogayaRequest } from "./types";

export const MAIN_STATES: BookingState[] = [
  "requested", "calling_providers", "options_ready", "calling_customer", "customer_chose", "booking_provider",
  "booked", "reconfirm_due", "reconfirmed", "arrived", "completed", "closed",
];
export const HOLD_STATES: BookingState[] = ["paused", "flagged"];
export const END_STATES: BookingState[] = ["completed", "closed", "cancelled"];
export const isHold = (s: BookingState) => HOLD_STATES.includes(s);

export const STATE_LABEL: Record<BookingState, string> = {
  requested: "Requested",
  calling_providers: "Calling providers",
  options_ready: "Options ready",
  calling_customer: "Calling customer",
  customer_chose: "Customer chose",
  booking_provider: "Booking provider",
  booked: "Booked",
  reconfirm_due: "Reconfirm due",
  reconfirmed: "Reconfirmed",
  arrived: "Arrived",
  completed: "Completed",
  closed: "Closed",
  flagged: "Flagged",
  paused: "Paused",
  cancelled: "Cancelled",
};

/** Best guess of the state for bookings created before the state machine existed. */
export function deriveState(r: HogayaRequest): BookingState {
  const b = r.booking;
  if (b) {
    if (b.outcome === "completed" || b.completed_at) return "completed";
    if (b.arrival_verified_at) return "arrived";
    if (b.provider_confirmed === false) return "booking_provider";
    if (b.reconfirmed_at) return "reconfirmed";
    return "booked";
  }
  if (r.customer_choice) return "customer_chose";
  if (r.step === "calling_customer") return "calling_customer";
  if (r.step === "shortlist_ready") return "options_ready";
  if (r.step === "matching" && r.calls.length === 0) return "requested";
  return "calling_providers";
}

// ---- when is the reconfirm due? -----------------------------------------------------------------

/** First clock time in a slot like "6:15 PM", "3:45 PM–4:00 PM" or "5–8 PM". Returns minutes after midnight, or null. */
export function slotStartMinutes(slot: string | null | undefined): number | null {
  if (!slot) return null;
  const m = slot.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  let ap: string | undefined = m[3]?.toUpperCase();
  if (!ap) ap = slot.match(/\b(AM|PM)\b/i)?.[1]?.toUpperCase(); // "5–8 PM": the suffix applies to both ends
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Reconfirm 60 minutes before the slot, but never sooner than 5 minutes after booking (so it never rings straight after the booking call). */
export function computeReconfirmAt(slot: string | null | undefined, bookedAtIso: string, timeWindow: string, requestedAtIso: string): string {
  const booked = new Date(bookedAtIso).getTime();
  const earliest = booked + 5 * 60_000;
  const mins = slotStartMinutes(slot);
  if (mins === null) return new Date(earliest).toISOString();
  // India time (UTC+5:30), no daylight saving. The slot day is the request day, or the next day for "Tomorrow ...".
  const IST = 5.5 * 3600_000;
  const day = new Date(new Date(requestedAtIso).getTime() + IST);
  day.setUTCHours(0, 0, 0, 0);
  const dayOffset = /^tomorrow/i.test(timeWindow) ? 1 : 0;
  const slotAt = day.getTime() + dayOffset * 86_400_000 + mins * 60_000 - IST;
  return new Date(Math.max(slotAt - 60 * 60_000, earliest)).toISOString();
}

// ---- safety rules for live calls ---------------------------------------------------------------

export const MAX_ATTEMPTS = 2;

export type CallSpec = { kind: "provider" | "customer" | "booking" | "reconfirm" | "arrival"; providerId?: string };

/** How many live calls this booking already made to this person for this step. Demo calls do not count. */
export function attemptCount(r: HogayaRequest, spec: CallSpec): number {
  return r.calls.filter((c) => !c.demo && c.kind === spec.kind && (spec.kind === "customer" || c.provider_id === spec.providerId)).length;
}

/**
 * Returns why a live call must NOT start, or null if it may.
 * Rules: not paused or cancelled; consent recorded; at most 2 attempts per person per step.
 * (The one-call-at-a-time rule needs the whole database, so it lives in live-lock.ts.)
 */
export function blockedReason(
  r: HogayaRequest,
  spec: CallSpec,
  provider?: { consent_ai_call: boolean; opt_out: boolean; consent_date: string; name: string },
): string | null {
  if (r.state === "paused") return "This booking is paused.";
  if (r.state === "cancelled") return "This booking is cancelled.";
  if (spec.kind === "customer" && (!r.customer.consent_ai_call || !r.customer.consent_at)) return "The customer has not recorded consent to an AI call.";
  if (spec.kind !== "customer") {
    if (!provider) return "Provider not found.";
    if (!provider.consent_ai_call || !provider.consent_date) return `${provider.name} has no recorded consent to AI calls.`;
    if (provider.opt_out) return `${provider.name} opted out of calls.`;
  }
  if (attemptCount(r, spec) >= MAX_ATTEMPTS) return `Already ${MAX_ATTEMPTS} attempts for this step.`;
  return null;
}
