"use client";
import Link from "next/link";
import { BookCta } from "@/components/cta";
import { Faq } from "@/components/landing/Faq";
import { KbIllustration, type KbKind } from "@/components/landing/KbIllustration";
import { GUIDES } from "@/components/landing/KnowledgeBase";
import { ProToolbox } from "@/components/landing/ProToolbox";
import { Reveal } from "@/components/landing/Reveal";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { StepBooking } from "@/components/landing/StepBooking";
import { StepCall } from "@/components/landing/StepCall";
import { StepOptions } from "@/components/landing/StepOptions";
import { StepProJob } from "@/components/landing/StepProJob";
import { DoorCodeScene } from "@/components/landing/DoorCodeScene";
import { useT } from "@/lib/lang";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

// The same mockups and illustrations as the landing page, placed next to the step they explain.
const VISUALS: Record<string, React.ReactNode> = {
  c3: <StepBooking />, c4: <StepCall />, c5: <StepOptions />, c7: <DoorCodeScene />,
  p1: <ProToolbox />, p4: <StepCall />, p5: <StepProJob />,
};

function Guide({ kind }: { kind: KbKind }) {
  const { t } = useT();
  const steps = GUIDES[kind].steps;
  return (
    <section id={kind} aria-labelledby={`${kind}-h`} className="scroll-mt-20 py-8">
      <Reveal className="flex items-center gap-4">
        <KbIllustration kind={kind} className="w-28 shrink-0 sm:w-36" />
        <div>
          <h2 id={`${kind}-h`} className="text-2xl font-bold tracking-tight md:text-3xl">{t(`kb.tab.${kind}`)}</h2>
          <p className="mt-1 text-sm text-foreground/80">{t(`help.${kind}.intro`)}</p>
        </div>
      </Reveal>
      <ol className="mt-6 space-y-5">
        {steps.map((k, i) => (
          <li key={k}>
            <Reveal className="grid items-center gap-4 rounded-3xl border bg-card p-5 sm:grid-cols-[1fr_auto]">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <div><h3 className="text-base font-semibold leading-snug">{t(`help.${k}.t`)}</h3><p className="mt-1 text-sm leading-relaxed text-foreground/80">{t(`help.${k}.d`)}</p>{k === "c9" && <Link href="/voice" className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-4">{t("faq.more.voice")} →</Link>}</div>
              </div>
              {VISUALS[k] && <div className="mx-auto w-full max-w-[210px] sm:w-[210px]">{VISUALS[k]}</div>}
            </Reveal>
          </li>
        ))}
      </ol>
      {kind === "judges" && <p className="mt-4 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">{t("help.judges.note")}</p>}
    </section>
  );
}

/** The full guide: step by step for customers, pros, and judges & testers, then the questions people ask. */
export default function HelpPage() {
  const { t } = useT();
  return (
    <div className="flex-1">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl px-5 pb-8">
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{t("help.title")}</h1>
        <p className="mt-2 max-w-2xl text-base text-foreground/80">{t("help.sub")}</p>
        <nav aria-label={t("help.title")} className="mt-5 flex flex-wrap gap-2 text-sm font-medium">
          {(["customers", "pros", "judges"] as const).map((k) => <a key={k} href={`#${k}`} className="rounded-full border bg-card px-4 py-2 hover:border-primary/60">{t(`kb.tab.${k}`)}</a>)}
          <a href="#faq" className="rounded-full border bg-card px-4 py-2 hover:border-primary/60">{t("faq.title")}</a>
        </nav>
        <Guide kind="customers" />
        <Guide kind="pros" />
        <Guide kind="judges" />
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 py-8">
          <h2 id="faq-h" className="mb-5 text-2xl font-bold tracking-tight md:text-3xl">{t("faq.title")}</h2>
          <Faq />
          <p className="mt-5 text-sm text-foreground/80">{CONTACT ? <>{t("help.contact")} <a href={`mailto:${CONTACT}`} className="font-medium text-primary underline underline-offset-4">{CONTACT}</a></> : t("help.contact.none")}</p>
        </section>
        <p className="py-6 text-center"><BookCta /></p>
      </main>
      <SiteFooter />
    </div>
  );
}
