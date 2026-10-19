"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, UserRound } from "lucide-react";
import { CustomerShell, StateBox } from "@/components/brand";
import { AccountBanner } from "@/components/account-banner";
import { useSession } from "@/components/session";
import { useT } from "@/lib/lang";
import type { Provider } from "@/lib/types";
import type { SessionUser } from "@/components/session";

/** Pro pages: needs a Pro login, and has a bottom bar (My jobs, Profile) on phones. */
export function ProShell({ children }: { children: (ctx: { user: SessionUser; provider: Provider }) => React.ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const path = usePathname();
  const { loading, user, provider } = useSession();
  useEffect(() => {
    if (!loading && (!user || user.role !== "pro")) router.replace(`/login?role=pro&next=${path}`);
  }, [loading, user, router, path]);
  if (loading || !user || !provider) return <CustomerShell><StateBox title={t("loading.title")} body={user ? undefined : t("pa.needlogin")} /></CustomerShell>;
  const tabs = [
    { href: "/pro", label: t("nav.myjobs"), Icon: Briefcase },
    { href: "/pro/profile", label: t("nav.profile"), Icon: UserRound },
  ];
  return (
    <CustomerShell>
      <div className="pb-24 md:pb-0"><AccountBanner />{children({ user, provider })}</div>
      <nav aria-label="Pro" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent">
        <div className="mx-auto grid max-w-[520px] grid-cols-2 gap-1 p-2 md:p-0">
          {tabs.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium ${path === href ? "bg-accent text-accent-foreground" : "text-foreground/70"}`}>
              <Icon className="size-5" /> {label}
            </Link>
          ))}
        </div>
      </nav>
    </CustomerShell>
  );
}
