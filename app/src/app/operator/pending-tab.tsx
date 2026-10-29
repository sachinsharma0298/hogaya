"use client";
import { useState } from "react";
import { StateBox } from "@/components/brand";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { prettyPhone } from "@/lib/phone";
import { catLabel } from "./booking-list";
import type { PendingCustomer, PendingPro } from "@/lib/store";

export interface PendingData { customers: PendingCustomer[]; pros: PendingPro[] }

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** People waiting for you. Nothing here can be called: approving adds them to the approved list (customers) or creates the Pro. */
export function PendingTab({ data }: { data?: PendingData }) {
  const [msg, setMsg] = useState("");
  async function act(kind: "customers" | "pros", id: string, action: "approve" | "reject", name: string) {
    const ok = window.confirm(action === "approve"
      ? `Approve ${name}?\n\n${kind === "customers" ? "Their email and phone go on the approved list, so their next bookings use real Fo calls." : "They become a Pro and can be matched and called by Fo."}\nOnly continue if they agreed to AI calls.`
      : `Reject ${name}?\n\n${kind === "customers" ? "They stay in preview mode (no real calls)." : "They will not be created as a Pro."}`);
    if (!ok) return;
    const res = await fetch(`/api/operator/pending/${kind}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const b = await res.json().catch(() => ({}));
    setMsg(res.ok ? `${name}: ${action === "approve" ? "approved" : "rejected"}.` : b.error ?? "Failed.");
  }
  if (!data) return <StateBox title="Loading…" />;
  const buttons = (kind: "customers" | "pros", id: string, name: string) => (
    <div className="flex shrink-0 gap-2">
      <Button type="button" onClick={() => act(kind, id, "approve", name)} className="h-8 rounded-lg text-xs">Approve</Button>
      <Button type="button" variant="outline" onClick={() => act(kind, id, "reject", name)} className="h-8 rounded-lg text-xs text-destructive">Reject</Button>
    </div>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {msg && <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm lg:col-span-2">{msg}</p>}
      <section aria-label="Pending customers" className="rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">Pending approval: customers ({data.customers.length})</h2>
        <p className="mt-1 text-xs text-foreground/75">Until approved, their bookings stay in preview (simulated calls).</p>
        {data.customers.length === 0 && <p className="mt-6 text-center text-sm text-foreground/70">Nobody is waiting.</p>}
        <ul className="mt-3 divide-y">
          {data.customers.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div><p className="font-semibold"><Link href={`/operator/people/${encodeURIComponent(c.id)}`} className="underline-offset-4 hover:underline">{c.name || "(no name)"}</Link><StatusBadge status="pending" /></p><p className="text-xs text-foreground/75">{c.email} · {c.phone ? prettyPhone(c.phone) : "no phone"}</p><p className="text-xs text-foreground/70">Signed up {when(c.created_at)}</p></div>
              {buttons("customers", c.id, c.name || c.email)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Pending Pros" className="rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">Pending Pros ({data.pros.length})</h2>
        <p className="mt-1 text-xs text-foreground/75">Never matched or called until you approve.</p>
        {data.pros.length === 0 && <p className="mt-6 text-center text-sm text-foreground/70">Nobody is waiting.</p>}
        <ul className="mt-3 divide-y">
          {data.pros.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-semibold"><Link href={`/operator/people/${encodeURIComponent(p.id)}`} className="underline-offset-4 hover:underline">{p.name}</Link><StatusBadge status="pending" /></p>
                <p className="text-xs text-foreground/75">{p.email} · {prettyPhone(p.phone)}</p>
                <p className="text-xs text-foreground/75">{p.categories.map(catLabel).join(", ")} · {p.area} · {p.visit_charge}</p>
                <p className="text-xs text-foreground/70">Agreed to AI calls {when(p.consent_at)} · applied {when(p.created_at)}</p>
              </div>
              {buttons("pros", p.id, p.name)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
