"use client";
import Link from "next/link";
import { useT } from "@/lib/lang";

/** The footer of the public pages. The only place the calling service is named. */
export function SiteFooter() {
  const { t } = useT();
  return (
    <footer className="mx-auto w-full max-w-6xl border-t px-5 pb-12 pt-8 text-center text-sm text-foreground/75">
      <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link href="/book" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("lp.cta.book")}</Link>
        <Link href="/pro/join" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("lp.cta.pro")}</Link>
        <Link href="/login" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.login")}</Link>
        <Link href="/help" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.help")}</Link>
      </nav>
      <p className="mt-4 text-xs text-foreground/70">{t("lp.foot.fo")}</p>
    </footer>
  );
}
