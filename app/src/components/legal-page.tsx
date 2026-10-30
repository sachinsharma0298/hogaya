"use client";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { useT } from "@/lib/lang";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
const SECTIONS = { privacy: 7, terms: 6 } as const;

/** Privacy and Terms: short plain sections, all text from the translations. The last section carries the contact line. */
export function LegalPage({ kind }: { kind: keyof typeof SECTIONS }) {
  const { t } = useT();
  return (
    <div className="flex-1">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-5 pb-12">
        <h1 className="mt-6 text-4xl font-bold tracking-tight">{t(`legal.${kind}.title`)}</h1>
        <p className="mt-2 text-base text-foreground/80">{t(`legal.${kind}.intro`)}</p>
        <div className="mt-6 space-y-5">
          {Array.from({ length: SECTIONS[kind] }, (_, i) => i + 1).map((n) => (
            <section key={n} aria-labelledby={`${kind}-${n}`} className="rounded-3xl border bg-card p-5">
              <h2 id={`${kind}-${n}`} className="text-lg font-semibold">{t(`legal.${kind}.s${n}.t`)}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/85">{t(`legal.${kind}.s${n}.d`)}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-foreground/80">
          {CONTACT ? <>{t("help.contact")} <a href={`mailto:${CONTACT}`} className="font-medium text-primary underline underline-offset-4">{CONTACT}</a></> : t("help.contact.none")}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
