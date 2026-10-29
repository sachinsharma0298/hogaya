"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Brand, LangToggle } from "@/components/brand";
import { BookCta } from "@/components/cta";
import { useSession } from "@/components/session";
import { useT } from "@/lib/lang";

/** The sticky header of the public pages: brand, section links, language, sign-in and the main "Book a service" button. A hamburger menu on phones. */
export function SiteHeader() {
  const { t } = useT();
  const { user, logout } = useSession();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const home = user?.role === "pro" ? "/pro" : user?.role === "operator" ? "/operator" : "/me";
  // On the landing page the links scroll to the section; elsewhere they take you to it. FAQ also lives on /help.
  const links = [
    { href: "/#how", key: "nav.how" },
    { href: "/#pros", key: "nav.forpros" },
    { href: "/#trust", key: "nav.trust" },
    { href: path === "/help" ? "#faq" : "/#faq", key: "nav.faq" },
    { href: "/help", key: "nav.help" },
  ];
  const link = "inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-foreground/85 underline-offset-4 hover:underline";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const account = user ? (
    <>
      <Link href={home} onClick={() => setOpen(false)} className={`${link} text-primary`}>{user.role === "customer" ? t("nav.mybookings") : user.role === "pro" ? t("nav.myjobs") : t("nav.operator")}</Link>
      <button type="button" onClick={async () => { await logout(); }} className={link}>{t("nav.logout")}</button>
    </>
  ) : (
    <Link href="/login" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4 text-sm font-medium">{t("nav.login")}</Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
        <Brand small />
        <nav aria-label={t("nav.main")} className="hidden items-center gap-1 lg:flex">
          {links.map((l) => <Link key={l.key} href={l.href} className={link}>{t(l.key)}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LangToggle /></div>
          <div className="hidden items-center gap-2 lg:flex">{account}<BookCta size="sm" /></div>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t("nav.menu.close") : t("nav.menu.open")}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="grid size-11 place-items-center rounded-xl border bg-card lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label={t("nav.main")} className="border-t bg-background px-5 pb-4 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {links.map((l) => <li key={l.key}><Link href={l.href} onClick={() => setOpen(false)} className={`${link} w-full py-1`}>{t(l.key)}</Link></li>)}
          </ul>
          <div className="mt-3 sm:hidden"><LangToggle /></div>
          <div className="mt-3 flex flex-wrap items-center gap-3">{account}<BookCta size="sm" /></div>
        </nav>
      )}
    </header>
  );
}
