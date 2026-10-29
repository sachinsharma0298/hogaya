"use client";
import Link from "next/link";
import { useT } from "@/lib/lang";

/** "Please read our Privacy and Terms", shown where someone creates an account or joins as a pro. */
export function LegalLinks({ className = "" }: { className?: string }) {
  const { t } = useT();
  const a = "inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4";
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-sm text-foreground/80 ${className}`}>
      {t("legal.read")} <Link href="/privacy" className={a}>{t("legal.privacy")}</Link> {t("legal.and")} <Link href="/terms" className={a}>{t("legal.terms")}</Link>.
    </p>
  );
}
