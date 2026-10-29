"use client";
import { useT } from "@/lib/lang";

/** Two option cards side by side. One is marked "Hogaya recommends"; a finger taps it and a green tick appears. */
export function StepOptions() {
  const { t } = useT();
  return (
    <div role="img" aria-label={t("lp.s3.alt")} className="relative mx-auto w-full max-w-[300px] rounded-3xl border bg-background p-3.5 shadow-xl">
      <p className="mb-2 text-[11px] font-semibold text-foreground/70">{t("lp.m.options")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {[1, 2].map((n) => (
          <div key={n} className={`relative rounded-2xl border bg-card p-2.5 ${n === 1 ? "border-primary ring-2 ring-primary/25" : ""}`}>
            <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[9.5px] font-bold ${n === 1 ? "bg-primary text-primary-foreground" : "invisible"}`}>{t("lp.m.recommends")}</span>
            <span aria-hidden className="block size-8 rounded-full bg-accent" />
            <p className="mt-1.5 text-[12px] font-semibold leading-tight">{t(`lp.m.pro${n}`)}</p>
            <p className="mt-0.5 text-[10.5px] leading-tight text-foreground/70">{t(`lp.m.time${n}`)}</p>
            <p className="text-[10.5px] leading-tight text-foreground/70">{t(`lp.m.charge${n}`)}</p>
            {n === 1 && (
              <>
                <svg viewBox="0 0 28 28" className="lp-pop absolute -right-2 -top-2 size-7" aria-hidden="true"><circle cx="14" cy="14" r="14" fill="#2f9e63" /><path className="lp-tick-loop" d="M8 14.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg viewBox="0 0 40 40" className="lp-finger absolute bottom-1 right-1 size-9" aria-hidden="true"><path d="M17 6a3 3 0 0 1 6 0v14l3-1.5a3 3 0 0 1 4 3.5l-2 10a5 5 0 0 1-5 4h-5a6 6 0 0 1-5-3l-5-8a3 3 0 0 1 4.6-3.6L17 24z" fill="#fff" stroke="#231a12" strokeWidth="2" strokeLinejoin="round" /></svg>
              </>
            )}
          </div>
        ))}
      </div>
      <span className="mt-3 block rounded-xl bg-primary py-2 text-center text-[11.5px] font-semibold text-primary-foreground">{t("lp.m.confirm")}</span>
    </div>
  );
}
