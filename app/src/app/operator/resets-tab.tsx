"use client";
import { useState } from "react";
import Link from "next/link";
import { StateBox } from "@/components/brand";
import { ResetPasswordForm } from "./reset-password";

export interface ResetRow { id: number; email: string; identifier: string; name: string; role: string; created_at: string }

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** "Forgot password" requests. Nothing is emailed or texted: you set a temporary password and tell the person yourself. */
export function ResetsTab({ rows }: { rows?: ResetRow[] }) {
  const [msg, setMsg] = useState("");
  if (!rows) return <StateBox title="Loading…" />;
  return (
    <section aria-label="Password reset requests" className="max-w-3xl rounded-3xl border bg-card p-5">
      <h2 className="text-base font-semibold">Password reset requests ({rows.length})</h2>
      <p className="mt-1 text-xs text-foreground/75">Set a temporary password, then share it privately. Passwords are never shown here.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>}
      {rows.length === 0 && <p className="mt-6 text-center text-sm text-foreground/70">No one has asked for a reset.</p>}
      <ul className="mt-3 divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-semibold"><Link href={`/operator/people/${encodeURIComponent(r.email)}`} className="underline-offset-4 hover:underline">{r.name}</Link> <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{r.role}</span></p>
              <p className="text-xs text-foreground/75">{r.email} · asked with “{r.identifier}” · {when(r.created_at)}</p>
            </div>
            <ResetPasswordForm personKey={r.email} name={r.name} onDone={setMsg} />
          </li>
        ))}
      </ul>
    </section>
  );
}
