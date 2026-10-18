"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutGrid, Loader2, PhoneCall, ShieldCheck, Sparkles, UserCheck, X } from "lucide-react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { CATEGORY_ICONS as ICONS } from "@/lib/category-icons";
import { suggestCategory } from "@/lib/suggest-category";
import { CustomerShell, StateBox } from "@/components/brand";
import { useSession, type SessionUser } from "@/components/session";
import Link from "next/link";
import { useT } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


const TOP: Category[] = ["electrician", "plumber", "ac", "pump", "washing_machine", "ro", "fridge"];

// The value is what Fo and the operator see (English); the label is translated.
const WINDOWS = [
  { value: "Now (1–2 hours)", key: "w.now" },
  { value: "Today 5–8 PM", key: "w.evening" },
  { value: "Tomorrow morning", key: "w.morning" },
];

function BookForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { t } = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picked, setPicked] = useState<Category | null>(null); // chosen by tapping a tile
  const [f, setF] = useState({ problem: "", sector: "", address: "", time_window: WINDOWS[1].value, notes: "", name: user.name, phone: user.phone });
  const [consent, setConsent] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

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

  function next() {
    setError("");
    if (step === 1) {
      if (!f.problem.trim()) return setError(t("s1.need"));
      if (!category) return setError(t("e.category"));
      return setStep(2);
    }
    if (step === 2) {
      if (!f.sector.trim() || !f.address.trim()) return setError(t("s2.need"));
      return setStep(3);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 3) return next();
    setError("");
    if (!f.name.trim() || !f.phone.trim()) return setError(t("s3.need"));
    if (!consent) return setError(t("e.consent"));
    if (!category) return setError(t("e.category"));
    setBusy(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, category, consent }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "x");
      router.push(`/b/${body.id}`);
    } catch {
      setError(t("err.generic"));
      setBusy(false);
    }
  }

  const chips = [
    { Icon: UserCheck, key: "trust.verified" },
    { Icon: PhoneCall, key: "trust.calls" },
    { Icon: ShieldCheck, key: "trust.backup" },
  ];

  return (
    <CustomerShell>
      <form onSubmit={submit} noValidate className="pb-24 md:pb-0">
        {/* Progress */}
        <div className="mb-3" aria-label={t("s.step", { n: step })}>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <p className="mt-1.5 text-xs font-medium text-foreground/70">{t("s.step", { n: step })}</p>
        </div>

        {step === 1 && (
          <section>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">
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

            <Label htmlFor="problem" className="mt-4 block text-base font-semibold">{t("f.problem")}</Label>
            <Textarea
              id="problem"
              rows={3}
              value={f.problem}
              onChange={set("problem")}
              placeholder={t("f.problem.ph")}
              className="mt-1.5 min-h-[88px] resize-none text-base"
            />
            <p aria-live="polite" className="mt-1.5 min-h-5 text-sm font-medium text-primary">
              {category && f.problem.trim() && t("s1.suggest", { cat: t(`cat.${category}`) })}
            </p>

            <p className="mb-1.5 mt-1 text-xs font-medium text-foreground/70">{t("s1.pick")}</p>
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
                    className={`flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border bg-card px-1 text-center transition ${on ? "border-primary bg-accent ring-2 ring-primary/30" : "hover:border-primary/50"}`}
                  >
                    <Icon className={`size-5 ${on ? "text-primary" : "text-foreground/70"}`} />
                    <span className="text-[11px] font-medium leading-tight">{t(`cat.${key}.short`)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSheet(true)}
                className="flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed bg-transparent px-1 text-center hover:border-primary/50"
              >
                <LayoutGrid className="size-5 text-foreground/70" />
                <span className="text-[11px] font-medium leading-tight">{t("s1.all")}</span>
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">{t("s2.title")}</h1>
            <div className="space-y-1.5">
              <Label htmlFor="sector">{t("f.sector")}</Label>
              <Input id="sector" value={f.sector} onChange={set("sector")} placeholder={t("f.sector.ph")} className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">{t("f.address")}</Label>
              <Input id="address" value={f.address} onChange={set("address")} placeholder={t("f.address.ph")} className="h-11 text-base" />
              <p className="flex items-center gap-1.5 pt-0.5 text-sm text-foreground/80"><ShieldCheck className="size-3.5" /> {t("f.privacy")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("f.notes")}</Label>
              <Input id="notes" value={f.notes} onChange={set("notes")} placeholder={t("f.notes.ph")} className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("f.when")}</Label>
              <div className="flex flex-wrap gap-2">
                {WINDOWS.map((w) => (
                  <button
                    type="button"
                    key={w.value}
                    onClick={() => setF((p) => ({ ...p, time_window: w.value }))}
                    aria-pressed={f.time_window === w.value}
                    className={`rounded-full border px-3.5 py-2 text-sm transition ${f.time_window === w.value ? "border-primary bg-accent font-medium text-accent-foreground" : "bg-card hover:border-primary/50"}`}
                  >
                    {t(w.key)}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">{t("s3.title")}</h1>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("f.name")}</Label>
              <Input id="name" value={f.name} onChange={set("name")} placeholder={t("f.name.ph")} autoComplete="name" className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("f.phone")}</Label>
              <Input id="phone" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} placeholder="98xxxxxxxx" className="h-11 text-base" />
            </div>
            <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-[15px] leading-snug text-foreground">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>{t("f.consent")}</span>
            </label>
          </section>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}

        {/* Sticky on phones, inline on desktop */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-5 py-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-[520px] gap-3">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => { setError(""); setStep((s) => (s - 1) as 1 | 2); }} className="h-12 rounded-2xl px-4" aria-label={t("nav.back")}>
                <ArrowLeft className="size-4" /> <span className="ml-1">{t("nav.back")}</span>
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={next} className="h-12 flex-1 rounded-2xl text-base">{t("nav.next")}</Button>
            ) : (
              <Button type="submit" disabled={busy} className="h-12 flex-1 rounded-2xl text-base">
                {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> {t("f.busy")}</> : t("f.submit")}
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
              <button ref={closeRef} type="button" onClick={() => setSheet(false)} aria-label={t("s1.close")} className="grid size-9 place-items-center rounded-full border bg-card">
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
                  </button>
                );
              })}
              <div aria-disabled="true" className="flex flex-col rounded-2xl border border-dashed p-3.5 text-left">
                <Sparkles className="size-5 text-foreground/60" />
                <span className="mt-2 text-sm font-semibold leading-tight">{t("cat.soon")}</span>
                <span className="mt-0.5 text-xs leading-snug text-foreground/75">{t("cat.soon.hint")}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

/** Booking needs a (demo) customer login, so every booking belongs to an account. */
export default function BookPage() {
  const { loading, user } = useSession();
  const { t } = useT();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/book");
  }, [loading, user, router]);
  if (loading || !user) return <CustomerShell><StateBox title={t("loading.title")} /></CustomerShell>;
  if (user.role !== "customer" && user.role !== "operator") {
    return (
      <CustomerShell>
        <StateBox title={t("login.role.customer")} body={t("login.sub")} />
        <Link href="/login?next=/book" className="mt-4 block text-center text-sm text-primary underline underline-offset-4">{t("nav.login")}</Link>
      </CustomerShell>
    );
  }
  return <BookForm user={user} />;
}
