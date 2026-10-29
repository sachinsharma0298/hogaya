"use client";
import { useState } from "react";
import { BadgeCheck, Clock, Loader2, ShieldCheck, Star } from "lucide-react";
import { StateBox } from "@/components/brand";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type Category } from "@/lib/categories";
import { useT } from "@/lib/lang";
import { usePoll } from "@/lib/use-poll";
import type { Provider } from "@/lib/types";
import { ProShell } from "../pro-shell";

interface ProfileData { provider: Provider; review: "pending" | "approved" | "rejected"; stats: { jobs: number; rating_count: number; avg_rating: number | null } }

export default function ProProfile() {
  return <ProShell>{() => <Profile />}</ProShell>;
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const digits = (s?: string) => (s ?? "").replace(/[^\d]/g, "");

function Profile() {
  const { data, error } = usePoll<ProfileData>("/api/pro/profile", 10000);
  const { t } = useT();
  if (!data) return error ? <StateBox title={t("err.conn")} /> : <StateBox title={t("loading.title")} />;
  return <ProfileView key={data.provider.id} data={data} />;
}

function ProfileView({ data }: { data: ProfileData }) {
  const { t } = useT();
  const { provider: p, review, stats } = data;
  const cur = (p.categories ?? [p.category]) as Category[];
  const [f, setF] = useState({ name: p.name, area: p.area ?? "", visit_charge: digits(p.visit_charge), working_hours: p.working_hours ?? "", bio: p.bio ?? "" });
  const [cats, setCats] = useState<Category[]>(cur);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(p.pending_changes);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggle = (c: Category) => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const hasPending = Boolean(pending && (pending.categories || pending.area || pending.visit_charge));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/pro/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats }) });
    const b = (await res.json().catch(() => ({}))) as { pending?: boolean };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: t("pp.err") });
    setMsg({ ok: true, text: t(b.pending ? "pp.saved.pending" : "pp.saved") });
    const fresh = (await (await fetch("/api/pro/profile", { cache: "no-store" })).json().catch(() => null)) as ProfileData | null;
    setPending(fresh?.provider.pending_changes);
  }

  const statusTone = review === "approved" ? "bg-emerald-100 text-emerald-800" : review === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  const consent = p.consent_date ? t("pp.consent.on", { date: p.consent_date.slice(0, 10) }) : t("pp.consent.none");
  return (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{initials(p.name)}</span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{p.name}</h1>
          <p className="text-sm text-foreground/75">{t("pp.title")}</p>
        </div>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70"><BadgeCheck className="size-3.5 text-primary" /> {t("pp.status")}</p>
          <p className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone}`}>{t(`pp.status.${review}`)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70"><ShieldCheck className="size-3.5 text-primary" /> {t("pp.consent")}</p>
          <p className="mt-1.5 leading-snug">{consent}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70"><Star className="size-3.5 text-primary" /> {t("pp.reliability")}</p>
          <p className="mt-1 text-2xl font-bold">{p.reliability}<span className="text-sm font-normal text-foreground/70">/100</span></p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${p.reliability}%` }} /></div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70"><Clock className="size-3.5 text-primary" /> {t("pp.jobs")}</p>
          <p className="mt-1 text-2xl font-bold">{stats.jobs}</p>
          <p className="text-xs text-foreground/75">{t("pp.rating")}: {stats.avg_rating === null ? t("pp.rating.none") : t("pp.rating.of", { avg: stats.avg_rating, n: stats.rating_count })}</p>
        </div>
      </section>

      {hasPending && pending && (
        <section role="status" className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">{t("pp.pending")}</p>
          <ul className="mt-1 space-y-0.5">
            {pending.categories && <li>{t("pp.pending.cats")}: {pending.categories.map((c) => t(`cat.${c}`)).join(", ")}</li>}
            {pending.area && <li>{t("pp.pending.area")}: {pending.area}</li>}
            {pending.visit_charge && <li>{t("pp.pending.visit")}: {pending.visit_charge}</li>}
          </ul>
          <p className="mt-1 text-xs">{t("pp.pending.help")}</p>
        </section>
      )}

      <form onSubmit={save} className="mt-4 space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-base font-semibold">{t("pp.edit")}</h2>
        <div className="space-y-1.5"><Label htmlFor="pp-name">{t("pp.name")}</Label><Input id="pp-name" value={f.name} onChange={set("name")} className="h-11 text-base" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-phone">{t("pp.phone")}</Label>
          <div aria-disabled className="pointer-events-none opacity-60"><PhoneField id="pp-phone" value={p.phone.startsWith("+") ? p.phone : p.phone ? `+${p.phone}` : ""} onChange={() => {}} className="h-11 text-base" /></div>
          <p className="text-xs text-foreground/70">{t("pp.phone.note")}</p>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t("pp.categories")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1.5 text-xs ${cats.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{t(`cat.${c}`)}</button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="pp-area">{t("pp.area")}</Label><Input id="pp-area" value={f.area} onChange={set("area")} className="h-11 text-base" /></div>
          <div className="space-y-1.5"><Label htmlFor="pp-visit">{t("pp.visit")}</Label><Input id="pp-visit" inputMode="numeric" value={f.visit_charge} onChange={set("visit_charge")} className="h-11 text-base" /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="pp-hours">{t("pp.hours")}</Label><Input id="pp-hours" value={f.working_hours} onChange={set("working_hours")} placeholder={t("pp.hours.ph")} className="h-11 text-base" /></div>
        <div className="space-y-1.5"><Label htmlFor="pp-bio">{t("pp.bio")}</Label><Textarea id="pp-bio" rows={3} maxLength={300} value={f.bio} onChange={set("bio")} placeholder={t("pp.bio.ph")} className="text-base" /></div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base">{busy ? <Loader2 className="size-4 animate-spin" /> : t("pp.save")}</Button>
      </form>
    </>
  );
}
