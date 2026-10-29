"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CustomerShell, StateBox } from "@/components/brand";
import { stateChipClass } from "@/app/operator/booking-list";
import { AccountBanner } from "@/components/account-banner";
import { useSession } from "@/components/session";
import { BookCta } from "@/components/cta";
import { CallLangPicker, defaultCallLang } from "@/components/call-lang-picker";
import type { CallLang } from "@/lib/call-scripts/hogaya-context";
import { useT } from "@/lib/lang";
import { usePoll } from "@/lib/use-poll";
import type { BookingState } from "@/lib/types";

interface Row { id: string; category: string; problem: string; sector: string; state: BookingState; created_at: string }

/** The customer's call language: saved as soon as they pick one. */
function CallLanguage() {
  const { t, lang } = useT();
  const [stored, setStored] = useState<CallLang | null | undefined>(undefined); // undefined = still loading
  const [saved, setSaved] = useState(false);
  useEffect(() => { fetch("/api/me/call-lang", { cache: "no-store" }).then((r) => r.json()).then((b) => setStored(b.call_lang ?? null)).catch(() => setStored(null)); }, []);
  if (stored === undefined) return null;
  const value = stored ?? defaultCallLang(lang);
  async function pick(v: CallLang) {
    setStored(v);
    try {
      const res = await fetch("/api/me/call-lang", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ call_lang: v }) });
      setSaved(res.ok);
    } catch {
      setSaved(false);
    }
  }
  return (
    <section className="mt-4 rounded-3xl border bg-card p-4">
      <CallLangPicker value={value} onChange={pick} />
      {saved && <p role="status" className="mt-2 text-xs text-emerald-800">{t("calllang.saved")}</p>}
    </section>
  );
}

export default function MyBookings() {
  const { t } = useT();
  const router = useRouter();
  const { loading, user } = useSession();
  const list = usePoll<{ bookings: Row[] }>("/api/me/bookings", 3000);
  useEffect(() => {
    if (!loading && (!user || (user.role !== "customer" && user.role !== "operator"))) router.replace("/login?next=/me");
  }, [loading, user, router]);

  if (loading || !user) return <CustomerShell><StateBox title={t("loading.title")} /></CustomerShell>;
  const rows = list.data?.bookings ?? null;
  return (
    <CustomerShell>
      <AccountBanner />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("me.title")}</h1>
        <BookCta size="sm" />
      </div>
      <p className="mt-1 text-sm text-foreground/75">{user.name}</p>
      <CallLanguage />
      <div className="mt-5 space-y-3 pb-24 md:pb-0">
        {list.error && !rows && <StateBox title={t("err.conn")} />}
        {!rows && !list.error && <StateBox title={t("loading.title")} />}
        {rows && rows.length === 0 && (
          <>
            <StateBox title={t("me.empty.title")} body={t("me.empty.body")} />
            <BookCta className="mt-3 w-full" />
          </>
        )}
        {rows?.map((r) => (
          <Link key={r.id} href={`/b/${r.id}`} className="flex items-center gap-3 rounded-3xl border bg-card p-4 transition hover:border-primary/60">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{t(`cat.${r.category}`)}</span><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stateChipClass(r.state)}`}>{t(`st.${r.state}`)}</span></div>
              <p className="mt-0.5 truncate text-sm text-foreground/85">{r.problem}</p>
              <p className="mt-0.5 text-xs text-foreground/70">{r.sector} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-foreground/70" />
          </Link>
        ))}
      </div>
    </CustomerShell>
  );
}
