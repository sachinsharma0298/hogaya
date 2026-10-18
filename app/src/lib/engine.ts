// The tick engine: how a booking moves forward on a serverless host (Vercel), where nothing may run for minutes.
//
//   tickBooking(id)  takes the booking's lock, then repeats "do the next small thing" for at most ~45 seconds:
//                      1. look at the call that is in flight, ONCE (send ask_fo, read get_fo_reply, read Fo's summary,
//                         have Claude make the JSON, apply it), or
//                      2. start the reconfirm when T-60 has come, or
//                      3. plan and start the next call.
//   tickAll()        does that for every open booking, oldest first. That order is also the queue for the single live-call line.
//
// Who calls it: a timer every minute (POST /api/tick, see docs), the operator console while it is open,
// and the customer's own booking page for simulated (demo) bookings.
import { agentForCall, getAgent, jobInfo, type CallJob, type Option, type VoiceProvider } from "./agent-service";
import { autoRuns, autopilotActive, callBlockedReason, flagBooking, resolveLatestFlag, transition } from "./booking";
import { approvedPros } from "./live";
import {
  applyArrival, applyBooking, applyCustomer, applyProvider, applyReconfirm, confirmedOptions, hasCallInFlight, optionFor,
} from "./live-actions";
import { recommendationReason } from "./recommend";
import { attemptCount, END_STATES, isHold, MAX_ATTEMPTS } from "./state";
import {
  getProviders, getRequest, getSettings, listTickIds, lockRequest, patchCall, simulatedProviders, unlockRequest, updateRequest,
} from "./store";
import type { ReconfirmJson } from "./summarise";
import { DICTS } from "./translations";
import type { ArrivalJson, BookingCallJson, CallKind, CallRecord, CustomerCallJson, HogayaRequest, Provider, ProviderCallJson } from "./types";

export const MAX_TICK_MS = 45_000;
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (id: string, text: string) => updateRequest(id, (r) => void r.events.push({ at: now(), text }));
const first = (p: { name: string }) => p.name.split(" ")[0];
const errText = (e: unknown) => (e instanceof Error ? e.message.slice(0, 200) : "Call failed");
const enT = (key: string, vars?: Record<string, string | number>) => {
  let s = DICTS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};
/** A second attempt waits a minute for live calls, almost nothing for simulated ones. */
const retryDelayMs = (live: boolean) => (live ? 60_000 : 1_500);

type StartKind = Exclude<CallKind, "on_the_way">;
const LABEL: Record<StartKind, string> = { provider: "Call", customer: "Customer call", booking: "Booking call", reconfirm: "Reconfirm", arrival: "Arrival check" };
const isUniqueViolation = (e: unknown) => /one_live_call_at_a_time|duplicate key|unique/i.test(e instanceof Error ? e.message : String(e));

// ---- building a call --------------------------------------------------------------------------------------

async function buildJob(r: HogayaRequest, kind: StartKind, providerId: string | undefined, simulate: boolean): Promise<CallJob | null> {
  const providers = await getProviders();
  const find = (id?: string) => providers.find((p) => p.id === id);
  switch (kind) {
    case "provider": {
      const provider = find(providerId);
      return provider ? { kind, request: r, provider } : null;
    }
    case "customer": {
      const opts = await confirmedOptions(r);
      if (!opts.length) return null;
      const reason = recommendationReason(opts.map((o) => ({ providerId: o.provider.id, json: o.json, reliability: o.provider.reliability })), enT);
      return { kind, request: r, best: opts[0], second: opts[1], reason };
    }
    case "booking": {
      const provider = find(providerId);
      const option = provider ? await optionFor(r, provider.id) : undefined;
      return provider && option ? { kind, request: r, provider, option: option.json } : null;
    }
    case "reconfirm": {
      const provider = find(r.booking?.provider_id);
      return provider && r.booking ? { kind, request: r, provider, simulate, askExactTime: r.booking.slot_exact === false } : null;
    }
    case "arrival": {
      const provider = find(r.booking?.provider_id);
      return provider && r.booking ? { kind, request: r, provider } : null;
    }
  }
}

/** Safety rules before every call. "line" = another live call is running (we wait in the queue); "blocked" = it must not happen. */
async function guard(id: string, spec: { kind: StartKind; providerId?: string }, live: boolean, who: string): Promise<"ok" | "line" | "blocked"> {
  const why = await callBlockedReason(id, spec, live);
  if (!why) return "ok";
  if (/one call at a time/.test(why)) {
    const r = await getRequest(id);
    const last = r?.events[r.events.length - 1]?.text ?? "";
    if (!last.startsWith("Waiting in line")) await log(id, `Waiting in line: another live Fo call is in progress (one call at a time)`);
    return "line";
  }
  await log(id, `Call to ${who} not started: ${why}`);
  if (/attempts|consent|opted out|approved list/i.test(why)) {
    const r = await getRequest(id);
    if (!r?.flags.some((f) => !f.resolved_at && f.reason === `Call to ${who} blocked: ${why}`)) await flagBooking(id, `Call to ${who} blocked: ${why}`, { halt: spec.kind !== "provider" });
  }
  return "blocked";
}

