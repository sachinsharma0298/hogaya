// The booking state machine, plus the safety rules every live call must pass.
// Kept free of store imports so it can be used from the store itself.
import { DRY_RUN } from "./mode";
import type { BookingState, HogayaRequest } from "./types";

export const MAIN_STATES: BookingState[] = [
  "requested", "calling_providers", "options_ready", "calling_customer", "customer_chose", "booking_provider",
  "booked", "reconfirm_due", "reconfirmed", "pro_arrived", "arrived", "completed", "closed",
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
  pro_arrived: "Pro says arrived",
  arrived: "Arrival confirmed",
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

/** The call comes `minutesBefore` the slot (60: the reminder/reconfirm, 30: the confirmation call), but never sooner than `minAfter` minutes after booking. */
export function computeReconfirmAt(slot: string | null | undefined, bookedAtIso: string, timeWindow: string, requestedAtIso: string, minutesBefore = 60, minAfter = 5): string {
  const booked = new Date(bookedAtIso).getTime();
  const earliest = booked + minAfter * 60_000;
  const mins = slotStartMinutes(slot);
  if (mins === null) return new Date(earliest).toISOString();
  // India time (UTC+5:30), no daylight saving. The slot day is the request day, or the next day for "Tomorrow ...".
  const IST = 5.5 * 3600_000;
  const day = new Date(new Date(requestedAtIso).getTime() + IST);
  day.setUTCHours(0, 0, 0, 0);
  const dayOffset = /^tomorrow/i.test(timeWindow) ? 1 : 0;
  const slotAt = day.getTime() + dayOffset * 86_400_000 + mins * 60_000 - IST;
  return new Date(Math.max(slotAt - minutesBefore * 60_000, earliest)).toISOString();
}

// ---- which state may follow which ----------------------------------------------------------------

/** The only moves the booking may make (paused, flagged and cancelled are separate: they can happen at any point). */
export const ALLOWED: Record<BookingState, BookingState[]> = {
  requested: ["calling_providers"],
  calling_providers: ["options_ready", "requested"],
  options_ready: ["calling_customer", "customer_chose", "calling_providers", "booking_provider"],
  calling_customer: ["options_ready", "customer_chose", "booking_provider"],
  customer_chose: ["booking_provider", "booked", "options_ready"],
  booking_provider: ["booked", "options_ready", "customer_chose"],
  booked: ["reconfirm_due", "reconfirmed", "booking_provider", "pro_arrived", "completed"],
  reconfirm_due: ["reconfirmed", "booking_provider", "booked", "pro_arrived", "completed"],
  reconfirmed: ["pro_arrived", "booking_provider", "booked", "completed"],
  pro_arrived: ["arrived", "reconfirmed", "booked", "completed"],
  arrived: ["completed"],
  completed: ["closed"],
  closed: [],
  flagged: [], paused: [], cancelled: [],
};
export const canMove = (from: BookingState, to: BookingState) => from === to || ALLOWED[from]?.includes(to);

// ---- safety rules for live calls ---------------------------------------------------------------

/** Live calls: 2 attempts per person per step (the trust rule). Simulated (mock) bookings: up to 4. */
export const MAX_ATTEMPTS = 2;
export const MAX_ATTEMPTS_MOCK = 4;
export const maxAttempts = (r: { demo: boolean }) => (r.demo || DRY_RUN ? MAX_ATTEMPTS_MOCK : MAX_ATTEMPTS); // simulated and rehearsal bookings: 4; real calls: 2

export type CallSpec = { kind: "provider" | "customer" | "booking" | "reconfirm" | "arrival" | "on_the_way"; providerId?: string };

/** How many calls this booking already made to this person for this step (simulated calls count only in a simulated booking). */
export function attemptCount(r: HogayaRequest, spec: CallSpec): number {
  return r.calls.filter((c) => (r.demo || !c.demo) && c.kind === spec.kind && (spec.kind === "customer" || c.provider_id === spec.providerId)).length;
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
  if (attemptCount(r, spec) >= maxAttempts(r)) return `Already ${maxAttempts(r)} attempts for this step.`;
  return null;
}
