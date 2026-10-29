// Rule 1 in 8.6: never rely on Fo's JSON format. Claude turns Fo's call summary into the 8.4 JSON,
// using only the allowed values and null for anything unclear or not said.
import Anthropic from "@anthropic-ai/sdk";
import type { ArrivalJson, BookingCallJson, CustomerCallJson, ProviderCallJson } from "./types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `You turn an AI phone assistant's call summary into structured data for Hogaya, a home-services booking service in India.
The assistant (Fo) called a local service provider. Record ONLY what the provider actually said on the call.
Rules:
- Use null for anything the provider did not say or that is unclear. Never guess or fill in defaults.
- Ignore anything about the customer's side, calendars, emails, or the assistant's own notes.
- can_do: true only if the provider clearly said they can do the job, false only if they clearly said no, otherwise null.
- slot: the time the provider said they can come, written in numbers like "6:15 PM" (assume evening for 1 to 11 unless the context says morning), else null. A window stays a window, e.g. "5–8 PM".
- The call summary may be in English, Hinglish (Roman script) or Hindi (Devanagari). Read all of them the same way, and always write the fields in English or numbers (notes in plain English). हाँ / जी / ठीक है = yes; नहीं / नहीं हो पाएगा = no.
- Hindi time words are exact times, in Roman or Devanagari: "sawa X" / "सवा X" = X:15 (सवा छह = 6:15 PM), "saadhe X" / "साढ़े X" = X:30 (साढ़े छह = 6:30 PM), "paune X" / "पौने X" = (X-1):45 (पौने छह = 5:45 PM), "dedh" / "डेढ़" = 1:30, "dhai" / "ढाई" = 2:30, "X baje" / "X बजे" = X:00. Day parts: सुबह = morning, दोपहर = afternoon, शाम = evening, रात = night. Hindi hour words: एक 1, दो 2, तीन 3, चार 4, पाँच 5, छह 6, सात 7, आठ 8, नौ 9, दस 10, ग्यारह 11, बारह 12. Prices: "दो सौ रुपये" = ₹200.
- AM or PM: if the spoken time could be morning or evening (for example "dedh baje" or "sawa do"), use the customer's requested time window and the time of the request to decide. If it is still unclear after that, keep your best reading in "slot" but set slot_exact to false.
- slot_raw: the provider's exact words about the time, as quoted in the summary (for example "sawa chhe"), else null.
- slot_exact: true only if the provider gave one specific time (including Hindi time words). false if they gave only a window, a range, a vague time ("evening", "shaam ko") or no time.
- price_type: "fixed" if one price, "range" if a range, "after_inspection" if they will price after seeing the work, else "unknown".
- price_quote: one short line combining what they quoted (visit charge and work), else null.
- visit_charge: the fixed visit fee they stated, else null. labour_estimate: their work estimate, else null.
- brings_parts / reminder_ok: true or false only if they clearly said so, else null.
- provider_name: the name they gave, else null.
- callback_requested: true only if the provider asked to be called back later.
- opt_out: true only if they asked not to be called again.
- answered: true if a person answered the call.
- status: "confirmed" if the provider agreed to do the job and gave any time or window (giving a time to come, in answer to "when can you come?", counts as agreeing, even without an explicit "yes"); "declined" if they said no; "no_reply" if nobody answered; otherwise "unclear".
- You must answer by calling the record_call_result tool, and nothing else.
- notes: a short plain-English note of anything else the provider said that matters (empty string if nothing).`;

const nullable = (type: string) => ({ type: [type, "null"] });

const TOOL: Anthropic.Tool = {
  name: "record_call_result",
  description: "Record the structured result of the provider call.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["answered", "can_do", "slot", "slot_raw", "slot_exact", "price_quote", "price_type", "provider_name", "visit_charge", "labour_estimate", "brings_parts", "reminder_ok", "callback_requested", "notes", "opt_out", "status"],
    properties: {
      answered: { type: "boolean" },
      can_do: nullable("boolean"),
      slot: nullable("string"),
      slot_raw: nullable("string"),
      slot_exact: { type: "boolean" },
      price_quote: nullable("string"),
      price_type: { type: "string", enum: ["fixed", "range", "after_inspection", "unknown"] },
      provider_name: nullable("string"),
      visit_charge: nullable("string"),
      labour_estimate: nullable("string"),
      brings_parts: nullable("boolean"),
      reminder_ok: nullable("boolean"),
      callback_requested: { type: "boolean" },
      notes: { type: "string" },
      opt_out: { type: "boolean" },
      status: { type: "string", enum: ["confirmed", "declined", "no_reply", "unclear"] },
    },
  },
};

const PRICE = ["fixed", "range", "after_inspection", "unknown"];
const STATUS = ["confirmed", "declined", "no_reply", "unclear"];
const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const boolOrNull = (v: unknown) => (typeof v === "boolean" ? v : null);

/** Final safety net: whatever Claude returns, only allowed values get through. */
export function sanitize(raw: Record<string, unknown>): ProviderCallJson {
  return {
    answered: raw.answered === true,
    can_do: boolOrNull(raw.can_do),
    slot: strOrNull(raw.slot),
    slot_raw: strOrNull(raw.slot_raw),
    slot_exact: raw.slot_exact === true && strOrNull(raw.slot) !== null,
    price_quote: strOrNull(raw.price_quote),
    price_type: PRICE.includes(raw.price_type as string) ? (raw.price_type as ProviderCallJson["price_type"]) : "unknown",
    provider_name: strOrNull(raw.provider_name),
    visit_charge: strOrNull(raw.visit_charge),
    labour_estimate: strOrNull(raw.labour_estimate),
    brings_parts: boolOrNull(raw.brings_parts),
    reminder_ok: boolOrNull(raw.reminder_ok),
    callback_requested: raw.callback_requested === true,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    opt_out: raw.opt_out === true,
    status: STATUS.includes(raw.status as string) ? (raw.status as ProviderCallJson["status"]) : "unclear",
  };
}

export interface SummaryContext {
  timeWindow?: string; // the customer's requested window, e.g. "Today 5–8 PM" or "Now (1–2 hours)"
  requestedAt?: string; // ISO time the request was made
}

const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });

export async function summaryToJson(summaryText: string, ctx: SummaryContext = {}): Promise<ProviderCallJson> {
  const context = ctx.timeWindow
    ? `Customer's requested time window: ${ctx.timeWindow}.${ctx.requestedAt ? ` The request was made at ${ist(ctx.requestedAt)} (India time).` : ""}\n\n`
    : "";
  const res = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "auto" }, // this model does not accept a forced tool, so the system prompt says to call it
    messages: [{ role: "user", content: `${context}Fo's call summary:\n\n${summaryText}` }],
  });
  const use = res.content.find((c) => c.type === "tool_use");
  if (!use || use.type !== "tool_use") throw new Error("Claude did not return structured data");
  return sanitize(use.input as Record<string, unknown>);
}

