"use client";
import Link from "next/link";
import { Brand, LangToggle } from "@/components/brand";
import { useSession } from "@/components/session";
import { useT } from "@/lib/lang";

/** The header of the public pages: brand, links, language toggle and sign-in. */
export function SiteHeader() {
  const { t } = useT();
  const { user, logout } = useSession();
  const home = user?.role === "pro" ? "/pro" : user?.role === "operator" ? "/operator" : "/me";
  const link = "text-sm font-medium text-foreground/80 underline-offset-4 hover:underline";
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
      <Brand />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Main" className="flex items-center gap-4">
          <Link href="/#how" className={`${link} hidden md:inline`}>{t("nav.how")}</Link>
          <Link href="/#pros" className={`${link} hidden md:inline`}>{t("nav.forpros")}</Link>
          <Link href="/help" className={link}>{t("nav.help")}</Link>
        </nav>
        <LangToggle />
        {user ? (
          <>
            <Link href={home} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{user.role === "customer" ? t("nav.mybookings") : user.role === "pro" ? t("nav.myjobs") : t("nav.operator")}</Link>
            <button type="button" onClick={async () => { await logout(); }} className="text-sm text-foreground/70 underline-offset-4 hover:underline">{t("nav.logout")}</button>
          </>
        ) : (
          <Link href="/login" className="rounded-xl border bg-card px-3.5 py-2 text-sm font-medium">{t("nav.login")}</Link>
        )}
      </div>
    </header>
  );
}
