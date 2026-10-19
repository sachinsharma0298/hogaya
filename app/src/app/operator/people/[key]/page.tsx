"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Brand, StateBox } from "@/components/brand";
import { PhoneField } from "@/components/phone-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category } from "@/lib/categories";
import { prettyPhone } from "@/lib/phone";
import { usePoll } from "@/lib/use-poll";
import type { PersonDetail } from "@/lib/people";
import { catLabel, StateChip } from "../../booking-list";
import { ResetPasswordForm } from "../../reset-password";
import type { BookingState } from "@/lib/types";

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm"><dt className="text-foreground/65">{k}</dt><dd className="min-w-0 break-words font-medium">{children || "—"}</dd></div>
);

/** Everything about one customer or Pro, and the actions on them. Passwords are never shown. */
export default function PersonPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const { data, error } = usePoll<{ person: PersonDetail }>(`/api/operator/people/${key}`, 5000);
  const p = data?.person;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<string | null>(null); // what is typed in the notes box (null = untouched)
  const notes = draft ?? p?.notes ?? "";
  const [editing, setEditing] = useState(false);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg(null);
    const res = await fetch(`/api/operator/people/${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const b = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? { ok: true, text: action === "notes" ? "Notes saved." : action === "edit" ? "Details saved." : `Done: ${action}.` } : { ok: false, text: b.error ?? "Failed." });
    return res.ok;
  }
  async function decide(action: "approve" | "reject") {
    if (!p) return;
    const text = action === "approve"
      ? `Approve ${p.name}?\n\n${p.role === "pro" ? "They become a Pro (or go back on the approved list) and can be matched and called by Fo." : "Their email and phone go on the approved list, so their next bookings use real Fo calls."}\nOnly continue if they agreed to AI calls.`
      : `Reject ${p.name}?\n\n${p.role === "pro" ? "They are taken off the approved list and will not be matched or called." : "They are taken off the approved list and stay in preview (no real calls)."}`;
    if (window.confirm(text)) await post(action);
  }
  async function remove() {
    if (!p || !window.confirm(`Delete ${p.name}?\n\nThis removes their login${p.role === "pro" ? ", the Pro record" : ""}, their approval for live calls and their notes. Their bookings stay, without a name link. It cannot be undone.`)) return;
    setBusy("delete");
    const res = await fetch(`/api/operator/people/${key}`, { method: "DELETE" });
    if (res.ok) return router.replace("/operator");
    setBusy("");
    setMsg({ ok: false, text: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not delete." });
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-5">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4"><Brand small english /><span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">Operator</span></div>
        <Link href="/operator" className="flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"><ArrowLeft className="size-4" /> Console</Link>
      </header>
      {error && !p && <StateBox title="Couldn't load this person" body="They may have been deleted." />}
      {!p && !error && <StateBox title="Loading…" />}
      {p && (
        <div className="space-y-5">
          <section className="rounded-3xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{p.role}</span>
              <StatusBadge status={p.status} />
            </div>
            <dl className="mt-3 divide-y">
              <Row k="Email">{p.email}</Row>
              <Row k="Phone">{p.phone ? <>{prettyPhone(p.phone)} <span className="font-normal text-foreground/60">({p.phone})</span></> : ""}</Row>
              <Row k="Country">{p.country}</Row>
              <Row k="Role">{p.role === "pro" ? "Pro" : "Customer"}</Row>
              <Row k="Status">{p.status[0].toUpperCase() + p.status.slice(1)}{!p.has_login && " (has not signed in yet)"}</Row>
              <Row k="Signed up">{when(p.signed_up_at)}</Row>
              <Row k={p.status === "rejected" ? "Rejected" : "Approved"}>{p.status === "pending" ? "" : when(p.reviewed_at)}</Row>
              <Row k={p.status === "rejected" ? "Rejected by" : "Approved by"}>{p.status === "pending" ? "" : p.reviewed_by}</Row>
            </dl>
          </section>

          {p.pro && (
            <section className="rounded-3xl border bg-card p-5">
              <h2 className="text-base font-semibold">Pro details</h2>
              <dl className="mt-2 divide-y">
                <Row k="Categories">{p.pro.categories.map(catLabel).join(", ")}</Row>
                <Row k="Area">{p.pro.area}</Row>
                <Row k="Visit charge">{p.pro.visit_charge}</Row>
                <Row k="Consent wording">“{p.pro.consent_text}”</Row>
                <Row k="Consent date">{p.pro.consent_at ? (p.pro.consent_at.length > 10 ? when(p.pro.consent_at) : p.pro.consent_at) : ""}</Row>
                <Row k="Reliability">{p.pro.jobs || p.pro.reliability ? `${p.pro.reliability} / 100 · ${p.pro.on_time_pct}% on time · ${p.pro.jobs} jobs · ${p.pro.no_shows} no-shows` : "Not a Pro yet: no score"}</Row>
                {p.pro.opt_out && <Row k="AI calls">Paused</Row>}
              </dl>
            </section>
          )}

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="text-base font-semibold">Bookings ({p.bookings.length})</h2>
            {p.bookings.length === 0 && <p className="mt-3 text-sm text-foreground/70">No bookings yet.</p>}
            <ul className="mt-2 divide-y">
              {p.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/operator?b=${encodeURIComponent(b.id)}`} className="min-w-0 flex-1 truncate font-medium text-primary underline-offset-4 hover:underline">{catLabel(b.category as Category)} · {b.problem}</Link>
                  <span className="shrink-0 text-xs text-foreground/65">{when(b.created_at)}</span>
                  <StateChip state={b.state as BookingState} />
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="text-base font-semibold">Operator notes</h2>
            <textarea aria-label="Operator notes" value={notes} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={4000} placeholder="Private notes. Only you see these." className="mt-2 w-full rounded-xl border bg-background p-3 text-sm" disabled={!p.email} />
            <Button type="button" disabled={busy === "notes" || !p.email || draft === null || draft === p.notes} onClick={() => post("notes", { notes })} className="mt-2 h-9 rounded-xl text-sm">{busy === "notes" ? <Loader2 className="size-4 animate-spin" /> : "Save notes"}</Button>
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="text-base font-semibold">Actions</h2>
            {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <Button type="button" disabled={Boolean(busy) || p.status === "approved"} onClick={() => decide("approve")} className="h-9 rounded-xl text-sm">Approve</Button>
              <Button type="button" variant="outline" disabled={Boolean(busy) || p.status === "rejected"} onClick={() => decide("reject")} className="h-9 rounded-xl text-sm text-destructive">Reject</Button>
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => setEditing((v) => !v)} className="h-9 rounded-xl text-sm">Edit details</Button>
              {p.has_login || p.role === "pro" ? <ResetPasswordForm personKey={p.key} name={p.name} onDone={(t) => setMsg({ ok: true, text: t })} /> : null}
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={remove} className="h-9 rounded-xl text-sm text-destructive">Delete</Button>
            </div>
            {editing && <EditForm p={p} onSave={async (v) => { if (window.confirm(`Save these changes to ${p.name}?`) && (await post("edit", v))) setEditing(false); }} busy={busy === "edit"} />}
          </section>
        </div>
      )}
    </div>
  );
}

