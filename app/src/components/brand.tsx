"use client";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { useT } from "@/lib/lang";
import { LANGS } from "@/lib/translations";
import { useSession } from "@/components/session";

export function Brand({ small }: { small?: boolean }) {
  const { t } = useT();
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <BadgeCheck className="size-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight">Hogaya</span>
        {!small && <span className="block text-xs text-muted-foreground">{t("brand.tagline")}</span>}
      </span>
    </Link>
  );
}

export function DemoBadge({ label }: { label?: string }) {
  return (
    <span className="rounded-full border border-dashed border-primary/50 bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
      {label ?? "Preview"}
    </span>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div role="group" aria-label={t("lang.label")} className="inline-flex rounded-full border bg-card p-0.5 text-xs font-medium">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          className={`inline-flex min-h-11 items-center rounded-full px-3 transition ${lang === l.id ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:text-foreground"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function CustomerShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { t } = useT();
  const { user, logout } = useSession();
  return (
    <main id="main" className="mx-auto w-full max-w-[520px] flex-1 px-5 pb-16 pt-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <Brand />
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {right}
            <LangToggle />
          </div>
          <nav aria-label="Account" className="flex items-center gap-3 text-[11px]">
            {(user?.role === "customer" || user?.role === "operator") && <Link href="/me" className="font-medium text-foreground/80 underline-offset-4 hover:underline">{t("nav.mybookings")}</Link>}
            {user?.role === "pro" && <Link href="/pro" className="font-medium text-foreground/80 underline-offset-4 hover:underline">{t("nav.myjobs")}</Link>}
            {user?.role === "operator" && <Link href="/operator" className="font-medium text-foreground/80 underline-offset-4 hover:underline">{t("nav.operator")}</Link>}
            {user ? (
              <button type="button" onClick={async () => { await logout(); window.location.assign("/"); }} className="text-foreground/70 underline-offset-4 hover:underline">{t("nav.logout")}</button>
            ) : (
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">{t("nav.login")}</Link>
            )}
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}

export function StateBox({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}
