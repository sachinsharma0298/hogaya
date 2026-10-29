// The ONLY place where Fo and Claude are called. Screens never talk to Fo directly.
// A call is cut into short pieces so it fits in a serverless request:
//   begin(job)   -> starts the call (live: sends the brief to Fo). Returns quickly.
//   poll(...)    -> one short look at the call. Never waits for minutes.
//   toJson(...)  -> turns the finished call into the 8.4 JSON (live: Claude. Simulated: scripted).
// Demo bookings use DemoVoice (simulated calls, nobody is phoned). Live bookings (approved numbers only, see lib/live.ts)
// use RealVoice, which really calls through Fo.
import { DRY_RUN, MODE } from "./mode";
import { canonPhone } from "./phone";
import { findUser } from "./store";
import { buildArrivalBrief, buildBookingBrief, buildCustomerBrief, buildProviderBrief, buildReconfirmBrief, type OfferedOption } from "./briefs";
import { beginLiveCall, callMarker, pollLiveCall, recoverLiveCall, replyLiveCall, type Polled, type Recovery } from "./fo-poll";
import { arrivalSummaryToJson, bookingSummaryToJson, customerSummaryToJson, reconfirmSummaryToJson, summaryToJson } from "./summarise";
import type { ArrivalJson, BookingCallJson, CallKind, CallRecord, CustomerCallJson, HogayaRequest, Provider, ProviderCallJson } from "./types";

export type { Polled, Recovery };

export interface JobInfo {
  category: string;
  problem: string;
  sector: string;
  time_window: string;
  notes?: string;
}

export interface Option {
  provider: Provider;
  json: ProviderCallJson;
}

/** Everything a call needs, rebuilt from the booking each time (so a call can be started or checked in any request). */
export interface CallJob {
  kind: CallKind;
  callId?: string; // goes into the brief as an internal reference so a lost call can be found again
  request: HogayaRequest;
  provider?: Provider; // everything except the customer call
  best?: Option; second?: Option; reason?: string; // customer call
  option?: ProviderCallJson; // booking call: the offer the Pro confirmed earlier
  simulate?: boolean; // reconfirm: the operator's "Simulate no reconfirm" switch
  askExactTime?: boolean; // reconfirm: ask for an exact time
}

export interface VoiceProvider {
  /** Which steps make REAL calls with this agent. The rest are simulated and get a Demo badge. */
  readonly real: { provider: boolean; customer: boolean; booking: boolean; reconfirm: boolean; arrival: boolean; on_the_way: boolean };
  begin(job: CallJob): Promise<{ conversationId?: string; progress?: string }>;
  poll(job: CallJob, call: CallRecord, waitSeconds: number): Promise<Polled>;
  reply(call: CallRecord, answer: string): Promise<void>;
  toJson(job: CallJob, summaryText: string): Promise<unknown>;
  /** Only for agents that really call: find a call whose start was not confirmed. Never resends. */
  recover?(call: CallRecord): Promise<Recovery>;
}

export const jobInfo = (r: HogayaRequest): JobInfo => ({ category: r.category, problem: r.problem, sector: r.sector, time_window: r.time_window, notes: r.notes });

const base: ProviderCallJson = {
  answered: true, can_do: true, slot: null, slot_raw: null, slot_exact: false, price_quote: null, price_type: "unknown",
  provider_name: null, visit_charge: null, labour_estimate: null, brings_parts: null,
  reminder_ok: null, callback_requested: false, notes: "", opt_out: false, status: "confirmed",
};

const DEMO: Record<string, { summary: string; json: ProviderCallJson }> = {
  "p-ramesh": {
    summary:
      "Ramesh picked up on the second ring. He said he can come at quarter past six, which is 6:15 PM, and Fo repeated it back and he said yes. Visit charge is ₹150; he will price the labour after seeing the fan. If the capacitor is faulty he will bring one. He agreed to a reminder call before the visit.",
    json: { ...base, slot: "6:15 PM", slot_raw: "quarter past six", slot_exact: true, price_quote: "₹150 visit; work priced after inspection", price_type: "after_inspection", provider_name: "Ramesh", visit_charge: "₹150", brings_parts: true, reminder_ok: true, notes: "Will bring a capacitor if the old one is faulty." },
  },
  "p-suresh": {
    summary:
      "Suresh said yes, he can come sometime between 7 and 8 this evening but would not give an exact time. Visit charge ₹200 and the work would be roughly ₹300 to ₹500. He did not say whether he carries spare parts. He said a reminder call is fine.",
    json: { ...base, slot: "7–8 PM", slot_raw: "between seven and eight", slot_exact: false, price_quote: "₹200 visit + ₹300–500 work", price_type: "range", provider_name: "Suresh", visit_charge: "₹200", labour_estimate: "₹300–500", brings_parts: null, reminder_ok: true, notes: "" },
  },
  "p-mohan": {
    summary:
      "Mohan can come at 6 PM sharp. Visit charge ₹150, repair roughly ₹250 to ₹400 depending on the part. He will bring common washers and pipes. He did not say yes or no to a reminder call.",
    json: { ...base, slot: "6:00 PM", slot_raw: "six o'clock", slot_exact: true, price_quote: "₹150 visit + ₹250–400 work", price_type: "range", provider_name: "Mohan", visit_charge: "₹150", labour_estimate: "₹250–400", brings_parts: true, reminder_ok: null, notes: "The work rate may change depending on the part." },
  },
};

