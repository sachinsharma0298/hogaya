"use client";
import Link from "next/link";
import { BookCta } from "@/components/cta";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { useT } from "@/lib/lang";

/** Shown for any address that does not exist. */
export default function NotFound() {
  const { t } = useT();
  return (
    <div className="flex-1">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-xl px-5 py-16 text-center">
        <p className="text-6xl font-bold text-saffron" aria-hidden="true">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("nf.title")}</h1>
        <p className="mt-2 text-base text-foreground/80">{t("nf.body")}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-2xl border bg-card px-6 text-base font-semibold">{t("nf.home")}</Link>
          <BookCta />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
