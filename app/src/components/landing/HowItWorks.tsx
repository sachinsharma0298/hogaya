"use client";
import { useT } from "@/lib/lang";
import { DoorCodeScene } from "./DoorCodeScene";
import { Reveal } from "./Reveal";
import { ScrollLine } from "./ScrollLine";
import { StepBooking } from "./StepBooking";
import { StepCall } from "./StepCall";
import { StepOptions } from "./StepOptions";
import { StepProJob } from "./StepProJob";

const VISUALS = [StepBooking, StepCall, StepOptions, StepProJob];

/** The four steps, each with its own visual, joined by a dotted path that draws itself as you scroll. Then the closing band. */
export function HowItWorks() {
  const { t } = useT();
  return (
    <section id="how" aria-labelledby="how-h" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 py-12">
      <Reveal><h2 id="how-h" className="text-3xl font-bold tracking-tight md:text-4xl">{t("lp.how.title")}</h2><p className="mt-2 max-w-2xl text-base text-foreground/80">{t("lp.how.sub")}</p></Reveal>
      <ol className="relative mt-8 space-y-10 md:space-y-14">
        <ScrollLine className="left-[19px] top-4 bottom-4 md:left-1/2 md:-ml-1" />
        {VISUALS.map((Visual, i) => {
          const n = i + 1;
          const flip = i % 2 === 1;
          return (
            <li key={n} className="relative grid items-center gap-5 pl-14 md:grid-cols-2 md:gap-16 md:pl-0">
              <span className="absolute left-0 top-0 z-10 grid size-10 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground ring-4 ring-background md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2" aria-hidden="true">{n}</span>
              <Reveal className={flip ? "md:order-2 md:pl-6" : "md:pr-6 md:text-right"}>
                <h3 className="text-xl font-semibold leading-snug"><span className="sr-only">{n}. </span>{t(`lp.s${n}.t`)}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/80">{t(`lp.s${n}.d`)}</p>
              </Reveal>
              <Reveal delay={1} className={flip ? "md:order-1" : ""}><Visual /></Reveal>
            </li>
          );
        })}
      </ol>

      <Reveal className="mt-14">
        <div className="grid items-center gap-6 rounded-[2rem] bg-foreground p-6 text-background md:grid-cols-2 md:p-10">
          <p className="text-2xl font-bold leading-snug tracking-tight md:text-3xl">{t("lp.close")}</p>
          <DoorCodeScene className="mx-auto max-w-[360px]" />
        </div>
      </Reveal>
    </section>
  );
}
