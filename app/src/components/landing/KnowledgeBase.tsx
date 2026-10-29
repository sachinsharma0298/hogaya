"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/lang";
import { KbIllustration, type KbKind } from "./KbIllustration";
import { Reveal } from "./Reveal";

export const GUIDES: Record<KbKind, { steps: string[]; short: string[] }> = {
  customers: { steps: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"], short: ["c1", "c3", "c4", "c5", "c7"] },
  pros: { steps: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"], short: ["p1", "p3", "p4", "p5", "p6"] },
  judges: { steps: ["j1", "j2", "j3", "j4"], short: ["j1", "j2", "j3", "j4"] },
};
const KINDS: KbKind[] = ["customers", "pros", "judges"];

/** "How to use Hogaya": a tab each for customers, pros and judges & testers, with a short numbered guide and a link to the full guide. */
export function KnowledgeBase() {
  const { t } = useT();
  const [kind, setKind] = useState<KbKind>("customers");
  return (
    <section id="guide" aria-labelledby="kb-h" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-12">
      <Reveal><h2 id="kb-h" className="text-3xl font-bold tracking-tight md:text-4xl">{t("kb.title")}</h2></Reveal>
      <div role="tablist" aria-label={t("kb.title")} className="mt-5 grid grid-cols-3 gap-1 rounded-2xl border bg-card p-1 text-sm font-medium md:inline-grid md:min-w-[28rem]">
        {KINDS.map((k) => (
          <button key={k} id={`kb-tab-${k}`} role="tab" aria-selected={kind === k} aria-controls="kb-panel" type="button" onClick={() => setKind(k)} className={`rounded-xl px-2 py-2.5 transition ${kind === k ? "bg-primary text-primary-foreground" : "text-foreground/75"}`}>{t(`kb.tab.${k}`)}</button>
        ))}
      </div>
      <div id="kb-panel" role="tabpanel" aria-labelledby={`kb-tab-${kind}`} className="mt-4 grid items-center gap-6 rounded-3xl border bg-card p-5 md:grid-cols-[1fr_16rem] md:p-8">
        <div>
          <ol className="space-y-2.5">
            {GUIDES[kind].short.map((k, i) => (
              <li key={k} className="flex items-start gap-3 text-[15px] leading-snug"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{i + 1}</span><span className="pt-0.5">{t(`help.${k}.t`)}</span></li>
            ))}
          </ol>
          <Link href={`/help#${kind}`} className="mt-5 inline-block text-sm font-semibold text-primary underline underline-offset-4">{t("kb.read")} →</Link>
        </div>
        <KbIllustration kind={kind} className="mx-auto w-full max-w-[16rem]" />
      </div>
    </section>
  );
}
