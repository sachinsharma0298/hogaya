"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Type a temporary password for someone. It goes to Supabase Auth only (hashed); this page never shows an existing password. */
export function ResetPasswordForm({ personKey, name, onDone }: { personKey: string; name: string; onDone?: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8 || pw.length > 72) return setErr("The temporary password needs 8 to 72 characters.");
    if (!window.confirm(`Set a temporary password for ${name}?\n\nTheir old password stops working. They must choose a new one at their next login.`)) return;
    setBusy(true);
    const res = await fetch(`/api/operator/people/${encodeURIComponent(personKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset_password", password: pw }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(b.error ?? "Could not reset the password.");
    setPw("");
    setOpen(false);
    onDone?.(`Temporary password set for ${name}. Share it with them privately.`);
  }
  if (!open) return <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-8 rounded-lg text-xs">Reset password</Button>;
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-2 rounded-xl border bg-background p-3">
      <Input aria-label={`Temporary password for ${name}`} type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New temporary password (8+ characters)" />
      <p className="text-xs text-foreground/75">Share it with them privately (call or WhatsApp). They must set a new password at their next login.</p>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-8 rounded-lg text-xs">{busy ? <Loader2 className="size-3.5 animate-spin" /> : "Set temporary password"}</Button>
        <Button type="button" variant="outline" onClick={() => { setOpen(false); setPw(""); setErr(""); }} className="h-8 rounded-lg text-xs">Cancel</Button>
      </div>
    </form>
  );
}