function EditForm({ p, onSave, busy }: { p: PersonDetail; onSave: (v: Record<string, unknown>) => void; busy: boolean }) {
  const [name, setName] = useState(p.name);
  const [phone, setPhone] = useState(p.phone);
  const [area, setArea] = useState(p.pro?.area ?? "");
  const [visit, setVisit] = useState((p.pro?.visit_charge ?? "").replace(/[^\d.]/g, ""));
  const [cats, setCats] = useState<Category[]>(p.pro?.categories ?? []);
  const toggle = (c: Category) => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ name, phone, ...(p.pro ? { area, visit_charge: visit, categories: cats } : {}) }); }} className="mt-4 max-w-md space-y-3 rounded-2xl border bg-background p-4">
      <div className="space-y-1.5"><Label htmlFor="e-name">Name</Label><Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1.5">
        <Label htmlFor="e-phone">Phone</Label>
        <PhoneField id="e-phone" value={phone} onChange={setPhone} />
        {p.status === "approved" && <p className="text-xs text-foreground/70">An approved number can’t be changed (its consent was recorded for that number). Reject first, then approve again.</p>}
      </div>
      {p.pro && (
        <>
          <fieldset><legend className="mb-1.5 text-sm font-medium">Categories</legend>
            <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1 text-xs ${cats.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{catLabel(c)}</button>)}</div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="e-area">Area</Label><Input id="e-area" value={area} onChange={(e) => setArea(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="e-visit">Visit charge (₹)</Label><Input id="e-visit" inputMode="numeric" value={visit} onChange={(e) => setVisit(e.target.value)} /></div>
          </div>
        </>
      )}
      <Button type="submit" disabled={busy} className="h-9 rounded-xl text-sm">{busy ? <Loader2 className="size-4 animate-spin" /> : "Save details"}</Button>
    </form>
  );
}
