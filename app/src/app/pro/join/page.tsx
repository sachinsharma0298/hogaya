"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { CustomerShell } from "@/components/brand";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category } from "@/lib/categories";
import { LegalLinks } from "@/components/legal-links";
import { CallLangPicker, defaultCallLang } from "@/components/call-lang-picker";
import type { CallLang } from "@/lib/call-scripts/hogaya-context";
import { useT } from "@/lib/lang";
import { toE164 } from "@/lib/phone";

const STEPS = ["details", "services", "consent"] as const;

/** Pros apply here, in three short steps. Nothing happens on the phone until Hogaya approves the application. */
export default function ProJoin() {
  const { t, lang } = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", area: "", visit_charge: "" });
  const [cats, setCats] = useState<Category[]>([]);
  const [pickedLang, setCallLang] = useState<CallLang | null>(null);
  const callLang = pickedLang ?? defaultCallLang(lang);
  const [consent, setConsent] = useState(false);
  const [seen, setSeen] = useState<Record<string, boolean>>({}); // fields the person has left (or tried to pass): only then do we show a hint
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (c: Category) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const leave = (k: string) => () => setSeen((p) => ({ ...p, [k]: true }));

  const ok = {
    name: f.name.trim().length >= 2,
    email: /^\S+@\S+\.\S+$/.test(f.email.trim()),
    phone: toE164(f.phone) !== null,
    password: f.password.length >= 8 && f.password.length <= 72,
    cats: cats.length > 0,
    area: f.area.trim().length > 0,
    visit: Number(f.visit_charge.replace(/[^\d.]/g, "")) > 0,
  };
  const valid = { 1: ok.name && ok.email && ok.phone && ok.password, 2: ok.cats && ok.area && ok.visit, 3: consent } as const;

  useEffect(() => { if (step > 1) headRef.current?.focus(); }, [step]);

  const msg = (show: boolean, good: boolean, key: string) => (show && !good ? <p className="mt-1 text-sm font-medium text-destructive">{t(key)}</p> : null);
  const bad = (k: string, good: boolean) => Boolean(seen[k] && !good);

  function next() {
    if (!valid[step]) return setSeen((p) => ({ ...p, [`s${step}`]: true }));
    setStep((step + 1) as 2 | 3);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) return next();
    if (!valid[3]) return setSeen((p) => ({ ...p, s3: true }));
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pro/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats, consent, call_lang: callLang }) });
      await res.json().catch(() => ({}));
      if (!res.ok) setError(t(res.status === 400 ? "join.err.fields" : res.status === 409 ? "join.err.exists" : res.status === 429 ? "join.err.busy" : "join.err.generic"));
      else setDone(true);
    } catch {
      setError(t("join.err.generic"));
    }
    setBusy(false);
  }

  const row = "text-foreground/75";
  return (
    <CustomerShell>
      <h1 className="text-2xl font-bold tracking-tight">{t("join.title")}</h1>
      <p className="mt-1 text-sm text-foreground/85">{t("join.sub")}</p>
      {done ? (
        <div role="status" className="mt-4 space-y-3 rounded-2xl border bg-card p-4 text-sm">
          <p className="font-semibold">{t("join.done.msg")}</p>
          <Link href="/login?next=/pro" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">{t("join.done.signin")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4">
          <nav aria-label={t("join.steps")} className="mb-4">
            <ol className="grid grid-cols-3 gap-1.5">
              {STEPS.map((k, i) => {
                const n = i + 1;
                const here = n === step;
                return (
                  <li key={k} aria-current={here ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
                    <span className={`grid size-8 place-items-center rounded-full text-sm font-bold ${here ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : n < step ? "bg-accent text-accent-foreground" : "bg-muted text-foreground/70"}`}>{n < step ? <Check className="size-4" /> : n}</span>
                    <span className={`text-[11px] leading-tight ${here ? "font-semibold" : "text-foreground/75"}`}>{t(`join.step.${k}`)}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs font-medium text-foreground/75" aria-live="polite">
              <span className="sr-only">{t("join.stepof", { n: step })}. </span>
              <span aria-hidden="true">{t("join.stepof", { n: step })} · {t(`join.step.${STEPS[step - 1]}`)}</span>
            </p>
          </nav>
          <h2 ref={headRef} tabIndex={-1} className="mb-3 text-xl font-bold tracking-tight outline-none">{t(`join.step.${STEPS[step - 1]}`)}</h2>

          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="j-name">{t("join.name")}</Label><Input id="j-name" autoComplete="name" value={f.name} onChange={set("name")} onBlur={leave("name")} aria-invalid={bad("name", ok.name)} className="h-11 text-base" />{msg(Boolean(seen.name || seen.s1), ok.name, "join.v.name")}</div>
              <div className="space-y-1.5"><Label htmlFor="j-email">{t("join.email")}</Label><Input id="j-email" type="email" autoComplete="email" value={f.email} onChange={set("email")} onBlur={leave("email")} aria-invalid={bad("email", ok.email)} className="h-11 text-base" />{msg(Boolean(seen.email || seen.s1), ok.email, "join.v.email")}</div>
              <div className="space-y-1.5"><Label htmlFor="j-phone">{t("join.phone")}</Label><PhoneField id="j-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} className="h-11 text-base" />{msg(Boolean(seen.s1), ok.phone, "join.v.phone")}</div>
              <div className="space-y-1.5"><Label htmlFor="j-pw">{t("join.pw")}</Label><Input id="j-pw" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} onBlur={leave("password")} aria-invalid={bad("password", ok.password)} className="h-11 text-base" />{msg(Boolean(seen.password || seen.s1), ok.password, "join.v.password")}</div>
              <CallLangPicker value={callLang} onChange={setCallLang} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{t("join.work")}</legend>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={`min-h-11 rounded-full border px-4 text-sm ${cats.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{t(`cat.${c}`)}</button>
                  ))}
                </div>
                {msg(Boolean(seen.s2), ok.cats, "join.v.cats")}
              </fieldset>
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="j-area">{t("join.area")}</Label><Input id="j-area" value={f.area} onChange={set("area")} onBlur={leave("area")} aria-invalid={bad("area", ok.area)} placeholder={t("join.area.ph")} className="h-11 text-base" />{msg(Boolean(seen.area || seen.s2), ok.area, "join.v.area")}</div>
                <div className="space-y-1.5"><Label htmlFor="j-visit">{t("join.visit")}</Label><Input id="j-visit" inputMode="numeric" value={f.visit_charge} onChange={set("visit_charge")} onBlur={leave("visit")} aria-invalid={bad("visit", ok.visit)} className="h-11 text-base" />{msg(Boolean(seen.visit || seen.s2), ok.visit, "join.v.visit")}</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-card p-4 text-sm">
                <p className="text-xs font-semibold text-foreground/75">{t("join.summary")}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  <dt className={row}>{t("join.name")}</dt><dd className="break-words">{f.name}</dd>
                  <dt className={row}>{t("join.email")}</dt><dd className="break-all">{f.email}</dd>
                  <dt className={row}>{t("join.phone")}</dt><dd>{f.phone}</dd>
                  <dt className={row}>{t("calllang.label")}</dt><dd>{callLang === "english" ? "English" : "हिंदी"}</dd>
                  <dt className={row}>{t("join.work")}</dt><dd>{cats.map((c) => t(`cat.${c}`)).join(", ")}</dd>
                  <dt className={row}>{t("join.area")}</dt><dd className="break-words">{f.area}</dd>
                  <dt className={row}>{t("join.visit")}</dt><dd>₹{f.visit_charge.replace(/[^\d.]/g, "")}</dd>
                </dl>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
                <span>{t("join.consent")}</span>
              </label>
              {msg(Boolean(seen.s3), consent, "join.v.consent")}
              <LegalLinks />
            </div>
          )}

          {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="mt-5 flex gap-3">
            {step > 1 && <Button type="button" variant="outline" onClick={() => { setError(""); setStep((s) => (s - 1) as 1 | 2); }} className="h-12 rounded-2xl px-4" aria-label={t("nav.back")}><ArrowLeft className="size-4" /> <span className="ml-1">{t("nav.back")}</span></Button>}
            {step < 3
              ? <Button type="button" onClick={next} disabled={!valid[step]} className="h-12 flex-1 rounded-2xl text-base">{t("nav.next")}</Button>
              : <Button type="submit" disabled={busy || !valid[3]} className="h-12 flex-1 rounded-2xl text-base">{busy ? <Loader2 className="size-4 animate-spin" aria-label={t("f.busy")} /> : t("join.submit")}</Button>}
          </div>
          <Link href="/login?next=/pro" className="mt-3 flex min-h-11 items-center justify-center text-center text-sm font-medium text-primary underline underline-offset-4">{t("join.signin")}</Link>
        </form>
      )}
    </CustomerShell>
  );
}
