"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { CustomerShell, StateBox } from "@/components/brand";
import { StateChip } from "@/app/operator/booking-list";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/lang";
import { usePoll } from "@/lib/use-poll";
import type { BookingState } from "@/lib/types";

interface Row { id: string; category: string; problem: string; sector: string; state: BookingState; created_at: string }

export default function MyBookings() {
  const { t } = useT();
  const router = useRouter();
  const { loading, user } = useSession();
  const list = usePoll<{ bookings: Row[] }>("/api/me/bookings", 3000);
  useEffect(() => {
    if (!loading && (!user || user.role !== "customer")) router.replace("/login?next=/me");
  }, [loading, user, router]);

  if (loading || !user) return <CustomerShell><StateBox title={t("loading.title")} /></CustomerShell>;
  const rows = list.data?.bookings ?? null;
  return (
    <CustomerShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("me.title")}</h1>
        <Link href="/book" className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> {t("me.new")}</Link>
      </div>
      <p className="mt-1 text-sm text-foreground/75">{user.name}</p>
      <div className="mt-5 space-y-3 pb-24 md:pb-0">
        {list.error && !rows && <StateBox title={t("err.conn")} />}
        {!rows && !list.error && <StateBox title={t("loading.title")} />}
        {rows && rows.length === 0 && (
          <>
            <StateBox title={t("me.empty.title")} body={t("me.empty.body")} />
            <Link href="/book"><Button className="mt-3 h-12 w-full rounded-2xl text-base">{t("me.new")}</Button></Link>
          </>
        )}
        {rows?.map((r) => (
          <Link key={r.id} href={`/b/${r.id}`} className="flex items-center gap-3 rounded-3xl border bg-card p-4 transition hover:border-primary/60">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{t(`cat.${r.category}`)}</span><StateChip state={r.state} /></div>
              <p className="mt-0.5 truncate text-sm text-foreground/85">{r.problem}</p>
              <p className="mt-0.5 text-xs text-foreground/65">{r.sector} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-foreground/50" />
          </Link>
        ))}
      </div>
    </CustomerShell>
  );
}
