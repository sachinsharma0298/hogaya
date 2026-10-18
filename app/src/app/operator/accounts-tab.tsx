"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { StateBox } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePoll } from "@/lib/use-poll";

interface Account { id: string; role: string; name: string; email: string; phone: string; provider_id?: string }

/** Customers and Pros with a login. You create the account and tell the person their password; nobody else can take these emails. */
export function AccountsTab() {
  const { data, error } = usePoll<{ accounts: Account[]; canCreate: boolean }>("/api/operator/accounts", 5000);
  const [f, setF] = useState({ role: "customer", name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/operator/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: b.error ?? "Could not create the account." });
    setMsg({ ok: true, text: `Account ready for ${f.email}. Tell them the password you chose; they sign in at the Sign in tab.` });
    setF({ role: f.role, name: "", email: "", phone: "", password: "" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form onSubmit={create} className="space-y-3 self-start rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">Create or reset an account</h2>
        <p className="text-xs text-foreground/80">For a Pro, onboard them first (Providers tab) with the same email. If the email already has an account, this sets a new password.</p>
        <div className="space-y-1.5">
          <Label htmlFor="ac-role">Role</Label>
          <select id="ac-role" value={f.role} onChange={set("role")} className="h-10 w-full rounded-xl border bg-background px-2 text-sm"><option value="customer">Customer</option><option value="pro">Hogaya Pro</option></select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="ac-name">Name</Label><Input id="ac-name" value={f.name} onChange={set("name")} /></div>
        <div className="space-y-1.5"><Label htmlFor="ac-email">Email</Label><Input id="ac-email" type="email" value={f.email} onChange={set("email")} /></div>
        <div className="space-y-1.5"><Label htmlFor="ac-phone">Phone (10 digits)</Label><Input id="ac-phone" inputMode="tel" value={f.phone} onChange={set("phone")} /></div>
        <div className="space-y-1.5"><Label htmlFor="ac-pw">Password (8+ characters)</Label><Input id="ac-pw" type="text" autoComplete="off" value={f.password} onChange={set("password")} /></div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
        <Button type="submit" disabled={busy || data?.canCreate === false} className="h-11 w-full rounded-xl">{busy ? <Loader2 className="size-4 animate-spin" /> : "Create account"}</Button>
        {data?.canCreate === false && <p className="text-xs text-foreground/70">Creating accounts needs Supabase, so it is off here.</p>}
      </form>
      <section aria-label="Accounts" className="rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">Accounts</h2>
        {error && !data && <StateBox title="Couldn't load" body="Retrying…" />}
        {!data && !error && <StateBox title="Loading…" />}
        {data && (
          <ul className="mt-4 divide-y text-sm">
            {data.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <span><b>{a.name || "(no name)"}</b> <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{a.role}</span><span className="block text-xs text-foreground/70">{a.email} {a.phone && `· ${a.phone}`}</span></span>
                <span className="font-mono text-[10px] text-foreground/50">{a.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
