"use client";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MessageSquareText, PhoneCall, ShieldCheck, UserCheck } from "lucide-react";
import { Brand, LangToggle } from "@/components/brand";
import { useSession } from "@/components/session";
import { CATEGORIES } from "@/lib/categories";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { useT } from "@/lib/lang";

const STEPS = [
  { n: 1, k: "lp.s1", Icon: MessageSquareText },
  { n: 2, k: "lp.s2", Icon: PhoneCall },
  { n: 3, k: "lp.s3", Icon: UserCheck },
  { n: 4, k: "lp.s4", Icon: ShieldCheck },
];

/** The landing page: what Hogaya is, how it works, Built on Fo, the services, and the two ways in. */
export default function Landing() {
  const { t } = useT();
  const { user, logout } = useSession();
  const home = user?.role === "pro" ? "/pro" : user?.role === "operator" ? "/operator" : "/me";
  return (
    <div className="flex-1">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Brand />
        <div className="flex flex-wrap items-center gap-3">
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

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-5 pb-10 pt-6 md:pt-14">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium"><BadgeCheck className="size-3.5 text-primary" /> {t("brand.tagline")}</p>
            <h1 className="text-[34px] font-bold leading-[1.1] tracking-tight md:text-5xl">{t("lp.hero")}</h1>
            <p className="mt-4 text-base leading-relaxed text-foreground/85 md:text-lg">{t("lp.sub")}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/book" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground">{t("lp.cta.book")} <ArrowRight className="size-4" /></Link>
              <Link href="/pro/join" className="inline-flex h-12 items-center justify-center rounded-2xl border bg-card px-6 text-base font-semibold">{t("lp.cta.pro")}</Link>
            </div>
          </div>
        </section>

        {/* 4 steps */}
        <section aria-labelledby="how" className="mx-auto w-full max-w-5xl px-5 py-8">
          <h2 id="how" className="text-2xl font-bold tracking-tight">{t("lp.steps.title")}</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ n, k, Icon }) => (
              <li key={k} className="rounded-3xl border bg-card p-5">
                <span className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">{n}</p>
                <h3 className="mt-0.5 text-base font-semibold leading-snug">{t(`${k}.t`)}</h3>
                <p className="mt-1.5 text-sm leading-snug text-foreground/80">{t(`${k}.d`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Built on Fo */}
        <section aria-labelledby="fo" className="mx-auto w-full max-w-5xl px-5 py-8">
          <div className="rounded-[2rem] bg-foreground p-6 text-background md:p-10">
            <h2 id="fo" className="text-2xl font-bold tracking-tight">{t("lp.fo.title")}</h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed opacity-90">{t("lp.fo.p1")}</p>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed opacity-90">{t("lp.fo.p2")}</p>
            <p className="mt-5 text-lg font-semibold text-[#f6a35a]">{t("lp.fo.tag")}</p>
          </div>
        </section>

        {/* Categories */}
        <section aria-labelledby="cats" className="mx-auto w-full max-w-5xl px-5 py-8">
          <h2 id="cats" className="text-2xl font-bold tracking-tight">{t("lp.cat.title")}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c];
              return (
                <li key={c}>
                  <Link href="/book" className="flex h-full flex-col rounded-2xl border bg-card p-4 transition hover:border-primary/60">
                    <Icon className="size-6 text-primary" />
                    <span className="mt-3 text-sm font-semibold leading-tight">{t(`cat.${c}`)}</span>
                    <span className="mt-0.5 text-xs leading-snug text-foreground/75">{t(`cat.${c}.hint`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-12 pt-6 text-center text-xs text-foreground/70">
        <p className="mt-2 flex items-center justify-center gap-4">
          <Link href="/login?role=operator" className="underline underline-offset-4">{t("login.role.operator")}</Link>
          <Link href="/login?role=pro" className="underline underline-offset-4">{t("login.role.pro")}</Link>
        </p>
      </footer>
    </div>
  );
}
