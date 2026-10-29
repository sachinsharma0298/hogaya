"use client";
import { useState } from "react";
import { CalendarClock, Check, Loader2, Lock, MapPin, ShieldCheck } from "lucide-react";
import { StateBox } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/lang";
import { slotText } from "@/lib/slots";
import { usePoll } from "@/lib/use-poll";
import type { ProJob, ProStatus, ProTab } from "@/lib/pro-jobs";
import { ProShell } from "./pro-shell";

const TABS: ProTab[] = ["new", "booked", "today", "done"];
const TONE: Record<ProStatus, string> = {
  new: "bg-accent text-accent-foreground",
  confirmed: "bg-emerald-100 text-emerald-800",
  reconfirm_pending: "bg-amber-100 text-amber-800",
  pro_arrived: "bg-amber-100 text-amber-800",
  arrived: "bg-emerald-100 text-emerald-800",
  completed: "bg-sky-100 text-sky-800",
  no_show: "bg-red-100 text-red-800",
  not_selected: "bg-muted text-foreground/70",
  cancelled: "bg-neutral-200 text-neutral-700",
};

function Chip({ status }: { status: ProStatus }) {
  const { t } = useT();
  const label = status === "new" ? t("pa.status.new") : status === "arrived" ? t("pv.status.arrived") : status === "completed" ? t("pa.closed") : status === "cancelled" ? t("pa.status.cancelled") : t(`pv.status.${status}`);
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{label}</span>;
}

function ArriveBox({ id }: { id: string }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <>
      <Button type="button" disabled={busy} onClick={async () => { setBusy(true); setErr(false); try { const r = await fetch(`/api/pro/jobs/${id}/arrive`, { method: "POST" }); if (!r.ok) setErr(true); } catch { setErr(true); } setBusy(false); }} className="mt-3 h-11 w-full rounded-xl">
        {busy ? <Loader2 className="size-4 animate-spin" aria-label={t("f.busy")} /> : t("pa.arrive.btn")}
      </Button>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{t("err.generic")}</p>}
    </>
  );
}

function CodeBox({ id }: { id: string }) {
  const { t } = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"ok" | "bad" | "err" | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/pro/jobs/${id}/code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const b = await res.json().catch(() => ({}));
      setResult(!res.ok ? "err" : b.ok ? "ok" : "bad");
    } catch {
      setResult("err");
    }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl border bg-muted/50 p-3">
      <label htmlFor={`code-${id}`} className="text-sm font-semibold">{t("pa.enter_code")}</label>
      <p className="mt-0.5 text-xs text-foreground/75">{t("pa.code.help")}</p>
      <div className="mt-2 flex gap-2">
        <Input id={`code-${id}`} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder={t("pa.code.ph")} className="h-11 flex-1 text-center font-mono text-xl tracking-[0.4em]" />
        <Button type="submit" disabled={busy || code.length !== 6} className="h-11 rounded-xl">{busy ? <Loader2 className="size-4 animate-spin" /> : t("pa.code.submit")}</Button>
      </div>
      {result === "ok" && <p role="status" className="mt-2 text-sm font-semibold text-emerald-800">{t("pa.code.ok")}</p>}
      {result === "bad" && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{t("pa.code.bad")}</p>}
      {result === "err" && <p role="alert" className="mt-2 text-sm text-destructive">{t("err.generic")}</p>}
    </form>
  );
}

