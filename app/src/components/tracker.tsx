"use client";
import { Check } from "lucide-react";
import type { BookingState } from "@/lib/types";

type T = (key: string, vars?: Record<string, string | number>) => string;

export const TRACKER = ["requested", "providers", "options", "choose", "booked", "reconfirmed", "arrived", "done"] as const;

/** Index of the step that is happening now (steps before it are done). 8 means everything is done. */
export function activeIndex(state: BookingState): number {
  switch (state) {
    case "requested": return 0;
    case "calling_providers": return 1;
    case "options_ready":
    case "calling_customer": return 3;
    case "customer_chose":
    case "booking_provider": return 4;
    case "booked":
    case "reconfirm_due": return 5;
    case "reconfirmed":
    case "pro_arrived": return 6;
    case "arrived": return 7;
    case "completed":
    case "closed": return 8;
    default: return 0;
  }
}

/** Progress tracker for the booking page: done steps are ticked, the current one is highlighted. */
export function Tracker({ state, t }: { state: BookingState; t: T }) {
  const cur = activeIndex(state);
  return (
    <ol className="grid grid-cols-4 gap-x-2 gap-y-4" aria-label={t("tr.progress")}>
      {TRACKER.map((k, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <li key={k} className="flex flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            <span className={`grid size-8 place-items-center rounded-full text-xs font-bold transition ${done ? "bg-primary text-primary-foreground" : active ? "bg-accent text-accent-foreground ring-2 ring-primary" : "bg-muted text-foreground/60"}`}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={`mt-1 text-[11px] leading-tight ${active ? "font-semibold" : done ? "text-foreground/80" : "text-foreground/60"}`}>{t(`tr.${k}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
