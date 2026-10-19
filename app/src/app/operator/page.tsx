"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand, StateBox } from "@/components/brand";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/components/session";
import { usePoll } from "@/lib/use-poll";
import { applyFilters, BookingList, type Filters } from "./booking-list";
import { BookingDetail } from "./booking-detail";
import type { ConsoleData, ConsoleSettings } from "./console-types";
import { AccountsTab } from "./accounts-tab";
import { ApprovedTab } from "./approved-tab";
import { ProvidersTab } from "./providers-tab";

export default function Operator() {
  const session = useSession();
  const { data, error } = usePoll<ConsoleData>("/api/requests", 3000);
  const settings = usePoll<ConsoleSettings>("/api/settings", 2000).data ?? { autopilot: false, simulate_no_reconfirm: false };
  const [tab, setTab] = useState<"bookings" | "providers" | "approved" | "accounts">("bookings");
  const [sel, setSel] = useState<string | undefined>();
  const [filters, setFilters] = useState<Filters>({ search: "", category: "all", flaggedOnly: false, showArchived: false });
  const [note, setNote] = useState("");

  const all = data?.requests ?? [];
  const shown = applyFilters(all, filters);
  const r = shown.find((x) => x.id === sel) ?? shown[0];
  const cfg = data?.config;

  async function toggleAutopilot(v: boolean) {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autopilot: v }) });
  }
  async function archiveAll() {
    if (!window.confirm("Archive every booking? Nothing is deleted: turn on “Show archived” to see them again.")) return;
    const res = await fetch("/api/requests/archive-all", { method: "POST" });
    const b = await res.json().catch(() => ({}));
    setNote(res.ok ? `Archived ${b.archived} booking(s).` : "Could not archive.");
    setSel(undefined);
  }
  async function resetAll() {
    const typed = window.prompt("Reset ALL data?\n\nThis DELETES every booking, call, event, Pro, approved customer and every account except yours. Your operator account, Fo sign-in and the 10 categories are kept. Nothing is re-added. This cannot be undone.\n\nType RESET to confirm.");
    if (typed === null) return;
    if (typed !== "RESET") return setNote("Reset cancelled: you must type RESET exactly.");
    const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "RESET" }) });
    const b = await res.json().catch(() => ({}));
    setSel(undefined);
    setNote(res.ok ? `All data reset: ${b.removedRequests} bookings, ${b.removedProviders} Pros, ${b.removedApproved} approved numbers and ${b.removedAccounts} accounts removed.` : b.error ?? "Reset failed.");
  }

  if (session.loading) return <div className="mx-auto max-w-md px-6 py-20"><StateBox title="Loading…" /></div>;
  if (session.user?.role !== "operator") {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <StateBox title="Operator login needed" body="This console is for the Hogaya operator only." />
        <Link href="/login?role=operator&next=/operator" className="mt-4 block rounded-2xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {cfg && (
        <div role="status" className={`px-6 py-3 text-center text-white ${cfg.dryRun ? "bg-indigo-700" : cfg.agentMode === "real" ? "bg-emerald-600" : "bg-neutral-600"}`}>
          <p className="text-xl font-extrabold tracking-wide">{cfg.dryRun ? "REHEARSAL: live flow, no real calls" : cfg.agentMode === "real" ? "LIVE: real Fo calls" : "DEMO mode"}</p>
          <p className="mt-0.5 text-sm opacity-95">
            {cfg.dryRun ? "The live flow and Autopilot run exactly as in real mode, but every call is faked. Nobody is called."
              : cfg.agentMode === "real" ? "Real calls only reach numbers on the Approved list. Everyone else gets “Demo: simulated calls”."
              : "No real calls. Every result on this page is fake demo data."}
          </p>
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl px-6 py-5">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Brand small english />
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">Operator</span>
            <nav aria-label="Console sections" className="flex rounded-full border bg-card p-0.5 text-sm font-medium">
              {(["bookings", "providers", "approved", "accounts"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-full px-4 py-1.5 capitalize transition ${tab === t ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}>{t}</button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={resetAll} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-destructive hover:bg-destructive/10">Reset all data</button>
            <Link href="/operator/profile" className="text-foreground/80 underline-offset-4 hover:underline">My profile{session.user?.name ? ` (${session.user.name})` : ""}</Link>
            <Link href="/" className="text-primary underline-offset-4 hover:underline">Customer site →</Link>
            <button type="button" onClick={async () => { await session.logout(); window.location.assign("/"); }} className="text-foreground/70 underline-offset-4 hover:underline">Log out</button>
          </div>
        </header>

        {cfg && (
          <label className="mb-5 flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/40 bg-accent/40 px-4 py-3 text-sm">
            <span>
              <span className="text-base font-bold">Autopilot</span>
              <span className="block text-xs text-foreground/80">
                OFF by default. When ON{cfg.agentMode === "real" ? "" : " (needs AGENT_MODE=real, not set now)"}, a live booking runs by itself: provider calls, customer call, booking call and the T–60 reconfirm. One Fo call at a time, consent required, at most 2 attempts per person per step.
              </span>
            </span>
            <Switch checked={settings.autopilot} onCheckedChange={toggleAutopilot} disabled={cfg.agentMode !== "real"} aria-label="Autopilot" />
          </label>
        )}

        {note && <p role="status" className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm">{note}</p>}
        {error && !data && <StateBox title="Couldn't load the console" body="Retrying…" />}
        {!data && !error && <StateBox title="Loading…" body="Fetching bookings." />}

        {data && tab === "providers" && <ProvidersTab providers={data.providers} />}
        {tab === "approved" && <ApprovedTab />}
        {tab === "accounts" && <AccountsTab />}
        {data && tab === "bookings" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <BookingList all={all} shown={shown} selectedId={r?.id} onSelect={setSel} filters={filters} setFilters={setFilters} onArchiveAll={archiveAll} />
            <div>
              {r ? <BookingDetail key={r.id} r={r} data={data} settings={settings} /> : <StateBox title="No booking selected" body="Pick a booking on the left, or clear the filters." />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