// ---------------------------------------------------------------------------------------------
// Other call types: same rule (8.6 rule 1). Claude turns Fo's summary into JSON with allowed values only.

async function extract(system: string, tool: Anthropic.Tool, userText: string): Promise<Record<string, unknown>> {
  const res = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: `${system}\nYou must answer by calling the ${tool.name} tool, and nothing else. Use null for anything that was not clearly said. Never guess.`,
    tools: [tool],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: userText }],
  });
  const use = res.content.find((c) => c.type === "tool_use");
  if (!use || use.type !== "tool_use") throw new Error("Claude did not return structured data");
  return use.input as Record<string, unknown>;
}

export async function customerSummaryToJson(summaryText: string, offeredNames: string[]): Promise<CustomerCallJson> {
  const raw = await extract(
    `You turn an AI phone assistant's call summary into data for Hogaya. Fo called the CUSTOMER and offered one or two providers. Record only what the customer said.
- confirmed: true only if the customer clearly agreed to an option; false if they declined every option offered; null if unclear or no answer.
- preferred_option: the name of the chosen provider, exactly one of: ${offeredNames.join(", ")}; else null.
- notes: a short plain-English note of anything else that matters (empty string if nothing).`,
    {
      name: "record_customer_result",
      description: "Record the result of the customer confirmation call.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["confirmed", "preferred_option", "notes"],
        properties: { confirmed: nullable("boolean"), preferred_option: nullable("string"), notes: { type: "string" } },
      },
    },
    `Fo's call summary:\n\n${summaryText}`,
  );
  const chosen = typeof raw.preferred_option === "string" ? offeredNames.find((n) => n.toLowerCase() === (raw.preferred_option as string).toLowerCase() || n.split(" ")[0].toLowerCase() === (raw.preferred_option as string).split(" ")[0].toLowerCase()) : undefined;
  return {
    confirmed: boolOrNull(raw.confirmed),
    preferred_option: chosen ?? null,
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

const TIME_RULES = `Times: write the time in numbers like "6:15 PM". The summary may be in Hindi (Devanagari) or Roman script. Hindi time words are exact times: "sawa X" / "सवा X" = X:15, "saadhe X" / "साढ़े X" = X:30, "paune X" / "पौने X" = (X-1):45, "dedh" / "डेढ़" = 1:30, "dhai" / "ढाई" = 2:30, "X baje" / "X बजे" = X:00 (शाम = evening, सुबह = morning). Write the fields in English or numbers. हाँ / जी / ठीक है = yes; नहीं = no. slot_exact is true only for one specific time; false for a window or a vague time.`;

export async function bookingSummaryToJson(summaryText: string, ctx: { slot?: string | null } = {}): Promise<BookingCallJson> {
  const raw = await extract(
    `You turn an AI phone assistant's call summary into data for Hogaya. Fo called the PROVIDER to confirm a booking and share the address. Record only what the provider said.
- confirmed: true only if the provider clearly confirmed they will come; false if they said no or cannot come; null if unclear or no answer.
- slot: the time agreed on THIS call, else null. ${TIME_RULES}
${ctx.slot ? `The slot discussed before this call was: ${ctx.slot}.` : ""}
- notes: a short plain-English note of anything else that matters (empty string if nothing).`,
    {
      name: "record_booking_result",
      description: "Record the result of the booking confirmation call.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["confirmed", "slot", "slot_exact", "notes"],
        properties: { confirmed: nullable("boolean"), slot: nullable("string"), slot_exact: { type: "boolean" }, notes: { type: "string" } },
      },
    },
    `Fo's call summary:\n\n${summaryText}`,
  );
  const slot = strOrNull(raw.slot);
  return { confirmed: boolOrNull(raw.confirmed), slot, slot_exact: raw.slot_exact === true && slot !== null, notes: typeof raw.notes === "string" ? raw.notes : "" };
}

