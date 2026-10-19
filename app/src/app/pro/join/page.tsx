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
import { PRO_JOIN_CONSENT } from "@/lib/consent";
import { catLabel } from "@/app/operator/booking-list";

/** Pros apply here. Nothing happens on the phone until Hogaya approves the application. */
export default function ProJoin() {
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", area: "", visit_charge: "" });
  const [cats, setCats] = useState<Category[]>([]);
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
    const res = await fetch("/api/pro/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats, consent }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(b.error ?? "Could not send your application.");
    setDone(true);
  }

  return (
    <CustomerShell>
      <h1 className="text-2xl font-bold tracking-tight">Join as a Hogaya Pro</h1>
      {done ? (
        <div role="status" className="mt-4 space-y-3 rounded-2xl border bg-card p-4 text-sm">
          <p className="font-semibold">Thank you! Your application is with Hogaya.</p>
          <p>We will review it. Once approved, you can sign in with the email and password you just chose, and you will start receiving job calls.</p>
          <Link href="/login?next=/pro" className="block font-medium text-primary underline underline-offset-4">Go to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1.5"><Label htmlFor="j-name">Name</Label><Input id="j-name" value={f.name} onChange={set("name")} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="j-email">Email</Label><Input id="j-email" type="email" autoComplete="email" value={f.email} onChange={set("email")} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="j-phone">Phone</Label><PhoneField id="j-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="j-pw">Choose a password (8+ characters)</Label><Input id="j-pw" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} className="h-11 text-base" /></div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">What work do you do?</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1.5 text-xs ${cats.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{catLabel(c)}</button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="j-area">Area</Label><Input id="j-area" value={f.area} onChange={set("area")} placeholder="Noida, Sector 62" className="h-11 text-base" /></div>
            <div className="space-y-1.5"><Label htmlFor="j-visit">Visit charge (₹)</Label><Input id="j-visit" inputMode="numeric" value={f.visit_charge} onChange={set("visit_charge")} className="h-11 text-base" /></div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4" />
            <span>{PRO_JOIN_CONSENT}</span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base">{busy ? <Loader2 className="size-4 animate-spin" /> : "Send my application"}</Button>
          <Link href="/login?next=/pro" className="block text-center text-sm font-medium text-primary underline underline-offset-4">Already a Pro? Sign in</Link>
        </form>
      )}
    </CustomerShell>
  );
}
