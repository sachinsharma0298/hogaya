"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The operator's own display name and phone. Email and password are not editable here. */
export default function OperatorProfile() {
  const [f, setF] = useState({ name: "", phone: "" });
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/operator/profile", { cache: "no-store" }).then((r) => r.json()).then((b) => {
      setF({ name: b.name ?? "", phone: b.phone ?? "" });
      setEmail(b.email ?? "");
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/operator/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Profile saved." } : { ok: false, text: b.error ?? "Could not save." });
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <header className="mb-5 flex items-center justify-between">
        <Brand small english />
        <Link href="/operator" className="text-sm text-primary underline-offset-4 hover:underline">← Back to console</Link>
      </header>
      <form onSubmit={save} className="space-y-3 rounded-3xl border bg-card p-5">
        <h1 className="text-lg font-semibold">My profile</h1>
        <div className="space-y-1.5"><Label htmlFor="op-name">Display name</Label><Input id="op-name" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} disabled={!loaded} /></div>
        <div className="space-y-1.5"><Label htmlFor="op-phone">Phone (reserved for you: no customer or Pro can use it)</Label>{loaded ? <PhoneField id="op-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} /> : <Input id="op-phone" disabled />}</div>
        <div className="space-y-1.5"><Label htmlFor="op-email">Email</Label><Input id="op-email" value={email} readOnly disabled /><p className="text-xs text-foreground/70">Email and password can’t be changed here.</p></div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
        <Button type="submit" disabled={busy || !loaded} className="h-11 w-full rounded-xl">{busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
      </form>
    </div>
  );
}
