"use client";
import { useT } from "@/lib/lang";
import { Reveal } from "./Reveal";
import { TrustIcon, type TrustIconName } from "./TrustIcon";

const CARDS: TrustIconName[] = ["ai", "consent", "address", "reconfirm", "code", "approved"];

/** Trust by design: six promises, each with its own small icon. */
export function TrustSection() {
  const { t } = useT();
  return (
    <section aria-labelledby="trust-h" className="mx-auto w-full max-w-6xl px-5 py-12">
      <Reveal><h2 id="trust-h" className="text-3xl font-bold tracking-tight md:text-4xl">{t("lp.trust.title")}</h2><p className="mt-2 max-w-2xl text-base text-foreground/80">{t("lp.trust.sub")}</p></Reveal>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((name, i) => (
          <li key={name}>
            <Reveal delay={(i % 3) as 0 | 1 | 2} className="h-full">
              <div className="h-full rounded-3xl border bg-card p-5">
                <TrustIcon name={name} />
                <h3 className="mt-3 text-base font-semibold leading-snug">{t(`lp.trust.${name}.t`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/75">{t(`lp.trust.${name}.d`)}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
