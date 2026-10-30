"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, LayoutGrid, Loader2, PhoneCall, ShieldCheck, Sparkles, UserCheck, X } from "lucide-react";
import { CATEGORIES, isCategory, type Category } from "@/lib/categories";
import { customSlot, presetSlots, slotText, todayInput } from "@/lib/slots";
import { CATEGORY_ICONS as ICONS } from "@/lib/category-icons";
import { suggestCategory } from "@/lib/suggest-category";
import { CustomerShell, StateBox } from "@/components/brand";
import { useSession, type SessionUser } from "@/components/session";
import Link from "next/link";
import { useT } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { LiveBadge, ModeNote } from "@/components/live-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DictationHint, useFieldLang } from "@/components/dictation-hint";
import { QuickFill, type Captured } from "@/components/quick-fill";
import type { ParsedBooking } from "@/lib/parse-types";


// Which quick-filled fields live on which step (they are highlighted briefly when that step is shown).
const STEP_FIELDS: Record<number, string[]> = { 1: ["category", "problem"], 2: ["sector", "address"], 3: ["time"] };
const FLASH = "ring-2 ring-primary/60 bg-accent/50";

const TOP: Category[] = ["electrician", "plumber", "ac", "pump", "washing_machine", "ro", "fridge"];

function BookForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { t } = useT();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [seen, setSeen] = useState<Record<string, boolean>>({}); // fields the person has left: only then do we show a hint
  const headRef = useRef<HTMLHeadingElement>(null);
  const fromLink = useSearchParams().get("category");
  const [picked, setPicked] = useState<Category | null>(isCategory(fromLink) ? fromLink : null); // chosen by tapping a tile, or by the link from the landing page
  const [slots] = useState(() => presetSlots()); // generated once, from the customer's own clock
  const [slotId, setSlotId] = useState<string>(() => slots[0].id);
  const [custom, setCustom] = useState({ date: "", time: "" });
  const [f, setF] = useState({ problem: "", sector: "", address: "", landmark: "", notes: "", name: user.name, phone: user.phone });
  const [consent, setConsent] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const [aiFilled, setAiFilled] = useState<string[]>([]); // fields the quick-fill suggested
  const [flash, setFlash] = useState<string[]>([]); // highlighted for a moment
  const [qf, setQf] = useState<{ got: Captured; nocat: boolean; past: boolean; timeMissing: boolean } | null>(null);

  const problemLang = useFieldLang(f.problem);
  const addressLang = useFieldLang(f.address);
  const suggested = suggestCategory(f.problem);
  const category = picked ?? suggested; // a tapped tile always wins over the suggestion
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!sheet) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  /** Quick-fill only suggests: it fills the fields and highlights them. It never changes the step and never sends. */
  function applyParsed(p: ParsedBooking) {
    const filled: string[] = [];
    const patch: Partial<typeof f> = {};
    if (p.category) { setPicked(p.category); filled.push("category"); }
    if (p.problem) { patch.problem = p.problem; filled.push("problem"); }
    if (p.area) { patch.sector = p.area; filled.push("sector"); }
    if (p.address) { patch.address = p.address; filled.push("address"); }
    if (p.landmark) { patch.landmark = p.landmark; filled.push("landmark"); }
    if (p.time_window) patch.notes = `Preferred time: ${p.time_window}`; // the exact words about the time stay in the notes
    let past = false;
    if (p.date && p.time) {
      const w = customSlot(p.date, p.time);
      if ("value" in w) { setCustom({ date: p.date, time: p.time }); setSlotId("custom"); filled.push("time"); }
      else past = w.error === "past";
    }
    setF((prev) => ({ ...prev, ...patch }));
    const timeMissing = !filled.includes("time");
    setAiFilled(filled);
    setQf({ got: { problem: Boolean(p.problem), address: Boolean(p.address), landmark: Boolean(p.landmark), area: Boolean(p.area), time: !timeMissing }, nocat: !p.category, past, timeMissing });
    setFlash(STEP_FIELDS[1].filter((k) => filled.includes(k)));
  }

  useEffect(() => { // briefly highlight what was quick-filled on the step now shown
    const here = STEP_FIELDS[step]?.filter((k) => aiFilled.includes(k)) ?? [];
    if (!here.length) return;
    const on = setTimeout(() => setFlash(here), 0);
    const off = setTimeout(() => setFlash([]), 2500);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [step, aiFilled]);
  /** "Add this": go to the step that has the field and focus it. */
  function jumpTo(k: "problem" | "address" | "landmark" | "area" | "time") {
    const to = { problem: [1, "problem"], address: [2, "address"], landmark: [2, "landmark"], area: [2, "sector"], time: [3, ""] } as const;
    const [n, id] = to[k];
    setStep(n);
    setTimeout(() => (id ? document.getElementById(id) : document.querySelector<HTMLElement>("[role=group] button"))?.focus(), 80);
  }
  const lit = (k: string) => (flash.includes(k) ? FLASH : "");

  const seeIt = (k: string) => () => setSeen((p) => ({ ...p, [k]: true }));
  const slotOk = !("error" in timeWindow());
  const valid = {
    1: Boolean(f.problem.trim() && category),
    2: Boolean(f.sector.trim() && f.address.trim()),
    3: slotOk,
    4: Boolean(f.name.trim() && f.phone.trim() && consent && category && slotOk),
  } as const;

  useEffect(() => { if (step > 1) headRef.current?.focus(); }, [step]); // a screen reader hears the new step's title

  function next() {
    setError("");
    if (!valid[step]) return setSeen((p) => ({ ...p, [`s${step}`]: true }));
    if (step < 4) setStep((step + 1) as 2 | 3 | 4);
  }

  /** The chosen slot as the readable label that goes into the booking's time field (the field the call brief reads). */
  function timeWindow(): { value: string } | { error: "pick" | "custom" | "past" } {
    if (slotId === "custom") return customSlot(custom.date, custom.time);
    const hit = slots.find((x) => x.id === slotId);
    return hit ? { value: hit.value } : { error: "pick" };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 4) return next();
    setError("");
    if (!valid[4] || !category) return setSeen((p) => ({ ...p, s4: true }));
    const w = timeWindow();
    if ("error" in w) return setError(t(`slot.err.${w.error}`));
    setBusy(true);
    try {
      const { landmark, ...rest } = f;
      // The landmark rides along inside the address, so it follows the same privacy rule (shared only on the booking call, after the customer confirms).
      const oneLine = f.address.replace(/\s*\n+\s*/g, ", ").trim();
      const address = landmark.trim() ? `${oneLine} (landmark: ${landmark.trim()})` : oneLine;
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, address, time_window: w.value, category, consent }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "x");
      router.push(`/b/${body.id}`);
    } catch {
      setError(t("bk.err.send"));
      setBusy(false);
    }
  }

  const chips = [
    { Icon: UserCheck, key: "trust.verified" },
    { Icon: PhoneCall, key: "trust.calls" },
    { Icon: ShieldCheck, key: "trust.backup" },
  ];

  const STEPS = ["problem", "location", "time", "review"] as const;
  const hint = (show: boolean, ok: boolean, msg: string, id: string) => (show && !ok ? <p id={id} className="mt-1 text-sm font-medium text-destructive">{msg}</p> : null);
  const bad = (k: string, ok: boolean) => Boolean(seen[k] && !ok);
  const slotLabel = (() => { const w = timeWindow(); return "value" in w ? slotText(w.value, t) : ""; })();
  const h1 = "text-[26px] font-bold leading-tight tracking-tight outline-none";

  return (
    <CustomerShell>
      <form onSubmit={submit} noValidate className="pb-24 md:pb-0">
        {/* Step indicator */}
        <nav aria-label={t("bk.steps")} className="mb-4">
          <ol className="grid grid-cols-4 gap-1.5">
            {STEPS.map((k, i) => {
              const n = i + 1;
              const here = n === step;
              const done = n < step;
              return (
                <li key={k} aria-current={here ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
                  <span className={`grid size-8 place-items-center rounded-full text-sm font-bold ${here ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : done ? "bg-accent text-accent-foreground" : "bg-muted text-foreground/70"}`}>
                    {done ? <Check className="size-4" /> : n}
                  </span>
                  <span className={`text-[11px] leading-tight ${here ? "font-semibold text-foreground" : "text-foreground/75"}`}>{t(`bk.step.${k}`)}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs font-medium text-foreground/75" aria-live="polite">
            <span className="sr-only">{t("bk.stepof", { n: step })}. </span>
            <span aria-hidden="true">{t("bk.stepof", { n: step })} · {t(`bk.step.${STEPS[step - 1]}`)}</span>
          </p>
        </nav>

        {step === 1 && (
          <section>
            <h1 ref={headRef} tabIndex={-1} className={h1}>
              {t("home.title1")} <span className="text-primary">{t("home.title2")}</span>
            </h1>
            <p className="mt-1 text-sm leading-snug text-foreground/85">{t("home.line")}</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {chips.map(({ Icon, key }) => (
                <li key={key} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground/85">
                  <Icon className="size-3 text-primary" /> {t(key)}
                </li>
              ))}
            </ul>

            <QuickFill
              onParsed={applyParsed}
              got={qf?.got ?? null}
              onAdd={jumpTo}
              note={qf && (
                <>
                  {qf.nocat && <p className="mt-1 text-foreground/90">{t("qf.nocat")}</p>}
                  {qf.past && <p className="mt-1 text-foreground/90">{t("qf.past")}</p>}
                </>
              )}
            />

            <Label htmlFor="problem" className="mt-4 block text-base font-semibold">{t("f.problem")}</Label>
            <Textarea
              id="problem"
              lang={problemLang}
              maxLength={1000}
              rows={3}
              value={f.problem}
              onChange={set("problem")}
              onBlur={seeIt("problem")}
              aria-invalid={bad("problem", Boolean(f.problem.trim()))}
              aria-describedby={bad("problem", Boolean(f.problem.trim())) ? "problem-err" : undefined}
              placeholder={t("f.problem.ph")}
              className={`mt-1.5 min-h-[88px] resize-none text-base transition ${lit("problem")}`}
            />
            <DictationHint />
            {hint(Boolean(seen.problem || seen.s1), Boolean(f.problem.trim()), t("bk.err.problem"), "problem-err")}
            <p aria-live="polite" className="mt-1.5 min-h-5 text-sm font-medium text-primary">
              {category && f.problem.trim() && t("s1.suggest", { cat: t(`cat.${category}`) })}
            </p>

            <p className="mb-1.5 mt-1 text-xs font-medium text-foreground/75">{t("s1.pick")}</p>
            <div className="grid grid-cols-4 gap-2">
              {TOP.map((key) => {
                const Icon = ICONS[key];
                const on = category === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setPicked(key)}
                    aria-pressed={on}
                    className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border bg-card px-1 py-1.5 text-center transition ${on ? "border-primary bg-accent ring-2 ring-primary/30" : "hover:border-primary/50"} ${on ? lit("category") : ""}`}
                  >
                    <Icon className={`size-5 ${on ? "text-primary" : "text-foreground/70"}`} />
                    <span className="text-[11px] font-medium leading-tight">{t(`cat.${key}.short`)}</span>
                    <LiveBadge category={key} />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSheet(true)}
                className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed bg-transparent px-1 text-center hover:border-primary/50"
              >
                <LayoutGrid className="size-5 text-foreground/70" />
                <span className="text-[11px] font-medium leading-tight">{t("s1.all")}</span>
              </button>
            </div>
            <p className="mt-2 text-xs leading-snug text-foreground/75">{t("cat.legend")}</p>
            {hint(Boolean(seen.s1), Boolean(category), t("bk.err.category"), "cat-err")}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h1 ref={headRef} tabIndex={-1} className={h1}>{t("bk.step.location")}</h1>
            <div className="space-y-1.5">
              <Label htmlFor="sector">{t("f.sector")}</Label>
              <Input id="sector" value={f.sector} onChange={set("sector")} onBlur={seeIt("sector")} aria-invalid={bad("sector", Boolean(f.sector.trim()))} aria-describedby={bad("sector", Boolean(f.sector.trim())) ? "sector-err" : undefined} placeholder={t("f.sector.ph")} className={`h-11 text-base transition ${lit("sector")}`} />
              {qf && !f.sector.trim() && <p className="text-sm font-medium text-primary">{t("qf.need.area")}</p>}
              {hint(Boolean(seen.sector || seen.s2), Boolean(f.sector.trim()), t("bk.err.location"), "sector-err")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">{t("f.address")}</Label>
              <Textarea id="address" lang={addressLang} rows={2} value={f.address} onChange={set("address")} onBlur={seeIt("address")} aria-invalid={bad("address", Boolean(f.address.trim()))} aria-describedby={bad("address", Boolean(f.address.trim())) ? "address-err" : undefined} placeholder={t("f.address.ph")} autoComplete="street-address" className={`min-h-[72px] resize-none text-base transition ${lit("address")}`} />
              <DictationHint />
              {qf && !f.address.trim() && <p className="text-sm font-medium text-primary">{t("qf.need.address")}</p>}
              {hint(Boolean(seen.address || seen.s2), Boolean(f.address.trim()), t("bk.err.address"), "address-err")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landmark">{t("f.landmark")}</Label>
              <Input id="landmark" value={f.landmark} onChange={set("landmark")} placeholder={t("f.landmark.ph")} className="h-11 text-base" />
              <p className="flex items-start gap-1.5 pt-0.5 text-sm text-foreground/80"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {t("f.privacy")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("f.notes")}</Label>
              <Input id="notes" value={f.notes} onChange={set("notes")} placeholder={t("f.notes.ph")} className="h-11 text-base" />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h1 ref={headRef} tabIndex={-1} className={h1}>{t("bk.time.title")}</h1>
            <div className="space-y-1.5">
              <p id="when-l" className="text-sm font-medium">{t("f.when")}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="when-l">
                {[...slots.map((x) => ({ id: x.id, label: slotText(x.value, t) })), { id: "custom", label: t("slot.custom") }].map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => setSlotId(o.id)}
                    aria-pressed={slotId === o.id}
                    className={`min-h-11 rounded-full border px-4 text-sm transition ${slotId === o.id ? "border-primary bg-accent font-medium text-accent-foreground" : "bg-card hover:border-primary/50"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {slotId === "custom" && (
                <div className={`grid grid-cols-1 gap-3 rounded-xl pt-1 transition min-[400px]:grid-cols-2 ${lit("time")}`}>
                  <div className="space-y-1"><Label htmlFor="slot-date" className="text-xs">{t("slot.date")}</Label><Input id="slot-date" type="date" min={todayInput()} value={custom.date} onChange={(e) => setCustom((p) => ({ ...p, date: e.target.value }))} onBlur={seeIt("slot")} className="h-11 text-base" /></div>
                  <div className="space-y-1"><Label htmlFor="slot-time" className="text-xs">{t("slot.time")}</Label><Input id="slot-time" type="time" value={custom.time} onChange={(e) => setCustom((p) => ({ ...p, time: e.target.value }))} onBlur={seeIt("slot")} className="h-11 text-base" /></div>
                </div>
              )}
              {qf?.timeMissing && slotId !== "custom" && <p className="mt-1 text-sm font-medium text-primary">{t(qf.past ? "qf.past" : "qf.need.time")}</p>}
              {(() => { const w = timeWindow(); return "error" in w && (seen.slot || seen.s3) ? <p className="mt-1 text-sm font-medium text-destructive">{t(`slot.err.${w.error}`)}</p> : null; })()}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h1 ref={headRef} tabIndex={-1} className={h1}>{t("bk.review.title")}</h1>
            <div className="rounded-2xl border bg-card p-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-foreground/75">{t("bk.review.category")}</dt><dd className="flex flex-wrap items-center gap-2 font-semibold">{category ? t(`cat.${category}`) : ""}{category && <LiveBadge category={category} />}</dd>
                <dt className="text-foreground/75">{t("bk.review.problem")}</dt><dd className="whitespace-pre-line break-words">{f.problem}</dd>
                <dt className="text-foreground/75">{t("bk.review.location")}</dt><dd className="break-words">{f.sector}</dd>
                <dt className="text-foreground/75">{t("bk.review.address")}</dt><dd className="break-words">{f.address}{f.landmark.trim() ? ` (${t("f.landmark")}: ${f.landmark.trim()})` : ""}</dd>
                <dt className="text-foreground/75">{t("bk.review.time")}</dt><dd>{slotLabel}</dd>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-foreground/80"><ShieldCheck className="mt-0.5 size-3 shrink-0" /> {t("f.privacy")}</p>
            </div>
            {category && <ModeNote category={category} />}
            <p className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">{t("bk.price")}</p>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("f.name")}</Label>
              <Input id="name" value={f.name} onChange={set("name")} onBlur={seeIt("name")} aria-invalid={bad("name", Boolean(f.name.trim()))} placeholder={t("f.name.ph")} autoComplete="name" className="h-11 text-base" />
              {hint(Boolean(seen.name || seen.s4), Boolean(f.name.trim()), t("bk.err.name"), "name-err")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("f.phone")}</Label>
              <PhoneField id="phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} className="h-11 text-base" />
              {hint(Boolean(seen.s4), Boolean(f.phone.trim()), t("bk.err.phone"), "phone-err")}
            </div>
            <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-[15px] leading-snug text-foreground">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>{t("f.consent")}</span>
            </label>
            {hint(Boolean(seen.s4), consent, t("e.consent"), "consent-err")}
          </section>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}

        {/* Sticky on phones, inline on desktop */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-5 py-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-[520px] gap-3">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => { setError(""); setStep((s) => (s - 1) as 1 | 2 | 3); }} className="h-12 rounded-2xl px-4" aria-label={t("nav.back")}>
                <ArrowLeft className="size-4" /> <span className="ml-1">{t("nav.back")}</span>
              </Button>
            )}
            {step < 4 ? (
              <Button type="button" onClick={next} disabled={!valid[step]} className="h-12 flex-1 rounded-2xl text-base">{t("nav.next")}</Button>
            ) : (
              <Button type="submit" disabled={busy || !valid[4]} className="h-12 flex-1 rounded-2xl text-base">
                {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> {t("f.busy")}</> : t("bk.send")}
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Bottom sheet with all categories */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40" onClick={() => setSheet(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("s1.sheet")}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl bg-background p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("s1.sheet")}</h2>
              <button ref={closeRef} type="button" onClick={() => setSheet(false)} aria-label={t("s1.close")} className="grid size-11 place-items-center rounded-full border bg-card">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((key) => {
                const Icon = ICONS[key];
                const on = category === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => { setPicked(key); setSheet(false); }}
                    aria-pressed={on}
                    className={`flex flex-col rounded-2xl border bg-card p-3.5 text-left transition ${on ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"}`}
                  >
                    <Icon className={`size-5 ${on ? "text-primary" : "text-foreground/70"}`} />
                    <span className="mt-2 text-sm font-semibold leading-tight">{t(`cat.${key}`)}</span>
                    <span className="mt-0.5 text-xs leading-snug text-foreground/75">{t(`cat.${key}.hint`)}</span>
                    <LiveBadge category={key} className="mt-2 self-start" />
                  </button>
                );
              })}
              <div aria-disabled="true" className="flex flex-col rounded-2xl border border-dashed p-3.5 text-left">
                <Sparkles className="size-5 text-foreground/70" />
                <span className="mt-2 text-sm font-semibold leading-tight">{t("cat.soon")}</span>
                <span className="mt-0.5 text-xs leading-snug text-foreground/75">{t("cat.soon.hint")}</span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-snug text-foreground/75">{t("cat.legend")}</p>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

/** Booking needs a customer login, so every booking belongs to an account. After signing in, the person comes back here with the same category selected. */
function BookGate() {
  const { loading, user } = useSession();
  const { t } = useT();
  const router = useRouter();
  const query = useSearchParams().toString();
  const here = `/book${query ? `?${query}` : ""}`;
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [loading, user, router, here]);
  if (loading || !user) return <CustomerShell><StateBox title={t("loading.title")} /></CustomerShell>;
  if (user.role !== "customer" && user.role !== "operator") {
    return (
      <CustomerShell>
        <StateBox title={t("login.role.customer")} body={t("login.sub")} />
        <Link href={`/login?next=${encodeURIComponent(here)}`} className="mt-4 block text-center text-sm text-primary underline underline-offset-4">{t("nav.login")}</Link>
      </CustomerShell>
    );
  }
  return <BookForm user={user} />;
}

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookGate />
    </Suspense>
  );
}
