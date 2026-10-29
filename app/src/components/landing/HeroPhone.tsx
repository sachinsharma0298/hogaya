"use client";
import { PhoneCall } from "lucide-react";
import { useT } from "@/lib/lang";
import { PhoneFrame } from "./PhoneFrame";

const WAVE = [0.1, 0.5, 0.25, 0.7, 0.4, 0.9, 0.3, 0.6, 0.15, 0.8, 0.35, 0.55, 0.2];

/** The journey in one phone: problem typed, the AI calling a pro, the options with a recommendation, then Booked. Every word comes from the translations. */
export function HeroPhone() {
  const { t } = useT();
  return (
    <PhoneFrame label={t("lp.m.alt")}>
      {/* 1. the problem is typed */}
      <div className="lp-frame lp-frame-1 absolute inset-0 flex flex-col gap-2.5 p-4 pt-8">
        <p className="text-[11px] font-semibold text-foreground/70">{t("lp.m.q")}</p>
        <div className="rounded-xl border bg-card p-2.5 text-[13px] leading-snug">
          <span className="lp-type">{t("lp.m.problem")}</span>
          <span className="lp-caret mt-1 inline-block h-3.5 w-px bg-foreground align-middle" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-primary bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">{t("cat.electrician.short")}</span>
          <span className="rounded-full border bg-card px-2.5 py-1 text-[11px] text-foreground/70">{t("cat.plumber.short")}</span>
        </div>
        <span className="mt-auto rounded-xl bg-primary py-2.5 text-center text-[12px] font-semibold text-primary-foreground">{t("lp.m.send")}</span>
      </div>

      {/* 2. the AI assistant calls a pro */}
      <div className="lp-frame lp-frame-2 absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        <div className="relative grid size-20 place-items-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 size-full" aria-hidden="true"><g className="lp-ring"><circle cx="40" cy="40" r="30" fill="none" stroke="#d9600b" strokeWidth="2" /></g><g className="lp-ring" style={{ animationDelay: "0.8s" }}><circle cx="40" cy="40" r="30" fill="none" stroke="#d9600b" strokeWidth="2" /></g></svg>
          <span className="relative grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"><PhoneCall className="size-6" /></span>
        </div>
        <svg viewBox="0 0 130 36" className="h-9 w-32" aria-hidden="true">{WAVE.map((h, i) => <g key={i} className="lp-wave" style={{ animationDelay: `${(i % 6) * 0.13}s` }}><rect x={i * 10 + 2} y={18 - h * 17} width="6" height={h * 34} rx="3" fill="#d9600b" /></g>)}</svg>
        <p className="text-[12px] font-semibold">{t("lp.m.calling")}</p>
        <p className="rounded-2xl rounded-tl-sm bg-accent px-3 py-2 text-center text-[12px] font-medium text-accent-foreground">“{t("lp.m.ai")}”</p>
      </div>

      {/* 3. options with a recommendation */}
      <div className="lp-frame lp-frame-3 absolute inset-0 flex flex-col gap-2 p-4 pt-8">
        <p className="text-[11px] font-semibold text-foreground/70">{t("lp.m.options")}</p>
        {[1, 2].map((n) => (
          <div key={n} className={`rounded-xl border bg-card p-2.5 ${n === 1 ? "border-primary ring-2 ring-primary/25" : ""}`}>
            {n === 1 && <span className="mb-1.5 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{t("lp.m.recommends")}</span>}
            <div className="flex items-center gap-2">
              <span aria-hidden className="size-7 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{t(`lp.m.pro${n}`)}</p><p className="text-[10.5px] text-foreground/70">{t(`lp.m.time${n}`)} · {t(`lp.m.charge${n}`)}</p></div>
            </div>
          </div>
        ))}
        <span className="mt-auto rounded-xl bg-primary py-2.5 text-center text-[12px] font-semibold text-primary-foreground">{t("lp.m.confirm")}</span>
      </div>

      {/* 4. booked */}
      <div className="lp-frame lp-frame-4 absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        <svg viewBox="0 0 80 80" className="size-20" aria-hidden="true"><circle cx="40" cy="40" r="36" fill="#d6f0e0" /><circle cx="40" cy="40" r="26" fill="#2f9e63" /><path className="lp-tick" d="M28 41l9 9 16-18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <p className="text-lg font-bold text-emerald-800">{t("lp.m.booked")}</p>
        <p className="text-center text-[11.5px] leading-snug text-foreground/75">{t("lp.m.booked.sub")}</p>
      </div>
    </PhoneFrame>
  );
}
