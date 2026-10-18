import type { Category } from "./categories";
export type { Category };

/** Accounts are Supabase Auth users (email magic link or Google). The role is set by our server: the operator is the one email in OPERATOR_EMAIL. */
export type Role = "customer" | "pro" | "operator";
export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email?: string;
  provider_id?: string; // for a Pro: their provider record
  created_at: string;
}

export interface Provider {
  id: string;
  name: string;
  category: Category; // the main category
  categories?: Category[]; // everything this Pro does (a seeded demo provider has just the main one)
  area?: string; // sector the Pro works in
  visit_charge?: string; // the Pro's usual visit charge, e.g. "₹150"
  verified?: boolean; // true for a Pro onboarded by Hogaya (shown as "Onboarded by Hogaya"; there is no KYC)
  email?: string;
  onboarded_by?: string; // who onboarded this Pro at Hogaya
  onboarded_at?: string;
  phone: string;
  consent_ai_call: boolean;
  consent_date: string;
  opt_out: boolean;
  reliability: number; // 0-100, measured
  on_time_pct: number;
  jobs: number;
  no_shows?: number;
  demo: boolean;
}

/** The 8.4 JSON. Anything the provider did not say stays null. */
export interface ProviderCallJson {
  answered: boolean;
  can_do: boolean | null;
  slot: string | null; // the time in numbers, e.g. "6:15 PM"
  slot_raw: string | null; // the provider's exact words, e.g. "sawa chhe"
  slot_exact: boolean; // true only if the provider gave one specific time (not a window)
  price_quote: string | null;
  price_type: "fixed" | "range" | "after_inspection" | "unknown";
  provider_name: string | null;
  visit_charge: string | null;
  labour_estimate: string | null;
  brings_parts: boolean | null;
  reminder_ok: boolean | null;
  callback_requested: boolean;
  notes: string;
  opt_out: boolean;
  status: "confirmed" | "declined" | "no_reply" | "unclear";
}

export interface CustomerCallJson {
  confirmed: boolean | null;
  preferred_option: string | null; // the provider name the customer chose
  notes: string;
}

export interface BookingCallJson {
  confirmed: boolean | null;
  slot: string | null;
  slot_exact?: boolean;
  notes: string;
}

/** What the provider said when Fo asked for the code. The code itself is compared by our code, never by Fo. */
export interface ArrivalJson {
  arrived: boolean | null;
  provider_gave_code: boolean;
  code_digits: string | null;
  notes: string;
}

export type CallKind = "provider" | "customer" | "booking" | "reconfirm" | "on_the_way" | "arrival";

export interface CallRecord {
  id: string;
  kind: CallKind;
  provider_id?: string;
  provider_name?: string;
  status: "calling" | "waiting_summary" | "needs_reply" | "timed_out" | "needs_review" | "failed" | "done";
  started_at: string;
  ended_at?: string; // when the call finished (done, failed or timed out)
  fo_conversation_id?: string; // internal, never shown to users
  progress?: string; // Fo's latest one-line progress
  question?: string; // set when Fo asks something instead of calling
  operator_reply?: string; // the operator's answer, picked up by the call loop
  demo?: boolean; // true when the result came from the fake demo agent
  summary_text?: string;
  meta?: CallMeta; // where this call is in its short-step life (see lib/engine.ts)
  json?: ProviderCallJson | CustomerCallJson | BookingCallJson | ArrivalJson | Record<string, unknown>;
}

/** Bookkeeping for the tick engine. Never shown to customers. */
export interface CallMeta {
  baseline?: number; // Fo messages that existed when we started waiting for the summary
  waiting_since?: string;
  simulate?: boolean; // reconfirm: the operator's "Simulate no reconfirm" demo switch was on
  ask_exact?: boolean; // reconfirm: ask the Pro for an exact time
  recipient?: string; // who is phoned: "pro" or "customer" (the mock-call log)
  recipient_name?: string;
  attempt?: number; // 1, 2, ... for this person and step
}

export type StepKey =
  | "matching"
  | "calling_provider"
  | "waiting_summary"
  | "shortlist_ready"
  | "calling_customer"
  | "booking_provider"
  | "booked";

