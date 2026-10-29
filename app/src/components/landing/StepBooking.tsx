"use client";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/lang";
import { PhoneFrame } from "./PhoneFrame";

const bar = (w: string) => <span className="block h-2 rounded bg-foreground/15" style={{ width: w }} />;

/** The booking form, simplified: Location, Address and a time-slot chip being selected. Labels come from the translations. */
export function StepBooking() {
  const { t } = useT();
  return (
    <PhoneFrame label={t("lp.s1.alt")}>
      <div className="absolute inset-0 flex flex-col gap-2.5 p-4 pt-8">
        <div className="space-y-1"><p className="text-[10.5px] font-semibold">{t("f.sector")}</p><div className="rounded-lg border bg-card p-2">{bar("55%")}</div></div>
        <div className="space-y-1"><p className="text-[10.5px] font-semibold">{t("f.address")}</p><div className="space-y-1.5 rounded-lg border bg-card p-2">{bar("85%")}{bar("40%")}</div></div>
        <p className="flex items-start gap-1 text-[9.5px] leading-tight text-foreground/70"><ShieldCheck className="mt-px size-3 shrink-0" />{t("f.privacy")}</p>
        <div className="space-y-1"><p className="text-[10.5px] font-semibold">{t("f.when")}</p>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded-full border bg-card px-2 py-1">{t("slot.within2")}</span>
            <span className="lp-chip-pick rounded-full border px-2 py-1 font-medium">{t("slot.evening")}</span>
            <span className="rounded-full border bg-card px-2 py-1">{t("slot.tomorrow_am")}</span>
          </div>
        </div>
        <span className="mt-auto rounded-xl bg-primary py-2.5 text-center text-[11.5px] font-semibold text-primary-foreground">{t("nav.next")}</span>
      </div>
    </PhoneFrame>
  );
}
