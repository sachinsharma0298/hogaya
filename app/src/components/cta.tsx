"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/lang";

/** The two primary actions of the whole site, always worded and styled the same way: "Book a service" (customers) and "Join as a pro" (pros). */
const base = "inline-flex items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground transition hover:bg-primary/90";
const SIZE = { md: "min-h-12 px-6 text-base", sm: "min-h-11 px-4 text-sm" };

export function BookCta({ size = "md", arrow = false, className = "" }: { size?: keyof typeof SIZE; arrow?: boolean; className?: string }) {
  const { t } = useT();
  return <Link href="/book" className={`${base} ${SIZE[size]} ${className}`}>{t("lp.cta.book")}{arrow && <ArrowRight className="size-4" aria-hidden="true" />}</Link>;
}

export function ProCta({ size = "md", arrow = false, className = "" }: { size?: keyof typeof SIZE; arrow?: boolean; className?: string }) {
  const { t } = useT();
  return <Link href="/pro/join" className={`${base} ${SIZE[size]} ${className}`}>{t("lp.cta.pro")}{arrow && <ArrowRight className="size-4" aria-hidden="true" />}</Link>;
}
