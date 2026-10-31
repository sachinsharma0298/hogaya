"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DemoBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import type { ArrivalJson, BookingCallJson, CallRecord, CustomerCallJson, HogayaRequest, ProviderCallJson } from "@/lib/types";

const first = (n?: string) => (n ?? "").split(" ")[0];
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

function duration(c: CallRecord): string {
  if (!c.ended_at) return ["done", "failed", "timed_out", "needs_review"].includes(c.status) ? "" : "in progress";
  const sec = Math.max(0, Math.round((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000));
  return sec < 60 ? "under 1 min" : `${Math.round(sec / 60)} min`;
}

function title(c: CallRecord): string {
  const base = title0(c);
  return c.meta?.attempt && c.meta.attempt > 1 ? `${base} (attempt ${c.meta.attempt})` : base;
}

function title0(c: CallRecord): string {
  switch (c.kind) {
    case "provider": return `Fo called ${first(c.provider_name)}`;
    case "customer": return "Fo called the customer";
    case "booking": return `Fo called ${first(c.provider_name)} to book`;
    case "reconfirm": return `Fo reconfirmed with ${first(c.provider_name)}`;
    case "arrival": return `Fo checked arrival with ${first(c.provider_name)}`;
    default: return `Final confirmation call to ${first(c.provider_name)}`;
  }
}

/** A short, friendly result for a finished call. */
function result(c: CallRecord): { text: string; tone: "ok" | "bad" | "wait" | "neutral" } {
  if (c.status === "calling") return { text: "Calling…", tone: "wait" };
  if (c.status === "waiting_summary") return { text: "On the call, or Fo is redialling: waiting for Fo's final result…", tone: "wait" };
  if (c.status === "needs_reply") return { text: "Fo is asking you something", tone: "bad" };
  if (c.status === "unconfirmed") return { text: "Call may be in progress (start not confirmed)", tone: "bad" };
  if (c.status === "failed") return { text: c.progress ? `Failed: ${c.progress.slice(0, 80)}` : "Failed", tone: "bad" };
  if (c.status === "timed_out") return { text: "No summary yet", tone: "bad" };
  if (c.status === "needs_review") return { text: "Claude could not read it: read Fo's summary", tone: "bad" };
  const j = (c.json ?? {}) as Record<string, unknown>;
  switch (c.kind) {
    case "provider": {
      const p = j as unknown as ProviderCallJson;
      if (p.status === "confirmed") return { text: `Confirmed ✓${p.slot ? ` · ${p.slot}` : ""}`, tone: "ok" };
      if (p.status === "declined") return { text: "Declined", tone: "bad" };
      return { text: p.answered === false ? "No answer" : "Unclear", tone: "bad" };
    }
    case "customer": {
      const x = j as unknown as CustomerCallJson;
      if (x.confirmed === true) return { text: `Chose ${first(x.preferred_option ?? "")} ✓`, tone: "ok" };
      return { text: x.confirmed === false ? "Declined all options" : "No clear answer", tone: "bad" };
    }
    case "booking": {
      const x = j as unknown as BookingCallJson;
      return x.confirmed === true ? { text: `Confirmed ✓${x.slot ? ` · ${x.slot}` : ""}`, tone: "ok" } : { text: x.confirmed === false ? "Declined" : "Unclear", tone: "bad" };
    }
    case "reconfirm": {
      const x = j as { reconfirmed?: boolean | null; can_make_it?: boolean | null };
      return x.reconfirmed === true && x.can_make_it !== false ? { text: "Reconfirmed ✓", tone: "ok" } : { text: x.reconfirmed === false || x.can_make_it === false ? "Can't make it" : "No reconfirm", tone: "bad" };
    }
    case "arrival": {
      const x = j as unknown as ArrivalJson;
      return x.provider_gave_code ? { text: "Gave a code", tone: "neutral" } : { text: "No code given", tone: "bad" };
    }
    default:
      return { text: "Done", tone: "neutral" };
  }
}

const TONE = { ok: "text-emerald-700", bad: "text-red-700", wait: "text-amber-700", neutral: "text-foreground/75" };
const TECH = /call failed|no call summary|still no call summary|summary timed out/i;

function CallRow({ c, post, replyText, setReplyText }: { c: CallRecord; post: (path: string, body?: unknown) => Promise<boolean | undefined>; replyText: string; setReplyText: (v: string) => void }) {
  const [open, setOpen] = useState(c.status === "needs_reply");
  const res = result(c);
  const expanded = open || c.status === "needs_reply";
  return (
    <div className="rounded-2xl border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={expanded} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{title(c)}</span>
          <span className="text-foreground/70">{duration(c) ? ` · ${duration(c)}` : ""} · </span>
          <span className={`font-medium ${TONE[res.tone]}`}>{res.text}</span>
        </span>
        {c.demo && <DemoBadge label="Demo data" />}
        <span className="shrink-0 text-xs text-foreground/70">{clock(c.started_at)}</span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t px-4 py-3">
          {c.progress && c.status !== "done" && <p className="text-xs text-foreground/80">Fo: {c.progress}</p>}
          {c.status === "needs_reply" && (
            <div className="rounded-xl border-2 border-primary bg-accent/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide">Fo asks</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.question}</p>
              <div className="mt-2 flex gap-2">
                <input aria-label="Your answer to Fo" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your answer, e.g. Yes, go ahead" className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm" />
                <Button onClick={async () => { if (await post("reply", { call_id: c.id, message: replyText })) setReplyText(""); }} className="h-9 rounded-lg">Send</Button>
              </div>
            </div>
          )}
          {c.summary_text && c.status !== "needs_reply" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{c.status === "done" || c.status === "needs_review" || c.demo ? "Fo's call summary" : "Fo's latest message"}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.summary_text}</p>
            </div>
          )}
          {c.json && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">JSON (made by Claude)</p>
              <pre className="mt-1 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-foreground p-3 text-xs text-background">{JSON.stringify(c.json, null, 2)}</pre>
            </div>
          )}
          {(c.status === "timed_out" || c.status === "needs_review") && <Button onClick={() => post("check-again", { call_id: c.id })} variant="outline" className="rounded-xl">Check again</Button>}
          {c.status === "unconfirmed" && (
            <div className="space-y-2">
              <p className="text-xs text-red-800">Hogaya will not send this call again. It is looking for it in Fo&apos;s history. If you have checked Fo and no call was placed, you can allow a retry.</p>
              <Button onClick={() => { if (window.confirm("Only press this if Fo's history shows NO call was placed for this attempt. Otherwise a second call may reach the person.")) void post("control", { action: "clear_unconfirmed" }); }} variant="outline" className="rounded-xl">I checked Fo: no call was placed</Button>
            </div>
          )}
          {c.status === "failed" && c.progress && <p className="text-xs text-red-700">{c.progress}</p>}
        </div>
      )}
    </div>
  );
}