export type StartResult = "started" | "line" | "blocked" | "failed";

/** Start one call. Returns quickly: for a live call it only sends the brief to Fo. The tick engine follows it from there. */
export async function startCall(id: string, kind: StartKind, providerId?: string, opts: { simulate?: boolean } = {}): Promise<StartResult> {
  const r = await getRequest(id);
  if (!r) return "blocked";
  const agent = getAgent(r);
  const simulate = kind === "reconfirm" && (opts.simulate ?? (await getSettings()).simulate_no_reconfirm); // a simulated reconfirm places no call at all
  const live = agent.real[kind] && !simulate;
  const job = await buildJob(r, kind, providerId, simulate);
  if (!job) return "blocked";
  const who = job.provider?.name ?? "the customer";
  const g = await guard(id, { kind, providerId: job.provider?.id }, live, who);
  if (g !== "ok") return g;

  const callId = `c-${Math.random().toString(36).slice(2, 8)}`;
  const target = kind === "customer" ? job.best!.provider : job.provider!;
  try {
    await updateRequest(id, (x) => {
      x.calls.push({
        id: callId, kind, provider_id: target.id, provider_name: target.name, status: "calling", started_at: now(), demo: !live,
        meta: kind === "reconfirm" ? { simulate, ask_exact: job.askExactTime } : undefined,
      });
      if (kind === "provider") {
        x.step = "calling_provider";
        x.current_provider_name = first(target);
        if (x.call_approved === target.id) x.events.push({ at: now(), text: `Operator clicked "Call now" for ${target.name}` });
        x.awaiting_call = undefined;
        x.call_approved = undefined;
      } else if (kind === "customer") x.step = "calling_customer";
      else if (kind === "booking" && !x.booking) { x.step = "booking_provider"; x.current_provider_name = first(target); }
      else if (kind === "reconfirm" && x.booking) x.booking.reconfirm_pending = true;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return guard(id, { kind, providerId: job.provider?.id }, true, who).then(() => "line" as const); // lost a race for the single live line
    throw e;
  }
  if (kind === "customer") await transition(id, "calling_customer");
  else if (kind === "booking" && !r.booking) await transition(id, "booking_provider");

  try {
    const out = await agentForCall(r, { demo: !live }).begin(job);
    await patchCall(id, callId, { fo_conversation_id: out.conversationId, progress: out.progress });
    return "started";
  } catch (e) {
    await failCall(id, callId, kind, e);
    return "failed";
  }
}

// ---- when a call ends badly ---------------------------------------------------------------------------------

/** After a customer call fails or times out: the customer may confirm on screen instead. */
async function customerFallback(id: string) {
  await updateRequest(id, (x) => { x.step = "shortlist_ready"; x.screen_confirm_open = true; });
  await transition(id, "options_ready");
}
const endPending = (id: string) => updateRequest(id, (x) => void (x.booking && (x.booking.reconfirm_pending = false)));

async function failCall(id: string, callId: string, kind: StartKind, e: unknown) {
  const c = (await getRequest(id))?.calls.find((x) => x.id === callId);
  await patchCall(id, callId, { status: "failed", progress: errText(e) });
  const who = c?.provider_name ?? "";
  await log(id, `${LABEL[kind]}${kind === "provider" ? ` to ${who}` : ""} failed (${errText(e)})`);
  if (kind === "reconfirm") await endPending(id);
  if (kind === "customer") await customerFallback(id);
  if (kind !== "provider") await flagBooking(id, `${LABEL[kind]} failed: ${errText(e)}`);
  else await afterProviderAttempt(id, c);
}

async function timedOut(id: string, c: CallRecord, kind: StartKind) {
  await patchCall(id, c.id, { status: "timed_out" });
  await log(id, `${c.provider_name}: no call summary after 10 minutes (${LABEL[kind].toLowerCase()}). Use "Check again".`);
  if (kind === "reconfirm") await endPending(id);
  if (kind === "customer") await customerFallback(id);
  await flagBooking(id, `${c.provider_name}: Fo's ${kind === "provider" ? "call" : LABEL[kind].toLowerCase()} summary timed out`, { halt: kind !== "provider" });
}

/** After a provider call that gave no clear answer: after two tries the operator is told. */
async function afterProviderAttempt(id: string, c?: CallRecord) {
  const r = await getRequest(id);
  if (!r || !c) return;
  const calls = r.calls.filter((x) => x.kind === "provider" && x.provider_id === c.provider_id);
  const definitive = calls.some((x) => x.status === "done" && ["confirmed", "declined"].includes((x.json as ProviderCallJson | undefined)?.status ?? ""));
  if (!definitive && calls.length >= MAX_ATTEMPTS) await flagBooking(id, `${c.provider_name}: no answer after ${MAX_ATTEMPTS} tries`, { halt: false });
}

// ---- a finished call ----------------------------------------------------------------------------------------

/** Claude (or the simulated agent) turns Fo's summary into JSON and the booking moves on. If Claude fails, the booking is flagged and Fo's summary stays visible. */
export async function processSummary(id: string, callId: string, text: string): Promise<boolean> {
  await patchCall(id, callId, { summary_text: text, progress: undefined });
  const r = await getRequest(id);
  const c = r?.calls.find((x) => x.id === callId);
  if (!r || !c) return false;
  const kind = c.kind as StartKind;
  const job = await buildJob(r, kind, kind === "customer" ? undefined : c.provider_id, Boolean(c.meta?.simulate));
  if (!job) { await patchCall(id, callId, { status: "needs_review" }); return true; }
  let json: unknown;
  try {
    json = await agentForCall(r, c).toJson(job, text);
  } catch (e) {
    await patchCall(id, callId, { status: "needs_review", progress: `Could not read Fo's summary (${errText(e)})` });
    await log(id, `${c.provider_name}: Claude could not read Fo's summary (${errText(e)}). The summary is shown in the timeline.`);
    if (kind === "reconfirm") await endPending(id);
    await flagBooking(id, `Claude could not read Fo's summary for the ${LABEL[kind].toLowerCase()}: read it in the timeline and decide`);
    return true;
  }
  switch (kind) {
    case "provider": await applyProvider(id, callId, json as ProviderCallJson); await afterProviderAttempt(id, (await getRequest(id))?.calls.find((x) => x.id === callId)); break;
    case "customer": await applyCustomer(id, callId, json as CustomerCallJson); break;
    case "booking": await applyBooking(id, callId, json as BookingCallJson); break;
    case "reconfirm": await applyReconfirm(id, callId, json as ReconfirmJson, Boolean(c.meta?.simulate)); await endPending(id); break;
    case "arrival": await applyArrival(id, callId, json as ArrivalJson); break;
  }
  return true;
}

/** Operator "Check again" on a call that timed out or whose summary Claude could not read. No new call is ever placed. */
export async function recheckCall(id: string, callId: string) {
  const c = (await getRequest(id))?.calls.find((x) => x.id === callId);
  if (!c) return;
  if (c.status === "needs_review" && c.summary_text) {
    await processSummary(id, callId, c.summary_text);
    await resolveLatestFlag(id);
    return;
  }
  if (c.status === "timed_out" && c.fo_conversation_id) {
    // The first assistant message is Fo's "dialing" note; anything after it is the final message.
    await patchCall(id, callId, { status: "waiting_summary", meta: { ...c.meta, baseline: 1, waiting_since: now() } });
  }
}

// ---- looking at the call that is in flight ------------------------------------------------------------------

/** One short look at the in-flight call. True when something changed, so the booking should be looked at again straight away. */
async function pollCall(r: HogayaRequest, c: CallRecord, deadline: number): Promise<boolean> {
  const id = r.id;
  const kind = c.kind as StartKind;
  const agent = agentForCall(r, c);
  if (c.status === "needs_reply") {
    if (!c.operator_reply) return false;
    await agent.reply(c, c.operator_reply);
    await patchCall(id, c.id, { status: "calling", question: undefined, operator_reply: undefined });
    await resolveLatestFlag(id);
    return true;
  }
  const job = await buildJob(r, kind, kind === "customer" ? undefined : c.provider_id, Boolean(c.meta?.simulate));
  if (!job) { await patchCall(id, c.id, { status: "failed", progress: "The booking changed" }); return true; }
  const waitSeconds = Math.max(1, Math.min(20, Math.floor((deadline - Date.now()) / 1000) - 5));
  let p;
  try {
    p = await agent.poll(job, c, waitSeconds);
  } catch (e) {
    await failCall(id, c.id, kind, e);
    return true;
  }
  switch (p.status) {
    case "working":
      if (p.progress !== c.progress) await patchCall(id, c.id, { progress: p.progress });
      if (!c.fo_conversation_id) { await sleep(Math.min(700, Math.max(0, deadline - Date.now()))); return true; } // a simulated call: wait a moment and look again
      return false;
    case "waiting":
      await patchCall(id, c.id, { status: "waiting_summary", progress: undefined, meta: { ...c.meta, baseline: p.baseline, waiting_since: now() } });
      return true;
    case "question":
      await patchCall(id, c.id, { status: "needs_reply", question: p.text, operator_reply: undefined });
      await flagBooking(id, "Fo asked a question and is waiting for the operator");
      return true;
    case "failed":
      await failCall(id, c.id, kind, new Error(p.error));
      return true;
    case "timeout":
      await timedOut(id, c, kind);
      return true;
    case "summary":
      return processSummary(id, c.id, p.text);
  }
}

// ---- planning the next call ---------------------------------------------------------------------------------

type Action = () => Promise<boolean>;

async function matchProviders(id: string): Promise<boolean> {
  const r = (await getRequest(id))!;
  const cap = (await autopilotActive(r)) ? 3 : 5; // autopilot calls the top 3; otherwise up to 5 (the trust-rule maximum)
  // A demo booking only ever sees simulated Pros. A live booking only ever sees Pros onboarded by Hogaya whose number is approved.
  const pool: Provider[] = r.demo ? simulatedProviders().filter((p) => p.category === r.category) : await approvedPros(r.category);
  const matched = pool.sort((a, b) => b.reliability - a.reliability).slice(0, cap);
  await updateRequest(id, (x) => { x.step = "matching"; x.matched = matched.map((m) => m.id); x.events.push({ at: now(), text: `Matched ${matched.length} consented ${x.category}(s), ranked by reliability` }); });
  await transition(id, "calling_providers");
  return true;
}

async function shortlist(id: string, auto: boolean): Promise<boolean> {
  await updateRequest(id, (x) => void (x.step = "shortlist_ready"));
  const options = await confirmedOptions((await getRequest(id))!);
  await transition(id, "options_ready", "Shortlist ready");
  if (options.length === 0) await flagBooking(id, "No provider confirmed. Operator action needed.");
  else if (!auto) await log(id, "Shortlist ready. Waiting for the operator: \"Call customer now\", or the customer can confirm on screen");
  return true;
}

/** Calls to providers: one at a time, best reliability first, at most two tries each. */
async function planProviders(r: HogayaRequest, auto: boolean): Promise<Action | null> {
  const id = r.id;
  if (r.state === "requested") return () => matchProviders(id);
  const live = !r.demo;
  const needsClick = live && !(await autopilotActive(r)); // a live call without Autopilot waits for the operator's "Call now"
  let waiting = false;
  if (!r.skip_rest) {
    for (const pid of r.matched.filter((m) => !(r.skipped ?? []).includes(m))) {
      const calls = r.calls.filter((c) => c.kind === "provider" && c.provider_id === pid);
      if (calls.some((c) => c.status === "done" && ["confirmed", "declined"].includes((c.json as ProviderCallJson | undefined)?.status ?? ""))) continue;
      if (calls.length >= MAX_ATTEMPTS) continue;
      if (calls.length > 0 && !auto) continue; // manual mode: the operator decides whether to call again
      const last = calls[calls.length - 1];
      if (last?.ended_at && Date.now() < new Date(last.ended_at).getTime() + retryDelayMs(live)) { waiting = true; break; }
      if (needsClick && r.call_approved !== pid) {
        if (r.awaiting_call === pid) return null;
        const name = (await getProviders()).find((p) => p.id === pid)?.name ?? "the provider";
        return async () => { await updateRequest(id, (x) => { x.awaiting_call = pid; x.call_approved = undefined; x.events.push({ at: now(), text: `Waiting for the operator to click "Call now" for ${name}` }); }); return true; };
      }
      return async () => {
        const res = await startCall(id, "provider", pid);
        if (res === "blocked") await updateRequest(id, (x) => void (x.skipped = [...(x.skipped ?? []), pid]));
        return res === "started" || res === "blocked" || res === "failed";
      };
    }
  }
  if (waiting) return null;
  if (r.awaiting_call) await updateRequest(id, (x) => void (x.awaiting_call = undefined));
  return () => shortlist(id, auto);
}

/** What should happen next for this booking. Never anything for paused, flagged, cancelled or manual bookings. */
async function plan(r: HogayaRequest): Promise<Action | null> {
  if (r.manual || isHold(r.state) || END_STATES.includes(r.state)) return null;
  const id = r.id;
  const auto = await autoRuns(r);
  if (r.state === "requested" || r.state === "calling_providers") return planProviders(r, auto);
  if (!auto) return null; // live without Autopilot: the operator's buttons start the next call
  const b = r.booking;
  const act = (kind: StartKind, providerId?: string): Action => async () => (await startCall(id, kind, providerId)) !== "line" ;
  const book = (providerId: string): Action | null => (attemptCount(r, { kind: "booking", providerId }) < MAX_ATTEMPTS ? act("booking", providerId) : null);
  if (b && b.provider_confirmed === false) return book(b.provider_id); // a backup Pro needs its own booking call
  switch (r.state) {
    case "options_ready": {
      if (r.customer_choice) return book(r.customer_choice.provider_id);
      if (r.customer_declined) return null;
      return attemptCount(r, { kind: "customer" }) < MAX_ATTEMPTS ? act("customer") : null;
    }
    case "customer_chose":
    case "booking_provider":
      return !b && r.customer_choice ? book(r.customer_choice.provider_id) : null;
    case "reconfirm_due": {
      if (!b || b.reconfirmed_at) return null;
      return attemptCount(r, { kind: "reconfirm", providerId: b.provider_id }) < MAX_ATTEMPTS ? act("reconfirm") : null;
    }
    default:
      return null;
  }
}

// ---- the tick ---------------------------------------------------------------------------------------------

/** One small piece of work for one booking. True if something changed. */
async function stepOnce(id: string, deadline: number): Promise<boolean> {
  const r = await getRequest(id);
  if (!r) return false;
  const inflight = r.calls.find((c) => ["calling", "waiting_summary", "needs_reply"].includes(c.status));
  if (inflight) {
    if (r.state === "cancelled") { await patchCall(id, inflight.id, { status: "failed", progress: "Booking cancelled" }); return true; }
    return pollCall(r, inflight, deadline);
  }
  const b = r.booking;
  if (r.state === "booked" && b && !b.reconfirmed_at && b.provider_confirmed !== false && b.reconfirm_at && new Date(b.reconfirm_at).getTime() <= Date.now()) {
    await transition(id, "reconfirm_due", "Reconfirm is due (T–60)");
    return true;
  }
  const action = await plan(r);
  return action ? action() : false;
}

/** Move one booking forward, in short runs. Safe to call from anywhere, any number of times: the booking's lock keeps it to one tick at a time. */
export async function tickBooking(id: string, budgetMs = MAX_TICK_MS): Promise<{ ran: boolean; steps: number }> {
  const token = await lockRequest(id, 300); // starting a live call (ask_fo) can take over a minute; the lock frees itself if a tick dies
  if (!token) return { ran: false, steps: 0 };
  const deadline = Date.now() + budgetMs;
  let steps = 0;
  try {
    while (Date.now() < deadline && steps < 40) {
      if (!(await stepOnce(id, deadline))) break;
      steps++;
    }
  } catch (e) {
    await log(id, `Tick error: ${errText(e)}`).catch(() => {});
  } finally {
    await unlockRequest(id, token).catch(() => {});
  }
  return { ran: true, steps };
}

/** Every open booking, oldest first (the order is the queue for the single live-call line). */
export async function tickAll(budgetMs = 50_000): Promise<{ bookings: number; steps: number }> {
  const deadline = Date.now() + budgetMs;
  let steps = 0;
  const ids = await listTickIds();
  for (const id of ids) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    steps += (await tickBooking(id, Math.min(left, MAX_TICK_MS))).steps;
  }
  return { bookings: ids.length, steps };
}

// ---- operator "Retry this step" ------------------------------------------------------------------------------

/** Run the step the booking is on, again. The safety rules (2 attempts, consent, approved list, one call at a time) still apply. */
export async function retryStep(id: string): Promise<StartResult | null> {
  const r = await getRequest(id);
  if (!r || hasCallInFlight(r)) return null;
  const b = r.booking;
  if (b && b.provider_confirmed === false) return startCall(id, "booking", b.provider_id);
  switch (r.state) {
    case "requested":
    case "calling_providers":
      await updateRequest(id, (x) => { x.skip_rest = false; x.skipped = []; });
      return null; // the next tick takes it from here
    case "options_ready":
    case "calling_customer":
      return r.customer_choice ? startCall(id, "booking", r.customer_choice.provider_id) : startCall(id, "customer");
    case "customer_chose":
    case "booking_provider":
      return startCall(id, "booking", r.customer_choice?.provider_id);
    case "booked":
    case "reconfirm_due":
      return startCall(id, "reconfirm");
    case "reconfirmed":
      return startCall(id, "arrival");
    default:
      return null;
  }
}

export type { VoiceProvider, Option };
