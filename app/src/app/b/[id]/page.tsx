"use client";
import { use, useState } from "react";
import { CalendarClock, Check, CheckCheck, Loader2, Lock, MapPin, ShieldCheck, Star } from "lucide-react";
import { CustomerShell, DemoBadge, StateBox } from "@/components/brand";
import { NotificationBell, NotificationToast } from "@/components/notifications";
import { OptionsTable, type OptionRow } from "@/components/options-table";
import { Tracker } from "@/components/tracker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/lang";
import { slotText } from "@/lib/slots";
import { rankOptions, recommendationReason } from "@/lib/recommend";
import { isHold } from "@/lib/state";
import { usePoll } from "@/lib/use-poll";
import type { BookingState, HogayaRequest, Provider, ProviderCallJson } from "@/lib/types";

// Who does each step: Fo (the call) or Hogaya. Shown by the "Under the hood" switch.
const HOOD: Partial<Record<BookingState, string>> = {
  requested: "matching", calling_providers: "calling_provider", options_ready: "shortlist_ready", calling_customer: "calling_customer",
  customer_chose: "booking_provider", booking_provider: "booking_provider", booked: "booked", reconfirm_due: "booked", reconfirmed: "booked", pro_arrived: "booked", arrived: "booked",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useT();
  const { data, error } = usePoll<{ request: HogayaRequest; providers: Provider[] }>(`/api/requests/${id}`, 1500);
  const [hood, setHood] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("");

  if (!data) {
    return (
      <CustomerShell>
        {error ? <StateBox title={t("err.notfound")} body={t(error)} /> : <StateBox title={t("loading.title")} body={t("loading.body")} />}
      </CustomerShell>
    );
  }
  const r = data.request;
  const b = r.booking;
  // The customer never sees internal holds: a paused or flagged booking shows the state it was in.
  const held = isHold(r.state);
  const state: BookingState = held ? r.prev_state ?? "calling_providers" : r.state;
  const cancelled = r.state === "cancelled";
  const provider = data.providers.find((p) => p.id === (b?.provider_id ?? r.customer_choice?.provider_id));
  const first = (provider?.name ?? "").split(" ")[0];
  const confirmed = !!b && b.provider_confirmed !== false;

  const options: OptionRow[] = rankOptions(
    r.calls
      .filter((c) => c.kind === "provider" && c.status === "done" && (c.json as ProviderCallJson).status === "confirmed")
      .map((c) => {
        const p = data.providers.find((x) => x.id === c.provider_id)!;
        return { providerId: p.id, name: p.name, json: c.json as ProviderCallJson, reliability: p.reliability };
      }),
  );
  const showOptions = options.length > 0 && !confirmed && !cancelled;

  async function post(path: string, body?: unknown) {
    setErr("");
    const res = await fetch(`/api/requests/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    if (!res.ok) setErr(t("err.generic"));
    return res.ok;
  }
  async function choose(pid: string) {
    setBusy(pid);
    await post("confirm", { provider_id: pid });
    setBusy(null);
  }

  // Live status line under the tracker
  const statusLine =
    state === "calling_providers" ? t(r.step === "waiting_summary" ? "step.waiting_summary" : "step.calling_provider", { name: r.current_provider_name ?? "…" })
    : state === "calling_customer" ? t("step.calling_customer")
    : state === "booking_provider" || state === "customer_chose" ? t(b || r.calls.some((c) => c.kind === "booking" && ["calling", "waiting_summary"].includes(c.status)) ? "step.booking_provider" : "step.booking_waiting", { name: first || "…" })
    : "";

  const heading = cancelled ? t("b.h.cancelled") : state === "completed" || state === "closed" ? t("b.done.final") : confirmed ? t("b.h.booked") : options.length ? t("b.h.options") : t("b.h.finding");
  const canFinish = false; // the booking is now completed by the Pro submitting the code, not by a "Job done" button
  const needsRating = b?.outcome === "completed" && !b.rating;
  const hoodKey = HOOD[state];

  return (
    <CustomerShell right={<NotificationBell requestId={id} items={r.notifications ?? []} t={t} />}>
      <div className="pb-28 md:pb-0">
        <NotificationToast items={r.notifications ?? []} t={t} />
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        {r.demo && <p role="note" className="mt-2 text-xs text-foreground/70">{t("b.preview.note")}</p>}

        {cancelled && <p role="status" className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm">{t("b.h.cancelled")}</p>}
        {!cancelled && r.state === "paused" && <p role="status" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("b.paused")}</p>}
        {!cancelled && r.state === "flagged" && <p role="status" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("b.hold")}</p>}

        {/* 1. The request */}
        <section aria-label={t("b.request")} className="mt-5 rounded-3xl border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground/70">{t("b.request")}</h2>
          <p className="mt-1 text-base font-semibold">{t(`cat.${r.category}`)}</p>
          <p className="mt-1 text-sm leading-snug">{r.problem}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-foreground/70">{t("b.where")}</dt><dd>{r.sector}</dd>
            <dt className="text-foreground/70">{t("b.when")}</dt><dd>{slotText(r.time_window, t)}</dd>
            {r.notes && (<><dt className="text-foreground/70">{t("b.notes")}</dt><dd>{r.notes}</dd></>)}
          </dl>
        </section>

        {/* 2. Progress */}
        {!cancelled && (
          <section aria-label={t("tr.progress")} className="mt-4 rounded-3xl border bg-card p-5">
            <Tracker state={state} t={t} />
            {statusLine && (
              <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" /> {statusLine}
              </p>
            )}
            <label className="mt-4 flex items-center justify-between gap-3 text-xs">
              <span><span className="font-medium">{t("tl.hood")}</span><span className="block text-foreground/70">{t("tl.hood.sub")}</span></span>
              <Switch checked={hood} onCheckedChange={setHood} />
            </label>
            {hood && hoodKey && (
              <div className="mt-2 space-y-1.5 border-t pt-2 text-xs text-foreground/80">
                {DICT_HAS(t, `hood.${hoodKey}.fo`) && <p><b className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] uppercase text-background">AI</b> {t(`hood.${hoodKey}.fo`)}</p>}
                {DICT_HAS(t, `hood.${hoodKey}.hogaya`) && <p><b className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] uppercase text-accent-foreground">Hogaya</b> {t(`hood.${hoodKey}.hogaya`)}</p>}
              </div>
            )}
          </section>
        )}

        {/* 3. Options and the recommendation */}
        {showOptions && (
          <section aria-label={t("b.options.title")} className="mt-4">
            <h2 className="mb-2 text-base font-semibold">{t("b.options.title")}</h2>
            <OptionsTable options={options} reason={recommendationReason(options, t)} t={t} />
            <p className="mt-2 text-center text-xs text-foreground/75">✓ {t("conf")}</p>
            <div className="mt-3 text-center">
              {r.customer_choice ? (
                <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                  {t("sl.chosen", { name: (data.providers.find((x) => x.id === r.customer_choice!.provider_id)?.name ?? "").split(" ")[0] })}
                </p>
              ) : r.screen_confirm_open ? (
                !showPick ? (
                  <button type="button" onClick={() => setShowPick(true)} className="text-sm text-primary underline underline-offset-4">{t("sl.screen.link")}</button>
                ) : (
                  <div className="rounded-2xl border bg-card p-4 text-left">
                    <p className="text-sm font-medium">{t("sl.screen.pick")}</p>
                    <div className="mt-3 space-y-2">
                      {options.map((o, i) => (
                        <Button key={o.providerId} onClick={() => choose(o.providerId)} disabled={busy !== null} variant={i === 0 ? "default" : "outline"} className="h-11 w-full rounded-2xl">
                          {busy === o.providerId ? <Loader2 className="size-4 animate-spin" /> : `${t("b.choose")}: ${o.name}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <p className="text-sm leading-snug text-foreground/85">{t("sl.screen.wait")}</p>
              )}
            </div>
          </section>
        )}

        {/* 4. Booked: provider, time, service code */}
        {b && provider && !cancelled && (
          <section aria-label={t("tr.booked")} className="mt-4 space-y-4">
            {b.backup_activation && (
              <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
                {t("bk.backup", { from: b.backup_activation.from_name.split(" ")[0], to: b.backup_activation.to_name.split(" ")[0] })}
              </p>
            )}
            <div className="rounded-3xl border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{provider.name}</h2>
                  <p className="text-xs text-foreground/70">{t(`cat.${provider.category}`)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {provider.demo ? <DemoBadge label={t("demo")} /> : provider.verified ? <><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">{t("b.verified")}</span><span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">{t("b.consent")}</span></> : null}
                </div>
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <p className="flex flex-wrap items-center gap-2"><CalendarClock className="size-4 text-primary" /> {b.slot} {b.slot_exact === false && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{t("row.exact.no")}</span>}</p>
                {b.visit_charge && <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> {t("bk.visit", { v: b.visit_charge })}</p>}
                {confirmed && (
                  <div className="rounded-2xl bg-muted p-3">
                    <p className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {r.address}, {r.sector}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/75"><Lock className="size-3" /> {t("bk.shared")}</p>
                  </div>
                )}
              </div>
              {/* How the customer confirmed comes from the customer's own choice, never from the provider call. */}
              {r.customer_choice && <p className="mt-3 text-xs text-foreground/75">{r.customer_choice.via === "fo_call" ? t("bk.via_call") : t("bk.via_screen")}</p>}
            </div>

            {/* The Pro says they have arrived: the customer must confirm before any code exists. */}
            {b.pro_arrived_at && !b.arrival_verified_at && (
              <div role="status" className="rounded-3xl border-2 border-primary bg-accent/50 p-5">
                <p className="text-base font-semibold">{t("b.pro_arrived.title", { name: first })}</p>
                <p className="mt-1 text-sm">{t("b.pro_arrived.q", { name: first })}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={async () => { setBusy("arr"); await post("confirm-arrival", { arrived: true }); setBusy(null); }} disabled={busy !== null} className="h-11 rounded-xl">{t("b.pro_arrived.yes")}</Button>
                  <Button onClick={async () => { setBusy("arr"); await post("confirm-arrival", { arrived: false }); setBusy(null); }} disabled={busy !== null} variant="outline" className="h-11 rounded-xl">{t("b.pro_arrived.no")}</Button>
                </div>
              </div>
            )}

            {/* The completion code appears only after the customer confirmed the arrival. */}
            {b.arrival_verified_at && b.arrival_code && !b.job_done_at && (
              <div className="rounded-3xl bg-primary p-6 text-center text-primary-foreground">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-90">{t("bk.code")}</p>
                <p aria-label={`${t("bk.code")} ${b.arrival_code.split("").join(" ")}`} className="mt-2 pl-[0.25em] font-mono text-5xl font-bold tracking-[0.2em]">{b.arrival_code}</p>
                <p className="mt-3 text-sm opacity-95">{t("bk.codehelp2", { name: first })}</p>
              </div>
            )}

            {b.outcome === "completed" && <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-900">{t("b.done.final")}</p>}

            {/* 5. Reconfirmed */}
            {b.reconfirmed_at ? (
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCheck className="size-4" /> {t("b.reconfirmed", { name: first })}</p>
            ) : confirmed && !b.arrival_verified_at && !b.job_done_at ? (
              <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-foreground/85">{t("b.reconfirm_due", { name: first })}</p>
            ) : null}

            {/* 6. Pro has arrived */}
            {b.arrival_verified_at && (
              <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-900"><Check className="size-5" /> {t("arrival.ok")}</p>
            )}

            {/* 7. Final bill */}
            {b.bill && (
              <div className="rounded-3xl border bg-card p-5">
                <h2 className="text-base font-semibold">{t("b.bill.title")}</h2>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt>{t("b.bill.visit")}</dt><dd>{inr(b.bill.visit_fee)}</dd></div>
                  <div className="flex justify-between"><dt>{t("b.bill.labour")}</dt><dd>{inr(b.bill.labour)}</dd></div>
                  <div className="flex justify-between"><dt>{t("b.bill.parts")}</dt><dd>{inr(b.bill.parts)}</dd></div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold"><dt>{t("b.bill.total")}</dt><dd>{inr(b.bill.total)}</dd></div>
                </dl>
                {b.bill.note && <p className="mt-2 text-xs text-foreground/80">{b.bill.note}</p>}
                <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground/85">{t("b.bill.note")}</p>
              </div>
            )}

            {/* 8. Rating */}
            {b.job_done_at && (
              <div className="rounded-3xl border bg-card p-5">
                {b.rating ? (
                  <p role="status" className="text-sm font-medium">{"★".repeat(b.rating.stars)}{"☆".repeat(5 - b.rating.stars)} · {t("b.rate.thanks")}</p>
                ) : (
                  <>
                    <h2 className="text-base font-semibold">{t("b.rate.title")}</h2>
                    <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t("b.rate.title")}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n}`} onClick={() => setStars(n)} className="p-1">
                          <Star className={`size-8 ${n <= stars ? "fill-primary text-primary" : "text-foreground/70"}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={t("b.rate.ph")} rows={2} className="mt-2 text-base" />
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {err && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>}
      </div>

      {/* Sticky main button on phones */}
      {(canFinish || (needsRating && b)) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-5 py-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto max-w-[520px]">
            {canFinish ? (
              <Button onClick={async () => { setBusy("done"); await post("job-done"); setBusy(null); }} disabled={busy !== null} className="h-12 w-full rounded-2xl text-base">
                {busy === "done" ? <Loader2 className="size-4 animate-spin" /> : t("b.done.btn")}
              </Button>
            ) : (
              <Button onClick={async () => { setBusy("rate"); await post("rating", { stars, feedback }); setBusy(null); }} disabled={busy !== null || stars === 0} className="h-12 w-full rounded-2xl text-base">
                {busy === "rate" ? <Loader2 className="size-4 animate-spin" /> : t("b.rate.send")}
              </Button>
            )}
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

/** A translation key exists if t() does not just echo it back. */
function DICT_HAS(t: (k: string) => string, key: string) {
  return t(key) !== key;
}
