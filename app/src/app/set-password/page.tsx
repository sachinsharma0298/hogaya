"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CustomerShell, StateBox } from "@/components/brand";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/lang";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { customer: "/me", pro: "/pro", operator: "/operator" };

/** After the operator resets a password, the person must choose their own before doing anything else. */
export default function SetPassword() {
  const { t } = useT();
  const { loading, user } = useSession();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (loading) return <CustomerShell><StateBox title="…" /></CustomerShell>;
  if (!user) { window.location.assign("/login"); return null; }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8 || pw.length > 72) return setError(t("pw.err"));
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (!res.ok) { setBusy(false); return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("login.err.generic")); }
    } catch { setBusy(false); return setError(t("err.network")); }
    window.location.assign(HOME[user!.role]);
  }
  return (
    <CustomerShell>
      <h1 className="text-2xl font-bold tracking-tight">{t("pw.title")}</h1>
      <p className="mt-1 text-sm text-foreground/85">{t("pw.body")}</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-3">
        <div className="space-y-1.5"><Label htmlFor="new-pw">{t("pw.new")}</Label><Input id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-11 text-base" /></div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base">{busy ? <Loader2 className="size-4 animate-spin" /> : t("pw.btn")}</Button>
      </form>
    </CustomerShell>
  );
}
