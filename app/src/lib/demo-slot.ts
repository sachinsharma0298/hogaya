// Simulated (Preview) Pros answer with a time that fits the customer's request: the exact time if one was asked for,
// otherwise a time inside the requested window. Only used by simulated calls. The live Fo flow never touches this.

const clock = (min: number) => {
  const h24 = Math.floor(min / 60) % 24;
  return `${h24 % 12 || 12}:${String(min % 60).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
};
const toMin = (h: string, m: string | undefined, ap: string) => ((Number(h) % 12) + (/pm/i.test(ap) ? 12 : 0)) * 60 + Number(m ?? 0);

export type Requested = { kind: "exact"; at: number } | { kind: "range"; from: number; to: number; label: string };

/** Reads the booking's time label (for example "Tomorrow, 11:00 AM" or "Tomorrow, 9–11 AM"). Null when it is not recognised. */
export function requestedTime(timeWindow: string): Requested | null {
  const by = /^Within 2 hours \(by (\d{1,2}):(\d{2}) (AM|PM)\)$/i.exec(timeWindow);
  if (by) { const to = toMin(by[1], by[2], by[3]); return { kind: "range", from: to - 120, to, label: `${clock(to - 120)}–${clock(to)}` }; }
  const r = /,\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i.exec(timeWindow);
  if (r) {
    const to = toMin(r[4], r[5], r[6]);
    const from = toMin(r[1], r[2], r[3] ?? r[6]);
    return { kind: "range", from, to, label: r[0].replace(/^,\s*/, "").trim().replace(/\s*-\s*/, "–") };
  }
  const e = /,\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(timeWindow);
  return e ? { kind: "exact", at: toMin(e[1], e[2], e[3]) } : null;
}

/** The time a simulated Pro offers. `h` is a stable number per Pro, so each Pro answers differently. */
export function demoOffer(timeWindow: string, h: number, windowOnly: boolean): { slot: string; slotRaw: string; exact: boolean } | null {
  const req = requestedTime(timeWindow);
  if (!req) return null;
  if (req.kind === "exact") return { slot: clock(req.at), slotRaw: clock(req.at), exact: true };
  if (windowOnly) return { slot: req.label.replace(/^[^,]*,\s*/, ""), slotRaw: req.label, exact: false };
  const steps = Math.max(1, Math.floor((req.to - req.from) / 15)); // 15-minute steps, the last one still inside the window
  const at = req.from + (h % steps) * 15;
  return { slot: clock(at), slotRaw: clock(at), exact: true };
}
