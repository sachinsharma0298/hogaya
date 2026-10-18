"use client";
import Link from "next/link";
import { CustomerShell } from "@/components/brand";
import { useT } from "@/lib/lang";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** There is no self-service sign-up: Hogaya onboards each Pro personally (no KYC), and records their consent to AI calls. */
export default function ProJoin() {
  const { t } = useT();
  return (
    <CustomerShell>
      <h1 className="text-2xl font-bold tracking-tight">{t("pj.title")}</h1>
      <p className="mt-2 text-sm text-foreground/85">{t("pj.sub")}</p>
      <ol className="mt-5 space-y-3">
        {(["pj.s1", "pj.s2", "pj.s3"] as const).map((k, i) => (
          <li key={k} className="flex gap-3 rounded-2xl border bg-card p-4 text-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
            <span className="pt-0.5">{t(k)}</span>
          </li>
        ))}
      </ol>
      {CONTACT && (
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("Join as a Hogaya Pro")}`} className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground">
          {t("pj.contact")}
        </a>
      )}
      <Link href="/login?next=/pro" className="mt-4 block text-center text-sm font-medium text-primary underline underline-offset-4">{t("pj.login")}</Link>
    </CustomerShell>
  );
}
