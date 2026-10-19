"use client";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { StateBox } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FO_COUNTRY_WARNING } from "@/lib/phone";
import { usePoll } from "@/lib/use-poll";

interface Approved { callable?: boolean; id: number; phone: string; kind: "pro" | "customer"; name: string; email: string; consent_at: string; added_by: string; note: string }

/** The only phone numbers a LIVE Fo call may ever reach. Anyone not here gets simulated calls. */
export function ApprovedTab() {
  const { data, error } = usePoll<{ approved: Approved[] }>("/api/approved", 4000);
  const [f, setF] = useState({ kind: "customer", name: "", phone: "", email: "", note: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setLink("");
    const res = await fetch("/api/approved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(b.error ?? "Could not add.");
    setF({ kind: f.kind, name: "", phone: "", email: "", note: "", consent: false });
    setMsg("Added. Live calls can now reach this number.");
    if (b.link) setLink(b.link);
  }
  async function remove(a: Approved) {
    if (!window.confirm(`Delete ${a.name} (•••• ${a.phone.slice(-4)})?\n\nThis removes their approval for live calls and their login${a.kind === "pro" ? " (and the Pro record)" : ""}. It cannot be undone.`)) return;
    const res = await fetch(`/api/approved/${a.id}`, { method: "DELETE" });
    if (!res.ok) window.alert((await res.json().catch(() => ({}))).error ?? "Could not delete.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form onSubmit={add} className="space-y-3 self-start rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">Approve a number for live calls</h2>
        <p className="text-xs text-foreground/80">Pros you onboard are added here automatically. Use this form for customers you want to try the live flow, with their agreement.</p>
        <div className="space-y-1.5">
          <Label htmlFor="ap-kind">Who is this?</Label>
          <select id="ap-kind" value={f.kind} onChange={set("kind")} className="h-10 w-full rounded-xl border bg-background px-2 text-sm">
            <option value="customer">Customer</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="ap-name">Name</Label><Input id="ap-name" value={f.name} onChange={set("name")} /></div>
        <div className="space-y-1.5"><Label htmlFor="ap-phone">Phone</Label><PhoneField id="ap-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} /></div>
        {f.kind === "customer" && (
          <div className="space-y-1.5">
            <Label htmlFor="ap-email">Email they sign in with</Label>
            <Input id="ap-email" type="email" value={f.email} onChange={set("email")} />
            <p className="text-xs text-foreground/70">The number only counts when this exact email is signed in, so nobody can type someone else’s number.</p>
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="ap-note">Note (optional)</Label><Input id="ap-note" value={f.note} onChange={set("note")} /></div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={f.consent} onChange={(e) => setF((p) => ({ ...p, consent: e.target.checked }))} className="mt-1 size-4" />
          <span>This person agreed to receive AI calls from Hogaya (consent recorded with today’s date).</span>
        </label>
        {msg && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm">{msg}</p>}
        {link && (
          <div className="rounded-xl border border-primary/40 bg-accent/40 p-3 text-xs">
            <p className="font-semibold">Booking link for this customer</p>
            <p className="mt-1 break-all text-foreground/80">{link}</p>
            <p className="mt-1 text-foreground/70">Send it to them yourself (Hogaya sends nothing). One click signs them in and opens the booking form. It works once.</p>
            <button type="button" onClick={() => void navigator.clipboard.writeText(link)} className="mt-2 rounded-lg border bg-background px-2 py-1 text-[11px] font-medium">Copy link</button>
          </div>
        )}
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">{busy ? <Loader2 className="size-4 animate-spin" /> : "Approve for live calls"}</Button>
      </form>

      <section aria-label="Approved numbers" className="rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">Approved numbers</h2>
        {error && !data && <StateBox title="Couldn't load the list" body="Retrying…" />}
        {!data && !error && <StateBox title="Loading…" />}
        {data && data.approved.length === 0 && <p className="mt-6 text-center text-sm text-foreground/70">Nobody is approved yet, so every booking runs with simulated calls.</p>}
        {data && data.approved.length > 0 && (
          <ul className="mt-4 divide-y">
            {data.approved.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">{a.name} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{a.kind}</span>{a.callable === false && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">⚠ {FO_COUNTRY_WARNING}</span>}</p>
                  <p className="text-xs text-foreground/75">•••• {a.phone.slice(-4)}{a.email ? ` · ${a.email}` : ""} · consent {a.consent_at.slice(0, 10)} · by {a.added_by}</p>
                  {a.note && <p className="text-xs text-foreground/60">{a.note}</p>}
                </div>
                <button type="button" onClick={() => remove(a)} aria-label={`Delete ${a.name}`} className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" />Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
