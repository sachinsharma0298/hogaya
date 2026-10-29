"use client";
import { useT } from "@/lib/lang";
import { Reveal } from "./Reveal";

/** How pricing works, in four plain points. Each one is what the code really does (options table, final bill, bill check). */
export function PricingBlock() {
  const { t } = useT();
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-12">
      <Reveal><h2 id="pricing-h" className="text-3xl font-bold tracking-tight md:text-4xl">{t("lp.price.title")}</h2><p className="mt-2 max-w-2xl text-base text-foreground/80">{t("lp.price.sub")}</p></Reveal>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>
            <Reveal delay={(n - 1) as 0 | 1 | 2 | 3} className="h-full">
              <div className="h-full rounded-3xl border bg-card p-5">
                <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground" aria-hidden="true">{n}</span>
                <h3 className="mt-3 text-base font-semibold leading-snug">{t(`lp.price.${n}.t`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">{t(`lp.price.${n}.d`)}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
