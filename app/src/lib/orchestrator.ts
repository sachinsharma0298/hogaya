// Hogaya layer: booking a chosen Pro, and creating a request. Matching and calling are the tick engine's job (engine.ts).
import { confirmedOptions } from "./live-actions";
import { notify, transition } from "./booking";
import { computeReconfirmAt } from "./state";
import { getProviders, getRequest, updateRequest } from "./store";
import type { HogayaRequest, ProviderCallJson } from "./types";

export async function bookNow(id: string, providerId: string, via: "fo_call" | "screen", overrides?: { slot?: string | null; slot_exact?: boolean }) {
  const req = await getRequest(id);
  if (!req || req.booking) return;
  const json = req.calls.find((c) => c.kind === "provider" && c.provider_id === providerId)?.json as ProviderCallJson | undefined;
  // Backup = the next best provider who actually confirmed (same ranking as the shortlist).
  const backup = (await confirmedOptions(req)).find((o) => o.provider.id !== providerId);
  const bookedAt = new Date().toISOString();
  const slot = overrides?.slot ?? json?.slot ?? "—";
  await updateRequest(id, (r) => {
    r.booking = {
      backup_provider_id: backup?.provider.id,
      provider_id: providerId,
      slot,
      slot_exact: overrides?.slot ? overrides.slot_exact ?? json?.slot_exact : json?.slot_exact,
      provider_confirmed: true,
      visit_charge: json?.visit_charge ?? null,
      arrival_code: "", // the completion code is issued only after the CUSTOMER confirms the Pro has arrived
      confirmed_via: via,
      booked_at: bookedAt,
      reconfirm_at: computeReconfirmAt(slot, bookedAt, r.time_window, r.created_at),
      confirm_call_at: computeReconfirmAt(slot, bookedAt, r.time_window, r.created_at, 30, 10),
    };
    // Everyone who was matched but not chosen is "Not selected" (the next best stays on as the backup).
    r.not_selected = r.matched.filter((m) => m !== providerId);
    r.step = "booked";
    r.events.push({ at: bookedAt, text: via === "screen" ? "Customer confirmed on screen" : "Customer confirmed on Fo's call" });
  });
  await transition(id, "booked");
  const who = (await getProviders()).find((p) => p.id === providerId)?.name.split(" ")[0] ?? "";
  await notify(id, "booked", { name: who, slot });
}

export function newRequest(input: {
  category: HogayaRequest["category"]; problem: string; sector: string; address: string;
  time_window: string; notes?: string; name: string; phone: string; consent: boolean; user_id?: string; demo: boolean;
}): HogayaRequest {
  const now = new Date().toISOString();
  return {
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    created_at: now,
    category: input.category,
    problem: input.problem,
    sector: input.sector,
    address: input.address,
    time_window: input.time_window,
    notes: input.notes?.trim() || undefined,
    customer: { name: input.name, phone: input.phone, consent_ai_call: input.consent, consent_at: now, user_id: input.user_id },
    state: "requested",
    notifications: [],
    flags: [],
    step: "matching",
    demo: input.demo,
    matched: [],
    calls: [],
    events: [{ at: now, text: "Request received" }],
  };
}
