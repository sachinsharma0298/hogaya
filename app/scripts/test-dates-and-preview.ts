// No network. Checks (1) "kal / aaj / parso" use India time even when the server clock is UTC, and (2) simulated Pros offer the requested time.
import assert from "node:assert/strict";
import { resolveDay, istDate } from "../src/lib/parse-booking";
import { demoOffer, requestedTime } from "../src/lib/demo-slot";

// 00:30 IST on 31 Oct = 19:00 UTC on 30 Oct. A UTC server would say "today" is 30 Oct: India's today is 31 Oct.
const at0030IST = new Date("2026-10-30T19:00:00Z");
assert.equal(istDate(0, at0030IST), "2026-10-31");
for (const [word, want] of [["kal", "2026-11-01"], ["tomorrow", "2026-11-01"], ["aaj", "2026-10-31"], ["आज", "2026-10-31"], ["कल", "2026-11-01"], ["parso", "2026-11-02"], ["परसों", "2026-11-02"]] as const)
  assert.equal(resolveDay(word, at0030IST), want, `${word}`);
// 23:30 IST on 30 Oct = 18:00 UTC the same day: still 30 Oct in India, "kal" = 31 Oct.
assert.equal(resolveDay("kal", new Date("2026-10-30T18:00:00Z")), "2026-10-31");
assert.equal(resolveDay("next week"), null);
console.log("ok  kal / tomorrow / aaj / आज / parso use India time (at 00:30 IST, kal is the next IST date)");

// Preview Pros: exact time requested -> every Pro offers exactly that time; a window -> a time inside it.
for (const h of [0, 1, 2, 3, 7, 11]) {
  for (const w of [false, true]) {
    const o = demoOffer("Tomorrow, 11:00 AM", h, w)!;
    assert.equal(o.slot, "11:00 AM"); assert.equal(o.exact, true);
  }
  const o = demoOffer("Tomorrow, 9–11 AM", h, false)!; // inside 9:00 to 11:00
  const r = requestedTime("Tomorrow, 9–11 AM")!; assert.equal(r.kind, "range");
  const [hh, mm, ap] = /(\d+):(\d+) (AM|PM)/.exec(o.slot)!.slice(1); const min = (Number(hh) % 12 + (ap === "PM" ? 12 : 0)) * 60 + Number(mm);
  assert.ok(min >= 540 && min < 660, `${o.slot} should be inside 9-11 AM`);
  const ev = demoOffer("This evening, 6–8 PM", h, false)!; assert.match(ev.slot, /^(6|7):\d\d PM$/);
  assert.equal(demoOffer("Tomorrow, 9–11 AM", h, true)!.exact, false); // window-only Pros keep the window
}
assert.equal(demoOffer("Today evening", 3, false), null); // unknown label: the old behaviour
console.log("ok  Preview Pros offer the exact time requested, or a time inside the requested window");
console.log("ALL PASSED");