// Fake but varied answers for the demo providers that have no hand-written script.
const SLOTS = [["5:30 PM", "half past five"], ["6:00 PM", "six o'clock"], ["6:45 PM", "quarter to seven"], ["7:00 PM", "seven o'clock"], ["7:30 PM", "half past seven"], ["8:00 PM", "eight o'clock"]];
const VISITS = ["₹100", "₹150", "₹200", "₹250"];
const LABOURS = ["₹300–500", "₹400–700", "₹200–350", "₹500–900"];

function demoFor(p: Provider): { summary: string; json: ProviderCallJson } {
  if (DEMO[p.id]) return DEMO[p.id];
  const h = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const first = p.name.split(" ")[0];
  const windowOnly = h % 4 === 0; // some demo providers only give a window, to show "Exact time not confirmed"
  const [slotNum, slotWords] = SLOTS[h % SLOTS.length];
  const slot = windowOnly ? "5–8 PM" : slotNum;
  const visit = VISITS[h % VISITS.length];
  const labour = h % 3 === 0 ? null : LABOURS[h % LABOURS.length];
  const parts = [true, false, null][h % 3];
  const reminder = h % 2 === 0 ? true : null;
  return {
    summary: `${first} said he can come ${windowOnly ? "some time between 5 and 8 PM but gave no exact time" : `at ${slotWords}, which is ${slot}`}. Visit charge ${visit}. ${labour ? `Work would be roughly ${labour}.` : "He will price the work after seeing it."} ${parts === null ? "He did not say whether he brings parts." : parts ? "He will bring common parts." : "He will not bring parts."} ${reminder ? "A reminder call is fine." : "He did not answer about a reminder call."}`,
    json: {
      ...base, slot, slot_raw: windowOnly ? "between five and eight" : slotWords, slot_exact: !windowOnly, price_quote: labour ? `${visit} visit + ${labour} work` : `${visit} visit; work priced after inspection`,
      price_type: labour ? "range" : "after_inspection", provider_name: first, visit_charge: visit,
      labour_estimate: labour, brings_parts: parts, reminder_ok: reminder, notes: "",
    },
  };
}

export { MODE };