/** One clean timeline for this booking: friendly events, and each call as a collapsible row. */
export function CallTimeline({ r, post }: { r: HogayaRequest; post: (path: string, body?: unknown) => Promise<boolean | undefined> }) {
  const [tech, setTech] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});

  // A failed or timed-out call that a later call of the same kind recovered is a technical detail.
  const recovered = (c: CallRecord) =>
    ["failed", "timed_out", "needs_review"].includes(c.status) &&
    r.calls.some((o) => o.kind === c.kind && o.provider_id === c.provider_id && o.status === "done" && o.started_at > c.started_at);
  const unrecovered = r.calls.some((c) => ["failed", "timed_out", "needs_review"].includes(c.status) && !recovered(c));

  type Item = { at: string; key: string; node: React.ReactNode; technical: boolean };
  const items: Item[] = [];
  for (const [i, e] of r.events.entries()) {
    const technical = TECH.test(e.text) && !unrecovered;
    items.push({
      at: e.at, key: `e${i}`, technical,
      node: (
        <div className="flex gap-3 px-1 text-sm">
          <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-xs text-foreground/70 tabular-nums">{clock(e.at)}</span>
          <span className={e.text.startsWith("FLAG") || e.text.startsWith("ARRIVAL NOT") ? "font-semibold text-red-700" : ""}>{e.text}</span>
        </div>
      ),
    });
  }
  for (const c of r.calls) {
    items.push({
      at: c.started_at, key: c.id, technical: recovered(c),
      node: <CallRow c={c} post={post} replyText={reply[c.id] ?? ""} setReplyText={(v) => setReply((p) => ({ ...p, [c.id]: v }))} />,
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at)); // newest first
  const hiddenCount = items.filter((i) => i.technical).length;
  const shown = items.filter((i) => tech || !i.technical);

  return (
    <section aria-label="Timeline" className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {hiddenCount > 0 && (
          <button type="button" onClick={() => setTech(!tech)} className="text-xs text-foreground/70 underline underline-offset-4 hover:text-foreground">
            {tech ? "Hide technical details" : `Show technical details (${hiddenCount})`}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">{shown.map((i) => <div key={i.key}>{i.node}</div>)}</div>
    </section>
  );
}
