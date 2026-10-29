"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { CustomerShell } from "@/components/brand";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category } from "@/lib/categories";
import { CallLangPicker, defaultCallLang } from "@/components/call-lang-picker";
import type { CallLang } from "@/lib/call-scripts/hogaya-context";
import { useT } from "@/lib/lang";

/** Pros apply here. Nothing happens on the phone until Hogaya approves the application. */
export default function ProJoin() {
  const { t, lang } = useT();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", area: "", visit_charge: "" });
  const [cats, setCats] = useState<Category[]>([]);
  const [pickedLang, setCallLang] = useState<CallLang | null>(null);
  const callLang = pickedLang ?? defaultCallLang(lang);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (c: Category) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/pro/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats, consent, call_lang: callLang }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(t(res.status === 400 ? "join.err.fields" : res.status === 409 ? "join.err.exists" : res.status === 429 ? "join.err.busy" : "join.err.generic"));
    setDone(true);
  }

  return (
    <CustomerShell>
      <h1 className="text-2xl font-bold tracking-tight">{t("join.title")}</h1>
      <p className="mt-1 text-sm text-foreground/85">{t("join.sub")}</p>
      {done ? (
        <div role="status" className="mt-4 space-y-3 rounded-2xl border bg-card p-4 text-sm">
          <p className="font-semibold">{t("join.done.title")}</p>
          <p>{t("join.done.body")}</p>
          <Link href="/login?next=/pro" className="block font-medium text-primary underline underline-offset-4">{t("join.done.signin")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1.5"><Label htmlFor="j-name">{t("join.name")}</Label><Input id="j-name" value={f.name} onChange={set("name")} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="j-email">{t("join.email")}</Label><Input id="j-email" type="email" autoComplete="email" value={f.email} onChange={set("email")} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="j-phone">{t("join.phone")}</Label><PhoneField id="j-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="j-pw">{t("join.pw")}</Label><Input id="j-pw" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} className="h-11 text-base" /></div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t("join.work")}</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1.5 text-xs ${cats.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{t(`cat.${c}`)}</button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="j-area">{t("join.area")}</Label><Input id="j-area" value={f.area} onChange={set("area")} placeholder={t("join.area.ph")} className="h-11 text-base" /></div>
            <div className="space-y-1.5"><Label htmlFor="j-visit">{t("join.visit")}</Label><Input id="j-visit" inputMode="numeric" value={f.visit_charge} onChange={set("visit_charge")} className="h-11 text-base" /></div>
          </div>
          <CallLangPicker value={callLang} onChange={setCallLang} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4" />
            <span>{t("join.consent")}</span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base">{busy ? <Loader2 className="size-4 animate-spin" /> : t("join.submit")}</Button>
          <Link href="/login?next=/pro" className="block text-center text-sm font-medium text-primary underline underline-offset-4">{t("join.signin")}</Link>
        </form>
      )}
    </CustomerShell>
  );
}
