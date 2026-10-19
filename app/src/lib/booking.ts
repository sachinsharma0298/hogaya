// Store-aware helpers for the booking state machine: transitions, holds (paused / flagged), flags and the safety rules.
import { attemptCount, blockedReason, canMove, END_STATES, isHold, type CallSpec } from "./state";
import { deriveState } from "./state";
import { MODE } from "./mode";
import { canonPhone, FO_COUNTRY_WARNING, foMayCall, phoneCountry } from "./phone";
import { findUser, getProviders, getRequest, getSettings, isApproved, listRequests, updateRequest } from "./store";
import type { BookingState, HogayaRequest, NotifyKind } from "./types";

const now = () => new Date().toISOString();
const IN_FLIGHT = ["calling", "waiting_summary", "needs_reply", "unconfirmed"];

/** Move to a state. A paused or flagged booking only remembers where to resume; a cancelled one never moves. */
export async function transition(id: string, to: BookingState, note?: string) {
  await updateRequest(id, (r) => {
    if (r.state === "cancelled") return;
    const from = isHold(r.state) ? r.prev_state ?? "requested" : r.state;
    if (!canMove(from, to)) { r.events.push({ at: now(), text: `Blocked an invalid move: ${from} → ${to}` }); return; } // only valid transitions are ever saved
    if (isHold(r.state)) r.prev_state = to;
    else r.state = to;
    if (note) r.events.push({ at: now(), text: note });
  });
}

async function hold(id: string, kind: "paused" | "flagged") {
  await updateRequest(id, (r) => {
    if (r.state === "cancelled" || END_STATES.includes(r.state)) return;
    if (!isHold(r.state)) r.prev_state = r.state;
    r.state = kind;
  });
}

/** Leave paused or flagged and go back to where the booking was. */
export async function release(id: string) {
  await updateRequest(id, (r) => {
    if (!isHold(r.state)) return;
    r.state = r.prev_state && !isHold(r.prev_state) ? r.prev_state : deriveState({ ...r, state: "requested" });
    r.prev_state = undefined;
  });
}

/** Raise a flag for the operator. With halt (the default) autopilot stops on this booking until the operator acts. */
export async function flagBooking(id: string, reason: string, opts: { halt?: boolean } = {}) {
  await updateRequest(id, (r) => {
    r.flags.push({ at: now(), reason });
    r.events.push({ at: now(), text: `FLAG: ${reason}` });
  });
  if (opts.halt !== false) await hold(id, "flagged");
}

export async function pauseBooking(id: string) {
  await hold(id, "paused");
  await updateRequest(id, (r) => void r.events.push({ at: now(), text: "Operator paused this booking" }));
}

export async function resumeBooking(id: string) {
  await release(id);
  await updateRequest(id, (r) => void r.events.push({ at: now(), text: "Operator resumed this booking" }));
}

/** Resolve every open flag and leave the flagged state. */
export async function clearFlags(id: string) {
  await updateRequest(id, (r) => {
    for (const f of r.flags) if (!f.resolved_at) f.resolved_at = now();
  });
  if ((await getRequest(id))?.state === "flagged") await release(id);
}

/** Resolve only the most recent open flag (for example after the operator answered Fo's question). */
export async function resolveLatestFlag(id: string) {
  await updateRequest(id, (r) => {
    const open = [...r.flags].reverse().find((f) => !f.resolved_at);
    if (open) open.resolved_at = now();
  });
  const r = await getRequest(id);
  if (r && r.state === "flagged" && r.flags.every((f) => f.resolved_at)) await release(id);
}

export const openFlags = (r: HogayaRequest) => r.flags.filter((f) => !f.resolved_at);

// ---- autopilot -----------------------------------------------------------------------------------

/** Autopilot only drives live bookings, only in real mode, only while the operator switch is ON and the booking is not taken over. */
export const autopilotActive = async (r: HogayaRequest) => MODE === "real" && !r.demo && !r.manual && (await getSettings()).autopilot;

/** Does this booking move forward by itself? Demo bookings always do; live ones only with autopilot. */
export async function autoRuns(r: HogayaRequest): Promise<boolean> {
  if (r.manual || isHold(r.state) || END_STATES.includes(r.state)) return false;
  return r.demo || (await autopilotActive(r));
}

// ---- one Fo call at a time per account ---------------------------------------------------------

/** Is a live (non-demo) Fo call running anywhere? Demo calls never count. */
export async function liveCallInFlight(): Promise<HogayaRequest | undefined> {
  return (await listRequests()).find((r) => r.calls.some((c) => !c.demo && IN_FLIGHT.includes(c.status)));
}

/** Why a call must not start right now, or null. `live` is true for real Fo calls. */
export async function callBlockedReason(id: string, spec: CallSpec, live: boolean): Promise<string | null> {
  const r = await getRequest(id);
  if (!r) return "Booking not found.";
  const provider = spec.providerId ? (await getProviders()).find((p) => p.id === spec.providerId) : undefined;
  const base = blockedReason(r, spec, provider);
  if (base) return base;
  if (live) {
    // Fo is only known to call some countries (see NEXT_PUBLIC_FO_CALL_COUNTRIES): never send a call it may not place.
    const target = spec.kind === "customer" ? r.customer.phone : provider?.phone ?? "";
    if (target && !foMayCall(canonPhone(target))) return `${FO_COUNTRY_WARNING}: ${phoneCountry(canonPhone(target)) ?? "unknown country"}. This call was not sent.`;
    // Live calls only ever reach numbers on the approved list, checked again right before every call.
    if (spec.kind === "customer") {
      const email = r.customer.user_id ? (await findUser(r.customer.user_id))?.email : undefined;
      if (!(await isApproved("customer", r.customer.phone, email))) return "The customer's number is not on the approved list for live calls.";
    } else if (!provider || !(await isApproved("pro", provider.phone))) {
      return `${provider?.name ?? "The provider"}'s number is not on the approved list for live calls.`;
    }
  }
  if (live && (await liveCallInFlight())) return "Another Fo call is already in progress (one call at a time).";
  return null;
}

export { attemptCount };

/** An in-app notification for the customer (bell + toast on the booking page). */
export async function notify(id: string, kind: NotifyKind, vars?: Record<string, string>) {
  await updateRequest(id, (r) => {
    r.notifications = r.notifications ?? [];
    r.notifications.push({ id: `n-${Math.random().toString(36).slice(2, 8)}`, at: now(), kind, vars });
  });
}

/** Resolve open flags whose reason matches (for example the wrong-code flag once the right code is entered). */
export async function resolveFlagsMatching(id: string, re: RegExp) {
  await updateRequest(id, (r) => {
    for (const f of r.flags) if (!f.resolved_at && re.test(f.reason)) f.resolved_at = now();
  });
  const r = await getRequest(id);
  if (r && r.state === "flagged" && r.flags.every((f) => f.resolved_at)) await release(id);
}
