// Renders every call brief (fake data only) in English and Hinglish. Fails if a brief does not speak for Hogaya or leaks a name.
// Also saves the rendered briefs to ~/Desktop/Hogaya-Review/call-briefs.txt so they can be read before pushing.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildArrivalBrief, buildBookingBrief, buildCustomerBrief, buildProviderBrief, buildReconfirmBrief, type CallLang } from "../src/lib/briefs";

const operatorName = process.env.OPERATOR_NAME ?? "";
const operatorEmail = process.env.OPERATOR_EMAIL ?? "";
const banned = ["Sachin", "Virat", "Wajo", operatorName, operatorEmail, "personal assistant of", "Fo, an AI"].filter((s) => s.length > 2);

const ph = "+91XXXXXXXXXX";
const job = { category: "electrician", problem: "My ceiling fan stopped working this morning", sector: "New Kondli" };
const opt = (name: string, slot: string, exact: boolean) => ({ providerName: name, slot, slotExact: exact, visitCharge: "₹150", labourEstimate: null, afterInspection: true, bringsParts: true });

const out: string[] = [];
let n = 0;
for (const lang of ["english", "hinglish"] as CallLang[]) {
  const briefs: Record<string, string> = {
    provider: buildProviderBrief({ providerPhone: ph, providerName: "Ramesh", ...job, timeWindow: "Tomorrow, 10:30 AM", notes: "brand Usha", lang }),
    customer: buildCustomerBrief({ customerPhone: ph, customerName: "Sara", ...job, timeWindow: "Tomorrow, 10:30 AM", best: opt("Ramesh", "10:30 AM", true), second: opt("Suresh", "11 AM–12 PM", false), reason: "Exact time confirmed", lang }),
    booking: buildBookingBrief({ providerPhone: ph, providerName: "Ramesh", ...job, address: "H-12 Example Street", slot: "10:30 AM", slotExact: true, visitCharge: "₹150", lang }),
    reconfirm: buildReconfirmBrief({ providerPhone: ph, providerName: "Ramesh", category: job.category, sector: job.sector, slot: "10:30 AM", slotExact: true, visitCharge: "₹150", lang }),
    arrival: buildArrivalBrief({ providerPhone: ph, providerName: "Ramesh", category: job.category, sector: job.sector, lang }),
  };
  for (const [kind, text] of Object.entries(briefs)) {
    assert.ok(text.includes("Hogaya"), `${lang}/${kind}: missing Hogaya`);
    assert.ok(text.includes("Hogaya's AI assistant"), `${lang}/${kind}: not Hogaya's AI assistant`);
    for (const b of banned) assert.ok(!text.toLowerCase().includes(b.toLowerCase()), `${lang}/${kind}: contains "${b}"`);
    // the address appears only in the booking brief
    assert.equal(text.includes("H-12 Example Street"), kind === "booking", `${lang}/${kind}: address rule`);
    out.push(`${"=".repeat(70)}\n${kind.toUpperCase()} CALL (${lang})\n${"=".repeat(70)}\n${text}\n`);
    n++;
  }
}
const dir = join(homedir(), "Desktop", "Hogaya-Review");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "call-briefs.txt"), "Fake data only. Rendered by scripts/test-briefs.ts.\n\n" + out.join("\n"));
console.log(`ok ${n} briefs`);
console.log("ALL PASSED");
