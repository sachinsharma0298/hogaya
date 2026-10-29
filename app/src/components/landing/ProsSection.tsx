"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/lang";
import { BenefitIcon, type BenefitIconName } from "./BenefitIcon";
import { ProToolbox } from "./ProToolbox";
import { Reveal } from "./Reveal";

const JOIN: { k: string; icon: BenefitIconName }[] = [{ k: "j1", icon: "signup" }, { k: "j2", icon: "consent" }, { k: "j3", icon: "approval" }, { k: "j4", icon: "calls" }];
const BENEFITS: { k: string; icon: BenefitIconName }[] = [{ k: "b1", icon: "jobs" }, { k: "b2", icon: "trips" }, { k: "b3", icon: "score" }];

/** For pros: how to join, and why. */
export function ProsSection() {
  const { t } = useT();
  return (
    <section id="pros" aria-labelledby="pros-h" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 py-12">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <Reveal>
          <h2 id="pros-h" className="text-3xl font-bold tracking-tight md:text-4xl">{t("lp.pro.title")}</h2>
          <p className="mt-2 text-base text-foreground/80">{t("lp.pro.sub")}</p>
          <ProToolbox className="mt-6 md:hidden" />
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-primary">{t("lp.pro.join")}</h3>
          <ol className="mt-3 space-y-3">
            {JOIN.map(({ k, icon }, i) => (
              <li key={k} className="flex items-start gap-3">
                <BenefitIcon name={icon} />
                <div><p className="font-semibold leading-snug">{i + 1}. {t(`lp.pro.${k}.t`)}</p><p className="text-sm leading-snug text-foreground/75">{t(`lp.pro.${k}.d`)}</p></div>
              </li>
            ))}
          </ol>
          <Link href="/pro/join" className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground">{t("lp.cta.pro")} <ArrowRight className="size-4" /></Link>
        </Reveal>
        <Reveal delay={1} className="space-y-6">
          <ProToolbox className="hidden md:block" />
          <ul className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {BENEFITS.map(({ k, icon }) => (
              <li key={k} className="rounded-2xl border bg-card p-4">
                <BenefitIcon name={icon} className="size-9" />
                <p className="mt-2 text-[15px] font-semibold leading-snug">{t(`lp.pro.${k}.t`)}</p>
                <p className="mt-0.5 text-sm leading-snug text-foreground/75">{t(`lp.pro.${k}.d`)}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
