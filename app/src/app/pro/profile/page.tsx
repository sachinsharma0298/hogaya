"use client";
import { BadgeCheck, Clock, MapPin, ShieldCheck, Star, Tag } from "lucide-react";
import { StateBox } from "@/components/brand";
import { useT } from "@/lib/lang";
import { usePoll } from "@/lib/use-poll";
import type { ProJob } from "@/lib/pro-jobs";
import { ProShell } from "../pro-shell";

export default function ProProfile() {
  return <ProShell>{({ user, provider }) => <Profile name={user.name} provider={provider} />}</ProShell>;
}

function Profile({ name, provider: p }: { name: string; provider: import("@/lib/types").Provider }) {
  const { t } = useT();
  const list = usePoll<{ jobs: ProJob[] }>("/api/pro/jobs", 5000);
  const recent = [...(list.data?.jobs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const cats = p.categories ?? [p.category];
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
        <BadgeCheck className="size-4" /> {t("pa.verified")}{p.onboarded_at ? ` · ${p.onboarded_at.slice(0, 10)}` : ""}
      </p>

      <section className="mt-5 space-y-4 rounded-3xl border bg-card p-5 text-sm">
        <div>
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> {t("pa.kyc")}</p>
          <p className="mt-1 text-foreground/85">
            {p.consent_date ? t("pa.kyc.ok", { date: p.consent_date }) : t("pa.kyc.pending")}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-primary" /> {t("pa.categories")}</p>
          <p className="mt-1 flex flex-wrap gap-1.5">{cats.map((c) => <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{t(`cat.${c}`)}</span>)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><p className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-primary" /> {t("pa.area")}</p><p className="mt-1">{p.area ?? "—"}</p></div>
          <div><p className="flex items-center gap-2 font-semibold"><Clock className="size-4 text-primary" /> {t("pa.pricing")}</p><p className="mt-1">{p.visit_charge ?? "—"}</p></div>
        </div>
        <div>
          <p className="flex items-center gap-2 font-semibold"><Star className="size-4 fill-primary text-primary" /> {t("pa.reliability")}</p>
          <p className="mt-1 text-2xl font-bold">{p.reliability}<span className="text-sm font-normal text-foreground/70">/100</span></p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${p.reliability}%` }} /></div>
          <p className="mt-1 text-xs text-foreground/70">{p.on_time_pct}% · {p.jobs}</p>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("pa.recent")}</h2>
        {recent.length === 0 ? <p className="mt-2 text-sm text-foreground/70">{t("pa.nojobs")}</p> : (
          <ul className="mt-2 divide-y text-sm">
            {recent.map((j) => <li key={j.id} className="flex items-center justify-between gap-2 py-2"><span className="truncate">{t(`cat.${j.category}`)} · {j.sector}</span><span className="shrink-0 text-xs text-foreground/70">{j.status === "new" ? t("pa.status.new") : j.status === "arrived" ? t("arrival.ok") : j.status === "cancelled" ? t("pa.status.cancelled") : t(`pv.status.${j.status}`)}</span></li>)}
          </ul>
        )}
      </section>
      {!list.data && !list.error && <StateBox title={t("loading.title")} />}
    </>
  );
}
