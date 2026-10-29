"use client";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { useT } from "@/lib/lang";
import { BookCta, ProCta } from "@/components/cta";
import { Faq } from "@/components/landing/Faq";
import { HeroPhone } from "@/components/landing/HeroPhone";
import { HomeScene } from "@/components/landing/HomeScene";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { KnowledgeBase } from "@/components/landing/KnowledgeBase";
import { ProsSection } from "@/components/landing/ProsSection";
import { Reveal } from "@/components/landing/Reveal";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { TrustSection } from "@/components/landing/TrustSection";

/** The landing page: the promise, how it works, for pros, trust, how to use Hogaya, the questions people ask. */
export default function Landing() {
  const { t } = useT();
  return (
    <div className="flex-1">
      <SiteHeader />
      <main id="main">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pb-10 pt-4 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pt-10">
          <div>
            <p className="mb-3 inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary">{t("brand.tagline")}</p>
            <h1 className="text-[34px] font-bold leading-[1.08] tracking-tight md:text-5xl">{t("lp.hero.title")}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/85 md:text-lg">{t("lp.hero.sub")}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <BookCta arrow />
              <ProCta />
            </div>
          </div>
          <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,230px)_1fr] md:grid-cols-1 lg:grid-cols-[minmax(0,230px)_1fr]">
            <HeroPhone />
            <HomeScene />
          </div>
        </section>

        <HowItWorks />
        <ProsSection />
        <TrustSection />

        <section aria-labelledby="cats-h" className="mx-auto w-full max-w-6xl px-5 py-12">
          <Reveal><h2 id="cats-h" className="text-3xl font-bold tracking-tight md:text-4xl">{t("lp.cat.title")}</h2></Reveal>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c];
              return (
                <li key={c}>
                  <Link href={`/book?category=${c}`} className="flex h-full flex-col rounded-2xl border bg-card p-4 transition hover:border-primary/60">
                    <Icon className="size-6 text-primary" />
                    <span className="mt-3 text-sm font-semibold leading-tight">{t(`cat.${c}`)}</span>
                    <span className="mt-0.5 text-xs leading-snug text-foreground/75">{t(`cat.${c}.hint`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <KnowledgeBase />

        <section id="faq" aria-labelledby="faq-h" className="mx-auto w-full max-w-3xl scroll-mt-20 px-5 py-12">
          <Reveal><h2 id="faq-h" className="mb-5 text-3xl font-bold tracking-tight md:text-4xl">{t("faq.title")}</h2></Reveal>
          <Faq />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
