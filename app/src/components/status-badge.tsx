import type { Review } from "@/lib/types";

const LOOK: Record<Review, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800" },
};

/** The operator's decision about a person: Pending, Approved or Rejected. */
export function StatusBadge({ status }: { status?: Review | string }) {
  const s = LOOK[(status as Review) ?? "pending"] ?? LOOK.pending;
  return <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span>;
}
