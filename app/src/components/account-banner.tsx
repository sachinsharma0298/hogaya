"use client";
import { useEffect } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useSession } from "@/components/session";
import { useT } from "@/lib/lang";

/** Where the person stands with Hogaya: waiting, approved (shown once) or not approved. The operator never sees it. */
export function AccountBanner() {
  const { t } = useT();
  const { user } = useSession();
  const notice = Boolean(user?.approval_notice);
  useEffect(() => { if (notice) void fetch("/api/auth/ack-approval", { method: "POST" }); }, [notice]);
  if (!user || user.role === "operator") return null;
  if (user.review === "pending") return <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"><Clock className="size-4 shrink-0" />{t("acct.pending")}</p>;
  if (user.review === "rejected") return <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-900"><XCircle className="size-4 shrink-0" />{t("acct.rejected")}</p>;
  if (notice) return <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="size-4 shrink-0" />{t("acct.approved")}</p>;
  return null;
}
