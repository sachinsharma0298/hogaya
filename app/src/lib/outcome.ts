// Recording how a job ended. Updates the provider's reliability score (demo formulas) exactly once per booking.
import { transition } from "./booking";
import { getRequest, updateProvider, updateRequest } from "./store";

export async function recordOutcome(id: string, outcome: "completed" | "no_show"): Promise<{ ok: true; reliability?: number } | { ok: false; error: string; status: number }> {
  const r = await getRequest(id);
  if (!r?.booking) return { ok: false, error: "Not booked yet.", status: 400 };
  if (r.booking.outcome) return { ok: false, error: "Outcome already recorded.", status: 409 };
  const now = new Date().toISOString();
  const p = await updateProvider(r.booking.provider_id, (p) => {
    if (outcome === "completed") {
      p.on_time_pct = Math.round((p.on_time_pct * p.jobs + 100) / (p.jobs + 1));
      p.reliability = Math.min(100, p.reliability + 1);
    } else {
      p.on_time_pct = Math.round((p.on_time_pct * p.jobs) / (p.jobs + 1));
      p.reliability = Math.max(0, p.reliability - 8);
      p.no_shows = (p.no_shows ?? 0) + 1;
    }
    p.jobs += 1;
  });
  await updateRequest(id, (x) => {
    x.booking!.outcome = outcome;
    x.booking!.outcome_at = now;
    if (outcome === "completed") x.booking!.completed_at = now;
    x.events.push({ at: now, text: `${p?.name ?? "Provider"} job ${outcome === "completed" ? "completed" : "marked no-show"}; reliability now ${p?.reliability}` });
  });
  if (outcome === "completed") await transition(id, "completed");
  return { ok: true, reliability: p?.reliability };
}
