// What a Pro may see about a job. Never the customer's phone or name, and never the service code.
import { getProviders, listRequests } from "./store";
import { visitAmount } from "./recommend";
import type { HogayaRequest, ProviderCallJson } from "./types";

export type ProTab = "new" | "booked" | "today" | "done";
export type ProStatus = "new" | "confirmed" | "reconfirm_pending" | "pro_arrived" | "arrived" | "completed" | "no_show" | "not_selected" | "cancelled";

export interface ProJob {
  id: string;
  tab: ProTab;
  today: boolean; // a booked job scheduled for today
  status: ProStatus;
  category: string;
  problem: string;
  notes?: string;
  sector: string;
  slot: string | null;
  slot_exact: boolean;
  visit_charge: string | null;
  labour_estimate: string | null;
  address: string | null; // only after the customer has confirmed this Pro
  can_confirm_arrival: boolean; // I have arrived
  can_enter_code: boolean; // only after the customer has confirmed the arrival
  arrived: boolean;
  bill: { visit_fee: number; labour: number; parts: number; total: number } | null;
  can_send_bill: boolean;
  completed: boolean;
  created_at: string;
}

const IST = 5.5 * 3600_000;
const istDay = (ms: number) => Math.floor((ms + IST) / 86_400_000);

/** The biggest number in a price like "₹300–500" (the top of the quoted range), or null. */
export function topAmount(s: string | null): number | null {
  const nums = (s ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/g)?.map(Number);
  return nums && nums.length ? Math.max(...nums) : null;
}

/** The most the quote allows: visit charge plus the top of the labour estimate (labour counts only if the Pro gave an estimate). */
export function quoteLimit(visit: string | null, labour: string | null): { total: number | null; visit: number | null } {
  const v = visitAmount(visit);
  const visitNum = Number.isFinite(v) ? v : null;
  const l = topAmount(labour);
  if (visitNum === null) return { total: null, visit: null };
  return { total: visitNum + (l ?? 0), visit: visitNum };
}

export async function jobsFor(providerId: string): Promise<ProJob[]> {
  const jobs: ProJob[] = [];
  for (const r of await listRequests()) {
    const call = r.calls.find((c) => c.kind === "provider" && c.provider_id === providerId && c.status === "done");
    const j = call?.json as ProviderCallJson | undefined;
    if (!j || j.status !== "confirmed") continue;
    jobs.push(toJob(r, providerId, j));
  }
  return jobs;
}

function toJob(r: HogayaRequest, providerId: string, j: ProviderCallJson): ProJob {
  const b = r.booking;
  const mine = b?.provider_id === providerId && b.provider_confirmed !== false;
  const chosenMe = r.customer_choice?.provider_id === providerId || b?.provider_id === providerId;
  let status: ProStatus;
  let tab: ProTab;
  let today = false;
  if (r.state === "cancelled") { status = "cancelled"; tab = "done"; }
  else if (mine) {
    if (b!.outcome === "no_show") { status = "no_show"; tab = "done"; }
    else if (b!.outcome === "completed" || b!.job_done_at) { status = "completed"; tab = "done"; }
    else if (b!.arrival_verified_at) { status = "arrived"; tab = "booked"; }
    else if (b!.pro_arrived_at) { status = "pro_arrived"; tab = "booked"; }
    else { status = b!.reconfirm_pending ? "reconfirm_pending" : "confirmed"; tab = "booked"; }
    // "Today": the slot day is the request day (or the next day for "Tomorrow ...")
    if (tab === "booked") {
      const day = istDay(new Date(r.created_at).getTime()) + (/^tomorrow/i.test(r.time_window) ? 1 : 0);
      today = day === istDay(Date.now());
    }
  } else if (b || (r.customer_choice && r.customer_choice.provider_id !== providerId)) { status = "not_selected"; tab = "done"; }
  else { status = "new"; tab = "new"; }

  return {
    id: r.id, tab, today, status,
    category: r.category, problem: r.problem, notes: r.notes, sector: r.sector,
    slot: mine ? b!.slot : j.slot, slot_exact: mine ? b!.slot_exact !== false : j.slot_exact,
    visit_charge: j.visit_charge, labour_estimate: j.labour_estimate,
    address: chosenMe && status !== "not_selected" && status !== "cancelled" ? r.address : null,
    can_confirm_arrival: mine && !b!.pro_arrived_at && !b!.arrival_verified_at && !b!.job_done_at && ["booked", "reconfirm_due", "reconfirmed"].includes(r.state),
    can_enter_code: mine && !!b!.arrival_verified_at && !b!.job_done_at,
    arrived: mine && !!b!.pro_arrived_at,
    bill: mine && b!.bill ? { visit_fee: b!.bill.visit_fee, labour: b!.bill.labour, parts: b!.bill.parts, total: b!.bill.total } : null,
    can_send_bill: mine && !!b!.arrival_verified_at && !b!.bill && !b!.job_done_at,
    completed: mine && b!.outcome === "completed",
    created_at: r.created_at,
  };
}

export const providerOf = async (id: string) => (await getProviders()).find((p) => p.id === id);
