"use client";
import { useState } from "react";
import { Check, Copy, Mic } from "lucide-react";
import { BookCta } from "@/components/cta";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { useT } from "@/lib/lang";
import { WISPR_URL } from "@/lib/links";

const SAMPLES = [
  { id: "s1", lang: "hi" },
  { id: "s2", lang: "hi-Latn" },
  { id: "s3", lang: "en" },
  { id: "s4", lang: "hi-Latn" },
] as const;

function Sample({ id, lang }: { id: string; lang: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(t(`voice.${id}`));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the sentence stays on screen to copy by hand */ }
  }
  return (
    <li className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-semibold text-foreground/75">{t(`voice.${id}.l`)}</p>
      <p lang={lang} className="mt-1 text-base leading-snug">{t(`voice.${id}`)}</p>
      <button type="button" onClick={copy} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium hover:border-primary/60">
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? t("voice.copied") : t("voice.copy")}</span>
      </button>
    </li>
  );
}

/** "Book by voice": what it is, how to try it with a dictation app, and sentences to copy. */
export default function VoicePage() {
  const { t } = useT();
  return (
    <div className="flex-1">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-5 pb-10">
        <h1 className="mt-6 flex items-center gap-2.5 text-4xl font-bold tracking-tight"><Mic className="size-8 text-primary" aria-hidden="true" /> {t("voice.title")}</h1>
        <p className="mt-2 text-base text-foreground/85">{t("voice.sub")}</p>

        <section aria-labelledby="v-what" className="mt-6 rounded-3xl border bg-card p-5">
          <h2 id="v-what" className="text-lg font-semibold">{t("voice.what.t")}</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/85">{t("voice.what.d")}</p>
        </section>

        <section aria-labelledby="v-how" className="mt-6">
          <h2 id="v-how" className="text-2xl font-bold tracking-tight">{t("voice.how.t")}</h2>
          <ol className="mt-3 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n} className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-[15px] leading-snug">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
                <span className="pt-0.5">
                  {t(`voice.h${n}`)}
                  {n === 1 && <> <a href={WISPR_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">{t("voice.h1.link")}</a></>}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="v-try" className="mt-8">
          <h2 id="v-try" className="text-2xl font-bold tracking-tight">{t("voice.samples.t")}</h2>
          <p className="mt-1 text-sm text-foreground/80">{t("voice.samples.sub")}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">{SAMPLES.map((s) => <Sample key={s.id} {...s} />)}</ul>
        </section>

        <p className="mt-6 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">{t("voice.note")}</p>
        <p className="mt-3 text-xs text-foreground/75">{t("voice.disclaimer")}</p>
        <p className="mt-6"><BookCta arrow /></p>
      </main>
      <SiteFooter />
    </div>
  );
}
