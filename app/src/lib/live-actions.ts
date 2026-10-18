// Hogaya layer: what happens to a booking when a call finishes (applyProvider/Customer/Booking/Reconfirm/Arrival).
// Starting and checking calls is the tick engine's job (engine.ts).
import { type JobInfo, type Option } from "./agent-service";
import { flagBooking, notify, resolveFlagsMatching, transition } from "./booking";
import { bookNow } from "./orchestrator";
import { attemptCount, MAX_ATTEMPTS } from "./state";
import { rankOptions } from "./recommend";
import { getProviders, getRequest, patchCall, updateRequest, updateSettings } from "./store";
import type { ReconfirmJson } from "./summarise";
import type { ArrivalJson, BookingCallJson, CallRecord, CustomerCallJson, HogayaRequest, Provider, ProviderCallJson } from "./types";

const newId = () => `c-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
const log = async (id: string, text: string) => await updateRequest(id, (r) => void r.events.push({ at: now(), text }));
export const jobOf = (r: HogayaRequest): JobInfo => ({ category: r.category, problem: r.problem, sector: r.sector, time_window: r.time_window, notes: r.notes });

const IN_FLIGHT = ["calling", "waiting_summary", "needs_reply"];
export const hasCallInFlight = (r: HogayaRequest) => r.calls.some((c) => IN_FLIGHT.includes(c.status));

/** Providers who actually confirmed, ranked: exact time first, then reliability, then lower visit charge. */
export async function confirmedOptions(r: HogayaRequest): Promise<Option[]> {
  const providers = await getProviders();
  const opts = r.calls
    .filter((c) => c.kind === "provider" && c.status === "done" && (c.json as ProviderCallJson | undefined)?.status === "confirmed")
    .map((c) => ({ provider: providers.find((p) => p.id === c.provider_id)!, json: c.json as ProviderCallJson }))
    .filter((o) => o.provider);
  return rankOptions(opts.map((o) => ({ ...o, providerId: o.provider.id, reliability: o.provider.reliability })));
}

export const optionFor = async (r: HogayaRequest, providerId: string): Promise<Option | undefined> => (await confirmedOptions(r)).find((o) => o.provider.id === providerId);

export async function setCustomerChoice(id: string, providerId: string, via: "fo_call" | "screen") {
  if ((await getRequest(id))?.customer_choice) return; // the first choice stands: a later screen click must not rewrite how it was confirmed
  const p = (await getProviders()).find((x) => x.id === providerId);
  await updateRequest(id, (r) => {
    r.customer_choice = { provider_id: providerId, via, at: now() };
    r.customer_declined = false;
    r.events.push({ at: now(), text: `Customer chose ${p?.name ?? "a provider"} ${via === "screen" ? "on screen" : "on Fo's call"}` });
  });
  await transition(id, "customer_chose");
}

// ---- applying a finished call: shared by the live steps and by "Check again" -----------------------------

export async function applyProvider(id: string, callId: string, json: ProviderCallJson) {
  await patchCall(id, callId, { status: "done", json });
  const c = (await getRequest(id))?.calls.find((x) => x.id === callId);
  await log(id, `${c?.provider_name}: ${json.status}`);
}

export async function applyCustomer(id: string, callId: string, json: CustomerCallJson) {
  await patchCall(id, callId, { status: "done", json });
  const r = (await getRequest(id))!;
  const opts = await confirmedOptions(r);
  if (json.confirmed === true) {
    const chosen = opts.find((o) => o.provider.name === json.preferred_option) ?? opts[0];
    if (chosen) return await setCustomerChoice(id, chosen.provider.id, "fo_call");
  }
  // No clear choice: the customer may now confirm on screen, and the operator is told.
  await updateRequest(id, (x) => {
    x.customer_declined = json.confirmed === false;
    x.step = "shortlist_ready";
    x.screen_confirm_open = true;
  });
  await transition(id, "options_ready");
  if (json.confirmed === false) {
    await log(id, "Customer declined the offered options");
    await flagBooking(id, "The customer declined every option");
  } else if (attemptCount(r, { kind: "customer" }) >= MAX_ATTEMPTS || r.demo) {
    await log(id, "Customer's answer was unclear");
    await flagBooking(id, `The customer gave no clear answer after ${MAX_ATTEMPTS} tries`);
  } else {
    await log(id, "Customer's answer was unclear: trying once more");
  }
}

export async function applyBooking(id: string, callId: string, json: BookingCallJson) {
  await patchCall(id, callId, { status: "done", json });
  const r = (await getRequest(id))!;
  const c = r.calls.find((x) => x.id === callId)!;
  const provider = (await getProviders()).find((p) => p.id === c.provider_id);
  if (json.confirmed !== true) {
    await log(id, `${provider?.name} did not confirm the booking`);
    const tries = attemptCount(r, { kind: "booking", providerId: c.provider_id });
    if (json.confirmed === false) await flagBooking(id, `${provider?.name} declined the booking`);
    else if (tries >= MAX_ATTEMPTS || r.demo) await flagBooking(id, `${provider?.name}: no clear confirmation after ${MAX_ATTEMPTS} tries`);
    return;
  }
  if (r.booking && r.booking.provider_confirmed === false) {
    await updateRequest(id, (x) => {
      x.booking!.provider_confirmed = true;
      if (json.slot) { x.booking!.slot = json.slot; x.booking!.slot_exact = json.slot_exact ?? x.booking!.slot_exact; }
      x.events.push({ at: now(), text: `${provider?.name} confirmed the booking (backup)` });
    });
    await transition(id, "booked");
  } else if (!r.booking && c.provider_id) {
    await bookNow(id, c.provider_id, r.customer_choice?.via ?? "fo_call", { slot: json.slot, slot_exact: json.slot_exact });
  }
}

export async function applyReconfirm(id: string, callId: string, json: ReconfirmJson | Record<string, unknown>, simulate = false) {
  await patchCall(id, callId, { status: "done", json: json as Record<string, unknown> });
  const r = (await getRequest(id))!;
  const c = r.calls.find((x) => x.id === callId)!;
  const provider = (await getProviders()).find((p) => p.id === c.provider_id);
  const j = json as { reconfirmed?: boolean | null; can_make_it?: boolean | null; exact_time?: string | null };
  if (!r.booking || !provider) return;
  if (j.reconfirmed === true && j.can_make_it !== false) {
    await updateRequest(id, (x) => {
      x.booking!.reconfirmed_at = now();
      x.booking!.reconfirm_pending = false;
      if (j.exact_time && x.booking!.slot_exact === false) {
        x.booking!.slot = j.exact_time; // the reconfirm call got the exact time
        x.booking!.slot_exact = true;
        x.events.push({ at: now(), text: `Reconfirmed with ${provider.name}; exact time now ${j.exact_time}` });
      } else {
        x.events.push({ at: now(), text: `Reconfirmed with ${provider.name}` });
      }
    });
    await notify(id, "reconfirmed", { name: provider.name.split(" ")[0] });
    return await transition(id, "reconfirmed");
  }
  // The provider cannot make it (or did not reconfirm): Hogaya activates the backup provider.
  if (simulate) await updateSettings({ simulate_no_reconfirm: false }); // one-shot
  const backup = (await getProviders()).find((p) => p.id === r.booking!.backup_provider_id);
  const backupOpt = backup && await optionFor(r, backup.id);
  if (!backup || !backupOpt) {
    await updateRequest(id, (x) => void (x.booking!.reconfirm_pending = false));
    await log(id, `${provider.name} did not reconfirm. No backup provider is available.`);
    return await flagBooking(id, `${provider.name} did not reconfirm and there is no backup provider`);
  }
  await updateRequest(id, (x) => {
    x.booking = {
      ...x.booking!,
      provider_id: backup.id,
      slot: backupOpt.json.slot ?? "—",
      slot_exact: backupOpt.json.slot_exact,
      visit_charge: backupOpt.json.visit_charge,
      backup_provider_id: undefined,
      provider_confirmed: false, // confirmed only after a booking call to the backup
      reconfirm_pending: false,
      backup_activation: { from_name: provider.name, to_name: backup.name, at: now() },
    };
    x.events.push({ at: now(), text: `${provider.name} did not reconfirm. Hogaya activated backup provider ${backup.name}.` });
  });
  await notify(id, "backup", { from: provider.name.split(" ")[0], to: backup.name.split(" ")[0] });
  await transition(id, "booking_provider"); // the backup still needs its own booking call
}

export async function applyArrival(id: string, callId: string, json: ArrivalJson) {
  await patchCall(id, callId, { status: "done", json });
  const r = (await getRequest(id))!;
  const c = r.calls.find((x) => x.id === callId)!;
  const provider = (await getProviders()).find((p) => p.id === c.provider_id);
  if (!r.booking) return;
  const said = (json.code_digits ?? "").replace(/\D/g, "");
  if (said && said === r.booking.arrival_code) {
    await updateRequest(id, (x) => {
      x.booking!.arrival_verified_at = now();
      x.booking!.arrival_flag = undefined;
      x.events.push({ at: now(), text: `Arrival verified ✓: ${provider?.name} gave the right code` });
    });
    await notify(id, "arrived", { name: provider?.name.split(" ")[0] ?? "" });
    await transition(id, "arrived");
    await resolveFlagsMatching(id, /code check failed|service code/i);
  } else {
    const why = said ? "gave a code that does not match" : "did not give a code";
    await updateRequest(id, (x) => {
      x.booking!.arrival_flag = `${provider?.name} ${why}`;
      x.events.push({ at: now(), text: `ARRIVAL NOT VERIFIED: ${provider?.name} ${why}. Operator must check.` });
    });
    await flagBooking(id, `Arrival code check failed: ${provider?.name} ${why}`);
  }
}