export interface ReconfirmJson {
  reconfirmed: boolean | null;
  can_make_it: boolean | null;
  exact_time: string | null;
  notes: string;
}

export async function reconfirmSummaryToJson(summaryText: string): Promise<ReconfirmJson> {
  const raw = await extract(
    `You turn an AI phone assistant's call summary into data for Hogaya. Fo called the booked PROVIDER to reconfirm the booking. Record only what the provider said.
- reconfirmed: true only if the provider clearly said they will come; false if they said they will not or cannot; null if unclear, busy, or nobody answered.
- can_make_it: false if they said they cannot make it; true if they said they can; else null.
- exact_time: an exact time given on THIS call (one specific time, in numbers like "6:30 PM"), else null. ${TIME_RULES}
- notes: a short plain-English note of anything else that matters (empty string if nothing).`,
    {
      name: "record_reconfirm_result",
      description: "Record the result of the reconfirmation call.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["reconfirmed", "can_make_it", "exact_time", "notes"],
        properties: { reconfirmed: nullable("boolean"), can_make_it: nullable("boolean"), exact_time: nullable("string"), notes: { type: "string" } },
      },
    },
    `Fo's call summary:\n\n${summaryText}`,
  );
  return { reconfirmed: boolOrNull(raw.reconfirmed), can_make_it: boolOrNull(raw.can_make_it), exact_time: strOrNull(raw.exact_time), notes: typeof raw.notes === "string" ? raw.notes : "" };
}

/** The arrival code the customer shows the Pro. Must match the length issued in confirm-arrival (6 digits). */
export const ARRIVAL_CODE_LENGTH = 6;

export async function arrivalSummaryToJson(summaryText: string): Promise<ArrivalJson> {
  const raw = await extract(
    `You turn an AI phone assistant's call summary into data for Hogaya. Fo called the PROVIDER and asked whether they reached the customer's place and for the service code the customer gave them at the door. Record only what the provider said.
- arrived: true if the provider said they are at the customer's place, false if they said they are not, else null.
- provider_gave_code: true only if the provider actually said a code.
- code_digits: the code the provider said as digits only (for example "473521"). Convert spoken number words in Hindi (Devanagari or Roman), Hinglish or English ("chaar saat teen paanch", "चार सात तीन पाँच", "four seven three five", "47 35") into digits (शून्य/ज़ीरो 0, एक 1, दो 2, तीन 3, चार 4, पाँच 5, छह 6, सात 7, आठ 8, नौ 9). If the provider did not give exactly ${ARRIVAL_CODE_LENGTH} digits, put null here and explain in notes. Copy the digits exactly as the provider said them; do not correct or guess them.
- notes: a short plain-English note of anything else that matters (empty string if nothing).`,
    {
      name: "record_arrival_result",
      description: "Record what the provider said when asked for the arrival code.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["arrived", "provider_gave_code", "code_digits", "notes"],
        properties: { arrived: nullable("boolean"), provider_gave_code: { type: "boolean" }, code_digits: nullable("string"), notes: { type: "string" } },
      },
    },
    `Fo's call summary:\n\n${summaryText}`,
  );
  const digits = typeof raw.code_digits === "string" ? raw.code_digits.replace(/\D/g, "") : "";
  return { arrived: boolOrNull(raw.arrived), provider_gave_code: raw.provider_gave_code === true && digits.length === ARRIVAL_CODE_LENGTH, code_digits: digits.length === ARRIVAL_CODE_LENGTH ? digits : null, notes: typeof raw.notes === "string" ? raw.notes : "" };
}
