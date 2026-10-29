"use client";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import type { Notification } from "@/lib/types";

type T = (key: string, vars?: Record<string, string | number>) => string;

const ICON: Record<string, string> = { booked: "✓", backup: "↻", reconfirmed: "✓", pro_arrived: "📍", arrived: "✓", completed: "🎉", bill: "🧾" };

function readSeen(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

/** A short message for a notification that has just arrived. It sits in the page's normal flow, above the content, so it never covers a heading or a button. */
export function NotificationToast({ items, t }: { items: Notification[]; t: T }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const latest = items[items.length - 1];
  const toast = latest && now - new Date(latest.at).getTime() < 8000 && !dismissed.includes(latest.id) ? latest : null;
  if (!toast) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl bg-foreground px-4 py-3 text-sm text-background shadow-md">
      <span aria-hidden>{ICON[toast.kind]}</span>
      <span className="flex-1 font-medium">{t(`n.${toast.kind}`, toast.vars ?? {})}</span>
      <button type="button" onClick={() => setDismissed((d) => [...d, toast.id])} aria-label="Dismiss"><X className="size-4" /></button>
    </div>
  );
}

/** Bell with an unread count and a list. The toast is shown separately by NotificationToast. */
export function NotificationBell({ requestId, items, t }: { requestId: string; items: Notification[]; t: T }) {
  const key = `hogaya-seen-${requestId}`;
  const [seen, setSeen] = useState<string[]>(() => readSeen(key));
  const [open, setOpen] = useState(false);

  const text = (n: Notification) => t(`n.${n.kind}`, n.vars ?? {});
  const unread = items.filter((n) => !seen.includes(n.id)).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const all = items.map((n) => n.id);
      setSeen(all);
      localStorage.setItem(key, JSON.stringify(all));
    }
  }

  return (
    <>
      <div className="relative">
        <button type="button" onClick={toggle} aria-label={`${t("n.title")}${unread ? ` (${unread})` : ""}`} aria-expanded={open} className="relative grid size-9 place-items-center rounded-full border bg-card">
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </button>
        {open && (
          <div role="dialog" aria-label={t("n.title")} className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border bg-card p-3 shadow-lg">
            <p className="text-sm font-semibold">{t("n.title")}</p>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/70">{t("n.none")}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...items].reverse().map((n) => (
                  <li key={n.id} className="flex gap-2 text-sm"><span aria-hidden>{ICON[n.kind]}</span><span>{text(n)}<span className="block text-[11px] text-foreground/70">{new Date(n.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></span></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
