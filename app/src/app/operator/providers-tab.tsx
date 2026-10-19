"use client";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category } from "@/lib/categories";
import type { Provider } from "@/lib/types";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { catLabel } from "./booking-list";

const today = () => new Date().toISOString().slice(0, 10);

/** Pros you onboard yourself (no KYC): name, phone, email they sign in with, categories, area, visit charge, and their recorded AI-call consent. */
function OnboardForm() {
  const [f, setF] = useState({ name: "", phone: "", email: "", area: "", visit_charge: "", consent_date: today() });
  const [cats, setCats] = useState<Category[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (c: Category) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats, consent }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: b.error ?? "Could not add this Pro." });
    setMsg({ ok: true, text: `${b.provider.name} is onboarded. They sign in with ${f.email}, and their number is on the approved list for live calls.` });
    setF({ name: "", phone: "", email: "", area: "", visit_charge: "", consent_date: today() });
    setCats([]);
    setConsent(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3 self-start rounded-3xl border bg-card p-5">
      <h2 className="text-base font-semibold">Onboard a Pro</h2>
      <p className="text-xs text-foreground/80">No KYC. You record who they are, how to reach them and that they agreed to AI calls.</p>
      <div className="space-y-1.5"><Label htmlFor="pr-name">Name</Label><Input id="pr-name" value={f.name} onChange={set("name")} /></div>
      <div className="space-y-1.5"><Label htmlFor="pr-phone">Phone</Label><PhoneField id="pr-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} /></div>
      <div className="space-y-1.5">
        <Label htmlFor="pr-email">Email they sign in with</Label>
        <Input id="pr-email" type="email" value={f.email} onChange={set("email")} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Categories</legend>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1 text-xs ${cats.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{catLabel(c)}</button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="pr-area">Area</Label><Input id="pr-area" value={f.area} onChange={set("area")} placeholder="Noida, Sector 62" /></div>
        <div className="space-y-1.5"><Label htmlFor="pr-visit">Visit charge (₹)</Label><Input id="pr-visit" inputMode="numeric" value={f.visit_charge} onChange={set("visit_charge")} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="pr-date">Consent given on</Label><Input id="pr-date" type="date" value={f.consent_date} onChange={set("consent_date")} max={today()} /></div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4" />
        <span>This Pro agreed to receive AI calls from Hogaya.</span>
      </label>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
      <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">{busy ? <Loader2 className="size-4 animate-spin" /> : "Onboard this Pro"}</Button>
    </form>
  );
}

/** Pros you onboarded, with their reliability. */
export function ProvidersTab({ providers }: { providers: Provider[] }) {
  const [cat, setCat] = useState("all");
  const shown = providers.filter((p) => !p.demo && (cat === "all" || (p.categories ?? [p.category]).includes(cat as never))).sort((a, b) => b.reliability - a.reliability);
  async function toggleCalls(p: Provider) {
    const next = !p.opt_out;
    if (!window.confirm(next ? `Stop AI calls to ${p.name}? They will not be matched until you turn them back on.` : `Allow AI calls to ${p.name} again?`)) return;
    await fetch(`/api/providers/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opt_out: next }) });
  }
  async function remove(p: Provider) {
    if (!window.confirm(`Delete ${p.name}?\n\nThis removes the Pro, their approval for live calls and their login. It cannot be undone.`)) return;
    const res = await fetch(`/api/providers/${p.id}`, { method: "DELETE" });
    if (!res.ok) window.alert((await res.json().catch(() => ({}))).error ?? "Could not delete.");
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <OnboardForm />
      <section aria-label="Pros" className="rounded-3xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Pros and reliability</h2>
          <select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-xl border bg-background px-2 text-sm">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="mt-6 text-center text-sm text-foreground/70">No Pros yet. Onboard your first one on the left.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {shown.map((p) => (
              <li key={p.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold"><Link href={`/operator/people/${encodeURIComponent(p.id)}`} className="underline-offset-4 hover:underline">{p.name}</Link><StatusBadge status={p.review_status ?? "approved"} /></span>
                  <span className="flex items-center gap-1 text-sm font-bold"><Star className="size-3.5 fill-primary text-primary" />{p.reliability}</span>
                </div>
                <p className="mt-1 text-xs text-foreground/70">{(p.categories ?? [p.category]).map(catLabel).join(", ")} · {p.area} · {p.visit_charge}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">Onboarded by Hogaya{p.onboarded_at ? ` · ${p.onboarded_at.slice(0, 10)}` : ""}</span>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">Consent to AI calls recorded · {p.consent_date}</span>
                  {p.opt_out && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">AI calls paused</span>}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${p.reliability}%` }} /></div>
                <p className="mt-2 text-xs text-foreground/70">{p.on_time_pct}% on time · {p.jobs} jobs · {p.no_shows ?? 0} no-shows · •••• {p.phone.slice(-4)} · {p.email}</p>
                <button type="button" onClick={() => toggleCalls(p)} className="mt-2 rounded-lg border px-2 py-1 text-[11px] font-medium hover:bg-muted">{p.opt_out ? "Allow AI calls again" : "Pause AI calls"}</button>
                <button type="button" onClick={() => remove(p)} className="ml-2 mt-2 rounded-lg border border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
