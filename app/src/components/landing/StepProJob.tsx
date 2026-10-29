"use client";
import { CalendarClock, Lock, MapPin } from "lucide-react";
import { useT } from "@/lib/lang";
import { PhoneFrame } from "./PhoneFrame";

/** The Pro app job card: the address is locked until the booking is confirmed, then the map pin unlocks and the card says Booked. */
export function StepProJob() {
  const { t } = useT();
  return (
    <PhoneFrame label={t("lp.s4.alt")}>
      <div className="absolute inset-0 flex flex-col gap-2.5 p-4 pt-8">
        <p className="text-[11px] font-semibold text-foreground/70">{t("lp.m.proapp")}</p>
        <div className="rounded-2xl border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-semibold leading-tight">{t("cat.electrician")}</p>
            <span className="lp-pop rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{t("lp.m.booked")}</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-foreground/80"><MapPin className="size-3 text-primary" />{t("lp.m.loc")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-foreground/80"><CalendarClock className="size-3 text-primary" />{t("lp.m.time1")}</p>
        </div>
        <div className="relative flex-1 overflow-hidden rounded-2xl border bg-[#e9f3ea]">
          <svg viewBox="0 0 160 120" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path d="M-10 40h180M-10 82h180M50-10v140M112-10v140" stroke="#fff" strokeWidth="9" /><path d="M-10 62l180-18" stroke="#fff" strokeWidth="5" />
            <rect x="60" y="48" width="26" height="22" rx="4" fill="#cfe0d2" /><rect x="118" y="86" width="30" height="20" rx="4" fill="#cfe0d2" />
            <g className="lp-pin-drop"><path d="M82 56c-9 0-15 6-15 14 0 10 15 24 15 24s15-14 15-24c0-8-6-14-15-14z" fill="#d9600b" /><circle cx="82" cy="70" r="5" fill="#fff" /></g>
          </svg>
          <span className="lp-lock-fade absolute inset-0 grid place-items-center bg-foreground/55"><span className="grid size-10 place-items-center rounded-full bg-background text-foreground"><Lock className="size-5" /></span></span>
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-background/90 px-2 py-1.5 text-[10px] font-medium leading-tight">{t("lp.m.unlock")}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}
