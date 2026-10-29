"use client";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/lang";

export const FAQ_COUNT = 10;

/** The questions people ask, as an accordion (native details/summary, so it works without JavaScript). */
export function Faq() {
  const { t } = useT();
  return (
    <div className="lp-faq divide-y rounded-3xl border bg-card">
      {Array.from({ length: FAQ_COUNT }, (_, i) => i + 1).map((n) => (
        <details key={n} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
            {t(`faq.q${n}`)}
            <ChevronDown className="size-4 shrink-0 text-primary transition group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{t(`faq.a${n}`)}</p>
        </details>
      ))}
    </div>
  );
}
