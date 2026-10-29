"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Brand, LangToggle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/lang";

interface Stats { total: number; live: number; completed: number; flagged: number; pending: number; calls_week: number }
const STATS: { k: keyof Stats; label: string }[] = [
  { k: "total", label: "op.stat.total" }, { k: "live", label: "op.stat.live" }, { k: "completed", label: "op.stat.completed" },
  { k: "flagged", label: "op.stat.flagged" }, { k: "pending", label: "op.stat.pending" }, { k: "calls_week", label: "op.stat.calls" },
];
const initials = (n: string, fallback: string) => (n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || fallback.slice(0, 1).toUpperCase());

/** The operator's own display name and phone, with a summary of what is going on. Email and password are not editable here. */
export default function OperatorProfile() {
  const { t } = useT();
  const [f, setF] = useState({ name: "", phone: "" });
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/operator/profile", { cache: "no-store" }).then((r) => r.json()).then((b) => {
      setF({ name: b.name ?? "", phone: b.phone ?? "" });
      setEmail(b.email ?? "");
      setStats(b.stats ?? null);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/operator/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: t("op.saved") } : { ok: false, text: t(res.status === 400 ? "op.err.name" : res.status === 409 ? "op.err.phone" : "op.err.save") });
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <Brand small />
        <div className="flex items-center gap-3">
          <LangToggle />
          <Link href="/operator" className="text-sm text-primary underline-offset-4 hover:underline">← {t("op.back")}</Link>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{initials(f.name, email)}</span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{f.name || t("op.title")}</h1>
          <p className="truncate text-sm text-foreground/75">{t("op.role")} · {email}</p>
        </div>
      </div>

      <section aria-label={t("op.stats")} className="mb-4 rounded-3xl border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("op.stats")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {STATS.map(({ k, label }) => (
            <div key={k} className="rounded-2xl bg-muted/60 px-3 py-2.5">
              <dd className="text-xl font-bold leading-none">{stats ? stats[k] : "–"}</dd>
              <dt className="mt-1 text-[11px] leading-tight text-foreground/70">{t(label)}</dt>
            </div>
          ))}
        </dl>
      </section>

      <form onSubmit={save} className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("op.title")}</h2>
        <div className="space-y-1.5"><Label htmlFor="op-name">{t("op.name")}</Label><Input id="op-name" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} disabled={!loaded} className="h-11 text-base" /></div>
        <div className="space-y-1.5"><Label htmlFor="op-phone">{t("op.phone")}</Label>{loaded ? <PhoneField id="op-phone" value={f.phone} onChange={(v) => setF((p) => ({ ...p, phone: v }))} className="h-11 text-base" /> : <Input id="op-phone" disabled className="h-11" />}</div>
        <div className="space-y-1.5"><Label htmlFor="op-email">{t("op.email")}</Label><Input id="op-email" value={email} readOnly disabled className="h-11 text-base" /><p className="text-xs text-foreground/70">{t("op.email.note")}</p></div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
        <Button type="submit" disabled={busy || !loaded} className="h-12 w-full rounded-xl text-base">{busy ? <Loader2 className="size-4 animate-spin" /> : t("op.save")}</Button>
      </form>
    </div>
  );
}
