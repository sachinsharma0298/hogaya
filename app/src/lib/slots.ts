// Time slots for the booking form. Generated from the customer's own clock (so always in their time zone and never in the past).
// The stored value is a plain English label, e.g. "Tomorrow, 10:30 AM": it goes into the same time_window field the call brief already reads.
export interface Slot { id: string; key: string; value: string }

const clock = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase().replace(/\s+/g, " ");
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const at = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);

/** Two or three preset slots that are still in the future. `key` is the translation key for the button label. */
export function presetSlots(now = new Date()): Slot[] {
  const out: Slot[] = [];
  const hr = now.getHours() + now.getMinutes() / 60;
  if (hr >= 7 && hr < 20) {
    const by = new Date(now.getTime() + 2 * 3600_000);
    out.push({ id: "within2", key: "slot.within2", value: `Within 2 hours (by ${clock(by)})` });
  }
  if (hr < 17.5) out.push({ id: "evening", key: "slot.evening", value: "This evening, 6–8 PM" });
  out.push({ id: "tomorrow_am", key: "slot.tomorrow_am", value: "Tomorrow, 9–11 AM" });
  out.push({ id: "tomorrow_pm", key: "slot.tomorrow_pm", value: "Tomorrow, 2–4 PM" });
  return out.slice(0, 3);
}

/** The local date (YYYY-MM-DD) for the date picker's minimum. */
export const todayInput = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/** A custom date + time as a readable label, or an error code. A time in the past is refused. */
export function customSlot(date: string, time: string, now = new Date()): { value: string } | { error: "custom" | "past" } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "custom" };
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const when = new Date(y, mo - 1, d, h, mi);
  if (Number.isNaN(when.getTime()) || when.getTime() < now.getTime() + 15 * 60_000) return { error: "past" }; // at least 15 minutes ahead
  const day = dayStart(when).getTime();
  const label = day === dayStart(now).getTime() ? "Today" : day === dayStart(addDays(now, 1)).getTime() ? "Tomorrow" : when.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return { value: `${label}, ${clock(when)}` };
}

type T = (key: string, vars?: Record<string, string | number>) => string;
/** Shows a stored slot label in the reader's language. Anything it does not recognise is shown as it was saved. */
export function slotText(value: string, t: T): string {
  const by = /^Within 2 hours \(by (.+)\)$/.exec(value);
  if (by) return t("slot.within2.by", { time: by[1] });
  const known: Record<string, string> = { "This evening, 6–8 PM": "slot.evening", "Tomorrow, 9–11 AM": "slot.tomorrow_am", "Tomorrow, 2–4 PM": "slot.tomorrow_pm" };
  if (known[value]) return t(known[value]);
  const day = /^(Today|Tomorrow), (.+)$/.exec(value);
  if (day) return `${t(day[1] === "Today" ? "slot.today" : "slot.tomorrow")}, ${day[2]}`;
  return value;
}