/** Keep digits and one leading +. */
export function normalizePhone(raw: string | undefined): string {
  return (raw ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

/** The number to call for a Pro. Simulated Pros have none and can never be called. */
function phoneFor(p: Provider): string {
  if (p.demo || !p.phone) throw new Error(`${p.name} has no real phone number: a simulated Pro can never be called`);
  return customerPhone(p.phone);
}

/** The number to dial, in full E.164 form: a bare 10-digit number means India (+91). */
export function customerPhone(raw: string): string {
  const e = canonPhone(raw);
  if (/^\+\d{8,15}$/.test(e)) return e; // always the full E.164 number
  throw new Error("The customer's phone number does not look valid");
}


// ---- simulated calls -------------------------------------------------------------------------------------

/** How long a simulated call "takes", so the screens show their calling states. */
const DEMO_DELAY_MS: Record<CallKind, number> = { provider: 2500, customer: 2500, booking: 2000, reconfirm: 2000, arrival: 2000, on_the_way: 1500 };

/** Scripted outcomes for testing the simulated flow: put a tag such as [mock:pro_no_answer] in the problem text. */
const mock = (job: CallJob, name: string) => new RegExp(`\\[mock:${name}\\]`).test(`${job.request?.problem ?? ""} ${job.request?.notes ?? ""}`);

function demoResult(job: CallJob): { summary: string; json: unknown } {
  const p = job.provider;
  switch (job.kind) {
    case "provider": {
      if (mock(job, "pro_no_answer")) return { summary: `Simulated: ${p!.name} did not pick up.`, json: { ...base, answered: false, can_do: null, status: "no_reply", notes: "" } };
      if (mock(job, "pro_declines")) return { summary: `Simulated: ${p!.name} said they cannot come.`, json: { ...base, can_do: false, status: "declined", notes: "" } };
      const d = demoFor(p!);
      return { summary: d.summary, json: d.json };
    }
    case "customer":
      if (mock(job, "customer_no_answer")) return { summary: "Simulated: the customer did not pick up.", json: { confirmed: null, preferred_option: null, notes: "" } satisfies CustomerCallJson };
      if (mock(job, "customer_declines")) return { summary: "Simulated: the customer said no to every option.", json: { confirmed: false, preferred_option: null, notes: "" } satisfies CustomerCallJson };
      return {
        summary: `Fo told the customer that ${job.best!.provider.name} can come and gave the time and charges. The customer said yes, go ahead.`,
        json: { confirmed: true, preferred_option: job.best!.provider.name, notes: "Customer ne haan kaha." } satisfies CustomerCallJson,
      };
    case "booking":
      if (mock(job, "booking_declines")) return { summary: `Simulated: ${p!.name} declined the booking.`, json: { confirmed: false, slot: null, notes: "" } satisfies BookingCallJson };
      return {
        summary: `Fo called ${p!.name}, confirmed the slot and visit charge, then shared the address. ${p!.name} confirmed he will come.`,
        json: { confirmed: true, slot: job.option?.slot ?? null, slot_exact: job.option?.slot_exact, notes: "Address shared after customer confirmed." } satisfies BookingCallJson,
      };
    case "reconfirm":
      if (job.simulate) return { summary: `Simulated: ${p!.name} did not pick up. (No call was placed.)`, json: { reconfirmed: false, can_make_it: null, answered: false } };
      if (job.askExactTime) {
        return {
          summary: `${p!.name} reconfirmed. Fo asked for an exact time and he said saadhe chhe, which is 6:30 PM. Fo repeated it back and he said yes.`,
          json: { reconfirmed: true, can_make_it: true, exact_time: "6:30 PM", notes: "" },
        };
      }
      return { summary: `${p!.name} reconfirmed the booking for the same slot.`, json: { reconfirmed: true, can_make_it: true, exact_time: null, notes: "" } };
    case "arrival": {
      const code = job.request.booking?.arrival_code ?? "0000"; // simulated Pros read out the right code; a real Pro is never told it
      return {
        summary: `Demo: ${p!.name} is at the customer's door and read out the code the customer gave him: ${code.split("").join(" ")}.`,
        json: { arrived: true, provider_gave_code: true, code_digits: code, notes: "Demo data" } satisfies ArrivalJson,
      };
    }
    default:
      return { summary: `${p?.name ?? "The Pro"} said he is on the way, about 15 minutes away.`, json: { on_the_way: true, eta_minutes: 15 } };
  }
}

/** The "on the way?" check is simulated only (no real call exists for it). */
export const demoOnTheWay = (p: Provider) => demoResult({ kind: "on_the_way", request: undefined as never, provider: p });

class DemoVoice implements VoiceProvider {
  readonly real: VoiceProvider["real"] = { provider: false, customer: false, booking: false, reconfirm: false, arrival: false, on_the_way: false };
  async begin(job: CallJob): Promise<{ conversationId?: string; progress?: string }> { void job; return {}; }
  async poll(job: CallJob, call: CallRecord, waitSeconds: number): Promise<Polled> {
    void waitSeconds;
    if (Date.now() - new Date(call.started_at).getTime() < DEMO_DELAY_MS[job.kind]) return { status: "working", progress: "Calling…" };
    return { status: "summary", text: demoResult(job).summary };
  }
  async reply(call: CallRecord, answer: string): Promise<void> { void call; void answer; }
  async toJson(job: CallJob, summaryText: string): Promise<unknown> { void summaryText; return demoResult(job).json; }
}

/** Rehearsal agent: behaves like the real one (real flags, live flow) but never calls Fo. For testing the autopilot safely. */
class DryRunVoice extends DemoVoice {
  readonly real = REAL_STEPS;
  // Test hooks for "the start of the call was not confirmed": [mock:ask_timeout] (Fo has it), [mock:ask_timeout_lost] (nothing placed), [mock:ask_timeout_unknown] (cannot tell)
  async begin(job: CallJob): Promise<{ conversationId?: string; progress?: string }> {
    if (/\[mock:ask_timeout/.test(job.request.problem)) throw new Error("Request timed out");
    return { conversationId: `mock-${job.callId}` }; // a pretend Fo conversation (never a real one)
  }
  async recover(call: CallRecord): Promise<Recovery> {
    return call.meta?.ask_tag === "unknown" ? { status: "ambiguous" } : call.meta?.ask_tag === "lost" ? { status: "lost" } : { status: "found", conversationId: "mock-conversation" };
  }
  async toJson(job: CallJob, summaryText: string): Promise<unknown> {
    // Test hook: lets the rehearsal prove what happens when Claude fails (for example, credits run out).
    if (job.request.problem.includes("[claude-fail]")) throw new Error("simulated: Claude is unavailable");
    return super.toJson(job, summaryText);
  }
}

const offered = (o: Option): OfferedOption => ({
  providerName: o.provider.name,
  slot: o.json.slot,
  slotExact: o.json.slot_exact,
  visitCharge: o.json.visit_charge,
  labourEstimate: o.json.labour_estimate,
  afterInspection: o.json.price_type === "after_inspection",
  bringsParts: o.json.brings_parts,
});

/** Which steps place REAL calls in real mode. The rest stay simulated. */
export const REAL_STEPS: VoiceProvider["real"] = { provider: true, customer: true, booking: true, reconfirm: true, arrival: true, on_the_way: false };

/** The brief for a call. The address goes into the booking brief only. The arrival code is never in any brief. */
async function briefFor(job: CallJob): Promise<string> {
  const r = job.request;
  const j = jobInfo(r);
  const proLang = job.provider?.call_lang; // a Pro is called in their own language, a customer in theirs; none stored = the call asks first
  const customerLang = r.customer.user_id ? (await findUser(r.customer.user_id))?.call_lang : undefined;
  switch (job.kind) {
    case "provider":
      return buildProviderBrief({ providerPhone: phoneFor(job.provider!), providerName: job.provider!.name, category: j.category, problem: j.problem, sector: j.sector, timeWindow: j.time_window, notes: j.notes, lang: proLang });
    case "customer":
      return buildCustomerBrief({
        customerPhone: customerPhone(r.customer.phone), customerName: r.customer.name, category: j.category, problem: j.problem, sector: j.sector,
        timeWindow: j.time_window, best: offered(job.best!), second: job.second ? offered(job.second) : undefined, reason: job.reason, lang: customerLang,
      });
    case "booking":
      return buildBookingBrief({
        providerPhone: phoneFor(job.provider!), providerName: job.provider!.name, category: j.category, problem: j.problem, sector: j.sector, address: r.address,
        slot: job.option?.slot ?? null, slotExact: job.option?.slot_exact ?? false, visitCharge: job.option?.visit_charge ?? null, lang: proLang,
      });
    case "reconfirm":
      return buildReconfirmBrief({
        providerPhone: phoneFor(job.provider!), providerName: job.provider!.name, category: j.category, sector: j.sector, slot: r.booking?.slot ?? null,
        slotExact: r.booking?.slot_exact !== false, visitCharge: r.booking?.visit_charge ?? null, lang: proLang,
      });
    case "arrival":
      return buildArrivalBrief({ providerPhone: phoneFor(job.provider!), providerName: job.provider!.name, category: j.category, sector: j.sector, lang: proLang });
    default:
      throw new Error("This kind of call cannot be placed for real");
  }
}

/** Real Fo calls. Only ever reached for live bookings, only after the approved-list and consent checks in lib/booking.ts. */
class RealVoice extends DemoVoice {
  readonly real = REAL_STEPS;
  async begin(job: CallJob) {
    // The reference tag lets us find this call in Fo's history if the answer to this request never reaches us.
    return beginLiveCall(`${await briefFor(job)}\n\n(Internal reference for Hogaya's records. Do not say it on the call: ${callMarker(job.callId ?? "none")})`);
  }
  async recover(call: CallRecord): Promise<Recovery> {
    return recoverLiveCall(call);
  }
  async poll(job: CallJob, call: CallRecord, waitSeconds: number): Promise<Polled> {
    void job;
    return pollLiveCall(call, waitSeconds);
  }
  async reply(call: CallRecord, answer: string) {
    if (call.fo_conversation_id) await replyLiveCall(call.fo_conversation_id, answer);
  }
  async toJson(job: CallJob, text: string): Promise<unknown> {
    const r = job.request;
    switch (job.kind) {
      case "provider": return summaryToJson(text, { timeWindow: r.time_window, requestedAt: r.created_at });
      case "customer": return customerSummaryToJson(text, [job.best!.provider.name, ...(job.second ? [job.second.provider.name] : [])]);
      case "booking": return bookingSummaryToJson(text, { slot: job.option?.slot ?? null });
      case "reconfirm": return reconfirmSummaryToJson(text);
      case "arrival": return arrivalSummaryToJson(text); // the real code is never given to Fo or to Claude: our own code compares it
      default: return {};
    }
  }
}

const demoAgent = new DemoVoice();
const dryAgent = new DryRunVoice();
const realAgent = new RealVoice();

/** Simulated calls for any booking marked demo (decided once, when the booking is made: see lib/live.ts). */
export function getAgent(booking: { demo: boolean }): VoiceProvider {
  if (booking.demo || MODE !== "real") return demoAgent;
  return DRY_RUN ? dryAgent : realAgent;
}

/** The agent for a call that already exists: a simulated call always stays simulated. */
export const agentForCall = (booking: { demo: boolean }, call: { demo?: boolean }): VoiceProvider => (call.demo ? demoAgent : getAgent(booking));
