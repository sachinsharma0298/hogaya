"use client";
import { Flag, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DICTS } from "@/lib/translations";
import { CATEGORIES } from "@/lib/categories";
import { STATE_LABEL } from "@/lib/state";
import type { BookingState, HogayaRequest } from "@/lib/types";

export const catLabel = (c: string) => DICTS.en[`cat.${c}`] ?? c; // the operator console is English-only

/** One status chip style for the whole console. */
export function stateChipClass(s: BookingState) {
  if (s === "flagged") return "bg-red-100 text-red-800";
  if (s === "paused") return "bg-amber-100 text-amber-800";
  if (s === "cancelled") return "bg-neutral-200 text-neutral-700";
  if (s === "booked" || s === "reconfirmed" || s === "arrived") return "bg-emerald-100 text-emerald-800";
  if (s === "completed" || s === "closed") return "bg-sky-100 text-sky-800";
  return "bg-accent text-accent-foreground";
}
export function StateChip({ state }: { state: BookingState }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stateChipClass(state)}`}>{STATE_LABEL[state]}</span>;
}

export interface Filters {
  search: string;
  category: string;
  flaggedOnly: boolean;
  showArchived: boolean;
}

export const openFlagCount = (r: HogayaRequest) => r.flags.filter((f) => !f.resolved_at).length;

export function applyFilters(all: HogayaRequest[], f: Filters): HogayaRequest[] {
  const q = f.search.trim().toLowerCase();
  return all.filter((r) => {
    if (!f.showArchived && r.archived) return false;
    if (f.category !== "all" && r.category !== f.category) return false;
    if (f.flaggedOnly && openFlagCount(r) === 0) return false;
    if (q && ![r.customer.name, r.problem, r.sector, r.id, catLabel(r.category)].some((x) => x.toLowerCase().includes(q))) return false;
    return true;
  });
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function BookingList({
  all, shown, selectedId, onSelect, filters, setFilters, onArchiveAll,
}: {
  all: HogayaRequest[];
  shown: HogayaRequest[];
  selectedId?: string;
  onSelect: (id: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onArchiveAll: () => void;
}) {
  const flaggedTotal = all.filter((r) => !r.archived && openFlagCount(r) > 0).length;
  const archivedTotal = all.filter((r) => r.archived).length;
  return (
    <section aria-label="Bookings" className="rounded-3xl border bg-card">
      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/70" />
          <input
            aria-label="Search bookings"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search name, problem, location…"
            className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Filter by category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="h-9 flex-1 rounded-xl border bg-background px-2 text-sm">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
          <button
            type="button"
            aria-pressed={filters.flaggedOnly}
            onClick={() => setFilters({ ...filters, flaggedOnly: !filters.flaggedOnly })}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium ${filters.flaggedOnly ? "border-red-300 bg-red-50 text-red-800" : "bg-background"}`}
          >
            <Flag className="size-3.5" /> Flagged{flaggedTotal ? ` (${flaggedTotal})` : ""}
          </button>
        </div>
        <label className="flex items-center justify-between text-xs text-foreground/80">
          <span>Show archived{archivedTotal ? ` (${archivedTotal})` : ""}</span>
          <Switch checked={filters.showArchived} onCheckedChange={(v) => setFilters({ ...filters, showArchived: v })} aria-label="Show archived" />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="border-t px-4 py-8 text-center text-sm text-foreground/70">
          {all.length === 0 ? "No bookings yet. Create one on the customer page and it shows up here live." : "No bookings match these filters."}
        </p>
      ) : (
        <ul className="max-h-[70vh] divide-y overflow-y-auto border-t">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onSelect(r.id)} aria-current={r.id === selectedId} className={`w-full px-4 py-3 text-left transition hover:bg-muted/50 ${r.id === selectedId ? "bg-accent/50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{catLabel(r.category)}</span>
                  <StateChip state={r.state} />
                </div>
                <p className="mt-0.5 truncate text-sm text-foreground/85">{r.problem}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-foreground/70">
                  <span className="truncate">{r.customer.name} · {r.sector}</span>
                  <span className="shrink-0">· {ago(r.created_at)}</span>
                  {openFlagCount(r) > 0 && <span className="shrink-0 font-semibold text-red-700">⚑ {openFlagCount(r)}</span>}
                  {r.archived && <span className="shrink-0 rounded bg-muted px-1">archived</span>}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t px-4 py-2 text-right">
        <button type="button" onClick={onArchiveAll} className="text-xs text-foreground/70 underline underline-offset-4 hover:text-foreground">Archive all (nothing is deleted)</button>
      </div>
    </section>
  );
}