function BillBox({ job }: { job: ProJob }) {
  const { t } = useT();
  const [f, setF] = useState({ visit_fee: (job.visit_charge ?? "").replace(/[^\d]/g, "").slice(0, 6), labour: "", parts: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { flagged: boolean }>(null);
  const [error, setError] = useState("");
  const num = (s: string) => (Number(s.replace(/[^\d.]/g, "")) || 0);
  const total = num(f.visit_fee) + num(f.labour) + num(f.parts);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/pro/jobs/${job.id}/bill`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setError(t("err.generic"));
      else setDone({ flagged: !!b.flagged });
    } catch {
      setError(t("err.network"));
    }
    setBusy(false);
  }
  if (done) return <p role="status" className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{t("pa.bill.sent")}{done.flagged && <span className="mt-1 block text-xs font-normal text-amber-900">{t("pa.bill.high")}</span>}</p>;
  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl border bg-muted/50 p-3">
      <p className="text-sm font-semibold">{t("pa.bill.title")}</p>
      {job.visit_charge && <p className="mt-0.5 text-xs text-foreground/75">{t("pa.bill.quote", { q: [job.visit_charge, job.labour_estimate].filter(Boolean).join(" + ") })}</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(["visit_fee", "labour", "parts"] as const).map((k) => (
          <label key={k} className="text-xs font-medium">
            {t(`pa.bill.${k === "visit_fee" ? "visit" : k}`)}
            <Input inputMode="numeric" value={f[k]} onChange={set(k)} className="mt-1 h-10 text-base" />
          </label>
        ))}
      </div>
      <p className="mt-2 text-base font-bold">{t("pa.bill.total", { n: total.toLocaleString("en-IN") })}</p>
      {error && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || total <= 0} className="mt-2 h-11 w-full rounded-xl">{busy ? <Loader2 className="size-4 animate-spin" /> : t("pa.bill.submit")}</Button>
    </form>
  );
}

function JobCard({ job }: { job: ProJob }) {
  const { t } = useT();
  return (
    <article className="rounded-3xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug">{t(`cat.${job.category}`)}</h2>
        <Chip status={job.status} />
      </div>
      <p className="mt-1.5 text-sm leading-snug"><span className="font-medium">{t("pv.problem")}:</span> {job.problem}{job.notes ? ` (${job.notes})` : ""}</p>
      <div className="mt-3 space-y-2 text-sm">
        <p className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> <span className="text-foreground/70">{t("pv.location")}:</span> {job.sector}</p>
        {job.requested && <p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> <span className="text-foreground/70">{t("pv.requested")}:</span> {slotText(job.requested, t)}</p>}
        {job.slot && <p className="flex flex-wrap items-center gap-2"><CalendarClock className="size-4 text-primary" /> {job.slot} {!job.slot_exact && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{t("row.exact.no")}</span>}</p>}
        {job.visit_charge && <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> {t("row.visit")}: {job.visit_charge}</p>}
        <div className="rounded-2xl bg-muted p-3">
          {job.address ? <p className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {job.address}, {job.sector}</p> : <p className="flex items-center gap-2 text-foreground/75"><Lock className="size-4" /> {t("pv.address.hidden")}</p>}
        </div>
      </div>
      {job.can_confirm_arrival && <ArriveBox id={job.id} />}
      {job.status === "pro_arrived" && <p role="status" className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{t("pa.arrive.wait")}</p>}
      {job.can_enter_code && <><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800"><Check className="size-4" /> {t("pa.arrive.verified")}</p><CodeBox id={job.id} /></>}
      {job.completed && <p role="status" className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-900">{t("pa.closed")}</p>}
      {job.can_send_bill && <BillBox job={job} />}
      {job.bill && <p className="mt-3 text-sm">{t("pa.bill.title")}: ₹{job.bill.total.toLocaleString("en-IN")}</p>}
    </article>
  );
}

export default function ProJobs() {
  return <ProShell>{() => <Jobs />}</ProShell>;
}

function Jobs() {
  const { t } = useT();
  const [tab, setTab] = useState<ProTab>("booked");
  const list = usePoll<{ jobs: ProJob[] }>("/api/pro/jobs", 2500);
  const jobs = list.data?.jobs ?? null;
  const inTab = (j: ProJob, k: ProTab) => (k === "today" ? j.tab === "booked" && j.today : j.tab === k);
  const shown = (jobs ?? []).filter((j) => inTab(j, tab)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const count = (k: ProTab) => (jobs ?? []).filter((j) => inTab(j, k)).length;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("pa.title")}</h1>
      <p className="mt-2 rounded-2xl bg-accent px-4 py-3 text-xs text-accent-foreground">{t("pv.note")}</p>
      <div role="tablist" aria-label={t("pa.title")} className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border bg-card p-1 text-xs font-medium">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`rounded-xl px-1 py-2 transition ${tab === k ? "bg-primary text-primary-foreground" : "text-foreground/75"}`}>
            {t(`pa.tab.${k}`)}{count(k) ? ` (${count(k)})` : ""}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {list.error && !jobs && <StateBox title={t("err.conn")} />}
        {!jobs && !list.error && <StateBox title={t("loading.title")} />}
        {jobs && shown.length === 0 && <StateBox title={t("pa.empty")} body={t("pa.empty.body")} />}
        {shown.map((j) => <JobCard key={j.id} job={j} />)}
      </div>
    </>
  );
}
