"use client";
import type { Category } from "@/lib/categories";
import { useT } from "@/lib/lang";
import { useLiveCategories } from "@/lib/use-live-categories";

/** Green "Live calls" for categories with real calls enabled, grey "Preview" for the rest. Shows nothing until we know. */
export function LiveBadge({ category, className = "" }: { category: Category; className?: string }) {
  const { t } = useT();
  const live = useLiveCategories();
  if (!live) return null;
  const on = live.has(category);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${on ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-800"} ${className}`}>
      {t(on ? "cat.live" : "cat.preview")}
    </span>
  );
}

/** One line that says what the badge of this category means. */
export function ModeNote({ category }: { category: Category }) {
  const { t } = useT();
  const live = useLiveCategories();
  if (!live) return null;
  return <p className="text-xs leading-snug text-foreground/75">{t(live.has(category) ? "cat.live.note" : "cat.preview.note")}</p>;
}