export interface Booking {
  provider_id: string;
  slot: string;
  slot_exact?: boolean;
  visit_charge: string | null;
  arrival_code: string;
  confirmed_via: "fo_call" | "screen";
  booked_at: string;
  reconfirmed_at?: string;
  on_the_way_at?: string;
  provider_confirmed?: boolean; // false while a backup provider has been activated but not yet confirmed by a call
  pro_arrived_at?: string; // the Pro said "I have arrived" in the Pro app
  arrival_verified_at?: string; // the CUSTOMER confirmed the Pro is there: only then is the completion code issued
  code_issued_at?: string;
  code_expires_at?: string;
  code_attempts?: number; // wrong codes typed by the Pro (locked after 5)
  confirm_call_at?: string; // when the final-hour confirmation call is due (30 minutes before the slot)
  ranking?: { stars: number; note: string; by: string; at: string }; // the operator's ranking after a completed job
  arrival_flag?: string; // set when the provider did not give the right code: the operator must look
  reconfirm_at?: string; // when the automatic reconfirm is due (60 minutes before the slot)
  reconfirm_pending?: boolean;
  completed_at?: string;
  outcome?: "completed" | "no_show";
  outcome_at?: string;
  bill?: Bill;
  job_done_at?: string; // the customer pressed "Job done"
  rating?: { stars: number; feedback: string; at: string };
  backup_provider_id?: string;
  backup_activation?: { from_name: string; to_name: string; at: string };
}

/** The booking state machine. Paused, flagged and cancelled can happen at any point. */
export type BookingState =
  | "requested" | "calling_providers" | "options_ready" | "calling_customer" | "customer_chose" | "booking_provider"
  | "booked" | "reconfirm_due" | "reconfirmed" | "pro_arrived" | "arrived" | "completed" | "closed"
  | "flagged" | "paused" | "cancelled";

export interface Flag {
  at: string;
  reason: string;
  resolved_at?: string;
}

export type NotifyKind = "booked" | "backup" | "reconfirmed" | "pro_arrived" | "arrived" | "completed" | "bill";
export interface Notification {
  id: string;
  at: string;
  kind: NotifyKind;
  vars?: Record<string, string>;
}

/** The Pro's final bill. It is not an invoice: it records what the Pro says is due. */
export interface Bill {
  visit_fee: number;
  labour: number;
  parts: number;
  total: number;
  note?: string;
  submitted_at: string;
}

export interface HogayaRequest {
  id: string;
  created_at: string;
  category: Category;
  problem: string;
  sector: string;
  address: string;
  time_window: string;
  notes?: string; // optional extra notes from the customer
  customer: { name: string; phone: string; consent_ai_call: boolean; consent_at: string; user_id?: string };
  state: BookingState;
  notifications: Notification[];
  prev_state?: BookingState; // where to go back to when a paused or flagged booking is resumed
  flags: Flag[];
  manual?: boolean; // the operator took over: autopilot never touches this booking
  archived?: boolean; // hidden from the console unless "Show archived" is on (nothing is ever deleted)
  step: StepKey;
  demo: boolean; // true = fake demo calls only (demo mode, or a category that is not live)
  current_provider_name?: string;
  matched: string[];
  calls: CallRecord[];
  awaiting_call?: string; // provider id waiting for the operator to click "Call now" (live requests only)
  call_approved?: string; // provider id the operator approved
  skip_rest?: boolean; // operator chose to stop calling and go to the shortlist
  skipped?: string[]; // providers we will not call (blocked by consent, opt-out or the approved list)
  customer_choice?: { provider_id: string; via: "fo_call" | "screen"; at: string }; // set when the customer confirms
  not_selected?: string[]; // provider ids who were not chosen (the next best stays on as the backup)
  customer_declined?: boolean; // the customer said no to every offered option
  screen_confirm_open?: boolean; // true when the customer may confirm on screen (the Fo call failed, or the operator allowed it)
  booking?: Booking;
  events: { at: string; text: string }[];
}

export interface Settings {
  autopilot: boolean; // operator switch, default OFF. With AGENT_MODE=real, every step of a live booking runs by itself
  simulate_no_reconfirm: boolean; // demo toggle: the next "Reconfirm now" fails, so the backup is activated
}

export interface DB {
  users: User[];
  providers: Provider[];
  requests: HogayaRequest[];
  settings: Settings;
}
