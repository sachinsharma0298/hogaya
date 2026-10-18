"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, PhoneCall, RefreshCw, ShieldCheck, UserX } from "lucide-react";
import { DemoBadge } from "@/components/brand";
import { OptionsTable, type OptionRow } from "@/components/options-table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { rankOptions, recommendationReason } from "@/lib/recommend";
import { DICTS } from "@/lib/translations";
import type { HogayaRequest } from "@/lib/types";
import { CallTimeline } from "./call-timeline";
import { catLabel, openFlagCount, StateChip } from "./booking-list";
import type { ConsoleData, ConsoleSettings } from "./console-types";

const enT = (key: string, vars?: Record<string, string | number>) => {
  let s = DICTS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};

const IN_FLIGHT = ["calling", "waiting_summary", "needs_reply", "unconfirmed"];
const phoneHint = (p?: string) => (p ? `•••• ${p.replace(/\D/g, "").slice(-4)}` : "no number");

function RankBox({ r, onSave }: { r: HogayaRequest; onSave: (stars: number, note: string) => Promise<unknown> | void }) {
  const [stars, setStars] = useState(r.booking?.ranking?.stars ?? 0);
  const [note, setNote] = useState(r.booking?.ranking?.note ?? "");
  return (
    <section className="rounded-3xl border bg-card p-5">
      <h2 className="text-sm font-semibold">Rank this Pro</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={stars === n} onClick={() => setStars(n)} className={`size-9 rounded-xl border text-sm font-semibold ${stars === n ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{n}</button>)}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Ranking note" className="h-9 min-w-40 flex-1 rounded-xl border bg-background px-3 text-sm" />
        <Button onClick={() => void onSave(stars, note)} disabled={stars === 0} variant="outline" className="h-9 rounded-xl text-xs">Save ranking</Button>
      </div>
      {r.booking?.ranking && <p className="mt-2 text-xs text-foreground/70">Saved: {r.booking.ranking.stars}/5 by {r.booking.ranking.by}</p>}
    </section>
  );
}

export function BookingDetail({ r, data, settings }: { r: HogayaRequest; data: ConsoleData; settings: ConsoleSettings }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const b = r.booking;
  const cfg = data.config;
  const live = !r.demo && cfg.agentMode === "real";
  const inflight = r.calls.some((c) => IN_FLIGHT.includes(c.status));
  const ended = ["completed", "closed", "cancelled"].includes(r.state);
  const nameOf = (id?: string) => data.providers.find((x) => x.id === id)?.name ?? "the provider";
  const customerHint = `•••• ${r.customer.phone.replace(/\D/g, "").slice(-4)}`;

  const options: OptionRow[] = rankOptions(
    r.calls
      .filter((c) => c.kind === "provider" && c.status === "done" && (c.json as { status?: string } | undefined)?.status === "confirmed")
      .map((c) => {
        const p = data.providers.find((x) => x.id === c.provider_id)!;
        return { providerId: p.id, name: p.name, json: c.json as OptionRow["json"], reliability: p.reliability };
      }),
  );

  async function post(path: string, body?: unknown) {
    setMsg("");
    const res = await fetch(`/api/requests/${r.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(j.error ?? "Something went wrong.");
    return res.ok;
  }
  const control = (action: string) => post("control", { action });
  async function run(key: string, path: string, body?: unknown, okMsg?: string) {
    setBusy(key);
    const ok = await post(path, body);
    if (ok && okMsg) setMsg(okMsg);
    setBusy(null);
  }
  async function toggleSim(v: boolean) {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ simulate_no_reconfirm: v }) });
  }

  const bookingActive = !!b && b.provider_confirmed !== false;
  const flags = r.flags.filter((f) => !f.resolved_at);
  const autoText = r.demo ? "demo bookings always run by themselves" : r.manual ? "off for this booking (you took over)" : settings.autopilot && cfg.agentMode === "real" ? "ON: this booking runs by itself" : "OFF: you click each step";

  return (
    <div className="space-y-4">
      {/* Header: status, autopilot, controls, flags */}
      <section className="rounded-3xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              {catLabel(r.category)} · {r.sector} {r.demo && <DemoBadge label="Demo: simulated calls" />}
            </h2>
            <p className="mt-0.5 text-sm text-foreground/85">{r.problem}</p>
            <p className="mt-1 text-xs text-foreground/65">{r.customer.name} ({customerHint}) · {r.time_window}{r.notes ? ` · note: ${r.notes}` : ""}</p>
          </div>
          <StateChip state={r.state} />
        </div>

        {flags.map((f, i) => <p key={i} role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-900">⚑ {f.reason}</p>)}

        <div className="mt-3 rounded-2xl border bg-muted/40 p-3">
          <p className="text-xs text-foreground/80">
            Autopilot: <b>{autoText}</b>
            {b?.reconfirm_at && !b.reconfirmed_at && ` · reconfirm due ${new Date(b.reconfirm_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.state === "paused" ? (
              <Button onClick={() => control("resume")} className="h-8 rounded-lg text-xs">Resume</Button>
            ) : (
              <Button onClick={() => control("pause")} variant="outline" disabled={ended} className="h-8 rounded-lg text-xs">Pause</Button>
            )}
            <Button onClick={() => control("retry")} variant="outline" disabled={inflight || ended || r.state === "paused"} className="h-8 rounded-lg text-xs">Retry this step</Button>
            {r.manual
              ? <Button onClick={() => control("hand_back")} variant="outline" className="h-8 rounded-lg text-xs">Hand back to autopilot</Button>
              : <Button onClick={() => control("take_over")} variant="outline" className="h-8 rounded-lg text-xs">Take over manually</Button>}
            {b?.arrival_verified_at && b.outcome !== "completed" && <Button onClick={() => control("new_code")} variant="outline" className="h-8 rounded-lg text-xs">New completion code</Button>}
            {flags.length > 0 && <Button onClick={() => control("clear_flags")} variant="outline" className="h-8 rounded-lg text-xs">Clear flags</Button>}
            <Button onClick={() => control("fast_forward")} variant="outline" disabled={!bookingActive || !!b?.reconfirmed_at} className="h-8 rounded-lg text-xs">Fast-forward to T–60 <DemoBadge /></Button>
            <Button onClick={() => { if (window.confirm("Cancel this booking? Nothing more will be called.")) void control("cancel"); }} variant="outline" disabled={ended} className="h-8 rounded-lg text-xs text-destructive">Cancel booking</Button>
            <Button onClick={() => control(r.archived ? "unarchive" : "archive")} variant="outline" className="h-8 rounded-lg text-xs">{r.archived ? "Unarchive" : "Archive"}</Button>
          </div>
        </div>
        {msg && <p role="status" className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm">{msg}</p>}
      </section>

      {/* Booked summary, arrival, bill, rating */}
      {b && (
        <section className="rounded-3xl border bg-card p-5 text-sm">
          <h2 className="text-sm font-semibold">Booking</h2>
          <p className="mt-1">
            <b>{nameOf(b.provider_id)}</b> · {b.slot}{b.slot_exact === false ? " (not exact)" : ""} · visit {b.visit_charge ?? "not confirmed"} · completion code <b className="font-mono">{b.arrival_code || "not issued yet (the customer must confirm the arrival first)"}</b>{b.code_expires_at ? ` (expires ${new Date(b.code_expires_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, wrong tries ${b.code_attempts ?? 0}/5)` : ""}
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            Confirmed {r.customer_choice?.via === "fo_call" ? "on Fo's call" : r.customer_choice?.via === "screen" ? "on screen" : ""}
            {b.reconfirmed_at ? " · reconfirmed" : ""}{b.outcome ? ` · ${b.outcome === "completed" ? "completed" : "no-show"}` : ""}
            {b.provider_confirmed === false ? " · backup activated, not yet confirmed by a call" : ""}
          </p>
          {b.pro_arrived_at && <p className="mt-2 text-xs">Pro said arrived at {new Date(b.pro_arrived_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>}
          {b.arrival_verified_at && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">Customer confirmed the arrival ✓</p>}
          {b.outcome === "completed" && <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 font-semibold text-sky-900">Completed: the Pro submitted the right code</p>}
          {b.arrival_flag && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-900">Arrival NOT verified: {b.arrival_flag}</p>}
          {b.bill && <p className="mt-2">Final bill: visit ₹{b.bill.visit_fee} + labour ₹{b.bill.labour} + parts ₹{b.bill.parts} = <b>₹{b.bill.total}</b></p>}
          {b.rating && <p className="mt-2">Customer rating: {"★".repeat(b.rating.stars)}{"☆".repeat(5 - b.rating.stars)}{b.rating.feedback ? ` · “${b.rating.feedback}”` : ""}</p>}
        </section>
      )}

      {/* Next-step cards for live bookings */}
      {live && r.awaiting_call && (
        <section className="rounded-3xl border-2 border-primary bg-accent/50 p-5">
          <p className="text-sm font-semibold">Ready to call {nameOf(r.awaiting_call)} ({phoneHint(data.providers.find((x) => x.id === r.awaiting_call)?.phone)})</p>
          <p className="mt-0.5 text-xs text-foreground/80">This is a real phone call placed by Fo. It only starts when you click.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => run("call-now", "call-now")} disabled={busy !== null} className="rounded-xl"><PhoneCall className="mr-2 size-4" /> Call now</Button>
            <Button onClick={() => run("skip", "skip")} variant="outline" className="rounded-xl">Skip to shortlist</Button>
          </div>
        </section>
      )}
      {live && r.state === "options_ready" && !b && !r.customer_choice && options.length > 0 && !r.manual && (
        <section className="rounded-3xl border-2 border-primary bg-accent/50 p-5">
          <p className="text-sm font-semibold">Next: Fo calls the customer ({customerHint})</p>
          <p className="mt-1 text-xs text-foreground/85">
            Fo tells the customer {options.length > 1 ? "both options" : "the option"} in simple Hinglish (name, time, price), says Hogaya recommends <b>{options[0].name}</b> ({recommendationReason(options, enT).toLowerCase()}), and asks which one they want.
          </p>
          <p className="mt-1 text-xs text-foreground/80">A real phone call. {r.customer.consent_ai_call ? "The customer agreed to an AI call on the form." : "The customer did NOT consent."} It only starts when you click.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => run("call-customer", "call-customer", undefined, "Started. Watch the timeline for progress.")} disabled={inflight || busy !== null || !r.customer.consent_ai_call} className="rounded-xl"><PhoneCall className="mr-2 size-4" /> Call customer now</Button>
            {!r.screen_confirm_open && <Button onClick={() => run("allow-screen", "allow-screen")} variant="outline" className="rounded-xl">Let customer confirm on screen</Button>}
          </div>
        </section>
      )}
      {live && ((r.customer_choice && !b) || b?.provider_confirmed === false) && (
        <section className="rounded-3xl border-2 border-primary bg-accent/50 p-5">
          <p className="text-sm font-semibold">Next: Fo calls {nameOf(b?.provider_id ?? r.customer_choice?.provider_id)} to confirm the booking{b?.provider_confirmed === false ? " (backup)" : ""}</p>
          <p className="mt-1 text-xs text-foreground/85">Fo confirms the slot and visit charge, shares the address only now, and tells the provider the customer will give a 4-digit service code at the door. Fo never says the code. It only starts when you click.</p>
          <Button onClick={() => run("book-provider", "book-provider", undefined, "Started. Watch the timeline for progress.")} disabled={inflight || busy !== null || r.state === "paused"} className="mt-3 rounded-xl"><PhoneCall className="mr-2 size-4" /> Call provider to book</Button>
        </section>
      )}

      {/* Assign a Pro (before there is a booking) */}
      {!b && !ended && (
        <section className="rounded-3xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Assign a Pro</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select id="assign" aria-label="Pro to assign" defaultValue="" className="h-9 min-w-48 rounded-xl border bg-background px-2 text-sm">
              <option value="" disabled>Choose a Pro…</option>
              {data.providers.filter((p) => (p.categories ?? [p.category]).includes(r.category) && (r.demo ? p.demo : !p.demo)).map((p) => <option key={p.id} value={p.id}>{p.name}{p.demo ? " (simulated)" : ""}</option>)}
            </select>
            <Button onClick={() => { const v = (document.getElementById("assign") as HTMLSelectElement).value; if (v) void run("assign", "assign", { provider_id: v }, "Assigned. The flow restarts for this Pro."); }} variant="outline" className="h-9 rounded-xl text-xs">Assign and restart</Button>
          </div>
          <p className="mt-1 text-xs text-foreground/70">Only this Pro is called. A live booking can only take Pros on the approved list.</p>
        </section>
      )}

      {/* Rank the Pro after a completed job */}
      {b?.outcome === "completed" && <RankBox r={r} onSave={(stars, note) => run("rank", "rank", { stars, note }, "Ranking saved.")} />}

      {/* Step buttons */}
      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Steps</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => run("reconfirm", "reconfirm", undefined, "Started. Watch the timeline for progress.")} disabled={!bookingActive || inflight || busy !== null} className="rounded-xl">
            {busy === "reconfirm" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />} Reconfirm now {(r.demo || !cfg.realSteps.reconfirm) && <DemoBadge />}
          </Button>
          <Button onClick={() => control("fast_forward_confirm")} disabled={!bookingActive || !!b?.on_the_way_at} variant="outline" className="rounded-xl">
            <ShieldCheck className="mr-2 size-4" /> Fast-forward to T–30 (confirmation call) <DemoBadge />
          </Button>
          <Button onClick={() => run("check-on-way", "check-on-way", undefined, "Demo: checked.")} disabled={!bookingActive || inflight || busy !== null} variant="outline" className="rounded-xl">
            <PhoneCall className="mr-2 size-4" /> Confirmation call now (simulated) <DemoBadge />
          </Button>
          <Button onClick={() => run("completed", "outcome", { outcome: "completed" }, "Recorded as completed.")} disabled={!b || !!b.outcome || busy !== null} variant="outline" className="rounded-xl"><CheckCircle2 className="mr-2 size-4" /> Mark completed</Button>
          <Button onClick={() => run("no_show", "outcome", { outcome: "no_show" }, "Recorded as a no-show.")} disabled={!b || !!b.outcome || busy !== null} variant="outline" className="rounded-xl"><UserX className="mr-2 size-4" /> Mark no-show</Button>
        </div>
        <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm">
          <span>
            <span className="flex items-center gap-2 font-medium">Simulate no reconfirm <DemoBadge /></span>
            <span className="block text-xs text-foreground/75">No call is placed. The next “Reconfirm now” fails and Hogaya books the backup. Turns itself off after one use.</span>
          </span>
          <Switch checked={settings.simulate_no_reconfirm} onCheckedChange={toggleSim} aria-label="Simulate no reconfirm" />
        </label>
      </section>

      {/* Options side by side */}
      {options.length > 0 && (
        <section className="rounded-3xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Options side by side</h2>
            {live && r.state === "options_ready" && !r.customer_choice && !r.screen_confirm_open && (
              <Button onClick={() => run("allow-screen", "allow-screen")} variant="outline" className="h-8 rounded-lg text-xs">Let customer confirm on screen</Button>
            )}
          </div>
          <div className="mt-3"><OptionsTable options={options} reason={recommendationReason(options, enT)} t={enT} /></div>
          <p className="mt-2 text-xs text-foreground/70">
            Rule: confirmed exact time first, then higher reliability, then lower visit charge.
            {r.customer_choice && ` The customer chose ${nameOf(r.customer_choice.provider_id)} (${r.customer_choice.via === "fo_call" ? "on Fo's call" : "on screen"}).`}
            {r.screen_confirm_open && !r.customer_choice && " The customer may confirm on screen."}
          </p>
        </section>
      )}

      <CallTimeline r={r} post={post} />
      <p className="text-center text-[11px] text-foreground/50">{openFlagCount(r) === 0 ? "No open flags" : `${openFlagCount(r)} open flag(s)`} · booking {r.id}</p>
    </div>
  );
}
