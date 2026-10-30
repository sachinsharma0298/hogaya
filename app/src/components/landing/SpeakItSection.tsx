"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck } from "lucide-react";
import { useT } from "@/lib/lang";
import { Reveal } from "./Reveal";

// Three equal tiles. Each tile's background is the logo's own background, so no edges show.
// The Wispr Flow screenshot has a thin border and rounded corners baked in: clip-path hides them (the tile is the same cream behind it).
const TILE = "grid h-28 w-44 place-items-center overflow-hidden rounded-2xl border";

function Step({ n, tile, title, text }: { n: number; tile: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex flex-1 flex-col items-center text-center" aria-label={`${n}. ${title}`}>
      {tile}
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-[16rem] text-sm leading-snug text-foreground/85">{text}</p>
    </li>
  );
}

const Arrow = () => (
  <li aria-hidden="true" className="grid place-items-center self-center text-primary md:mt-[-3.5rem]">
    <ArrowDown className="size-6 md:hidden" />
    <ArrowRight className="hidden size-6 md:block" />
  </li>
);

/** The bottom strip of the landing page: speak, our AI calls the pro, booked. Never claims a partnership with the logos shown. */
export function SpeakItSection() {
  const { t } = useT();
  return (
    <section aria-labelledby="speak-h" className="mx-auto w-full max-w-6xl px-5 py-12">
      <Reveal><h2 id="speak-h" className="text-center text-3xl font-bold tracking-tight md:text-4xl">{t("lp.speak.title")}</h2></Reveal>
      <ol aria-label={t("lp.speak.steps")} className="mt-8 flex flex-col items-stretch gap-4 md:flex-row md:gap-3">
        <Step n={1} title={t("lp.speak.s1.t")} text={t("lp.speak.s1.d")} tile={
          <div className={TILE} style={{ backgroundColor: "#ffffed" }}>
            <Image src="/brand/wispr-flow.png" alt="Wispr Flow logo" width={226} height={140} className="h-auto w-[150px]" style={{ clipPath: "inset(11% 7%)" }} />
          </div>
        } />
        <Arrow />
        <Step n={2} title={t("lp.speak.s2.t")} text={t("lp.speak.s2.d")} tile={
          <div className={TILE} style={{ backgroundColor: "#171717" }}>
            <Image src="/brand/wajo.png" alt="Wajo logo" width={184} height={84} className="h-auto w-[140px]" />
          </div>
        } />
        <Arrow />
        <Step n={3} title={t("lp.speak.s3.t")} text={t("lp.speak.s3.d")} tile={
          <div className={`${TILE} bg-card`}>
            <div role="img" aria-label="Hogaya logo" className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BadgeCheck className="size-5" aria-hidden="true" /></span>
              <span className="text-left leading-tight"><span className="block text-lg font-bold tracking-tight">Hogaya</span><span lang="hi" className="block text-sm font-semibold text-primary">हो गया</span></span>
            </div>
          </div>
        } />
      </ol>
      <p className="mt-8 text-center text-base font-semibold">{t("lp.speak.works")}</p>
      <div className="mt-3 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Link href="/book" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground transition hover:bg-[color-mix(in_oklch,var(--primary),black_14%)]">{t("voice.try")}</Link>
        <Link href="/voice" className="inline-flex min-h-12 items-center justify-center rounded-2xl border bg-card px-6 text-base font-semibold text-primary transition hover:border-primary/60">{t("nav.how")}</Link>
      </div>
    </section>
  );
}
