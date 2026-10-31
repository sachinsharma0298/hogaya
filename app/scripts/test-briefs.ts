// Renders every call brief (fake data only) in English, Hindi (Devanagari) and "language not chosen yet" (asks first). Fails if a brief does not speak for Hogaya or leaks a name.
// Also saves the rendered briefs to ~/Desktop/Hogaya-Review/call-briefs.txt so they can be read before pushing.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildArrivalBrief, buildBookingBrief, buildCustomerBrief, buildProviderBrief, buildReconfirmBrief, type LangPref } from "../src/lib/briefs";

const operatorName = process.env.OPERATOR_NAME ?? "";
const operatorEmail = process.env.OPERATOR_EMAIL ?? "";
const banned = ["Sachin", "Virat", "Wajo", operatorName, operatorEmail, "personal assistant of", "Fo, an AI"].filter((s) => s.length > 2);

const ph = "+91XXXXXXXXXX";
const job = { category: "electrician", problem: "My ceiling fan stopped working this morning", sector: "New Kondli" };
const opt = (name: string, slot: string, exact: boolean) => ({ providerName: name, slot, slotExact: exact, visitCharge: "₹150", labourEstimate: null, afterInspection: true, bringsParts: true });

const out: string[] = [];
let n = 0;
const LANGS: [string, LangPref][] = [["english", "english"], ["hindi", "hindi"], ["unknown", undefined]];
for (const [langName, lang] of LANGS) {
  const briefs: Record<string, string> = {
    provider: buildProviderBrief({ providerPhone: ph, providerName: "Ramesh", ...job, timeWindow: "Tomorrow, 10:30 AM", notes: "brand Usha", lang }),
    customer: buildCustomerBrief({ customerPhone: ph, customerName: "Sara", ...job, timeWindow: "Tomorrow, 10:30 AM", best: opt("Ramesh", "10:30 AM", true), second: opt("Suresh", "11 AM–12 PM", false), reason: "Exact time confirmed", lang }),
    booking: buildBookingBrief({ providerPhone: ph, providerName: "Ramesh", ...job, address: "H-12 Example Street", slot: "10:30 AM", slotExact: true, visitCharge: "₹150", lang }),
    reconfirm: buildReconfirmBrief({ providerPhone: ph, providerName: "Ramesh", category: job.category, sector: job.sector, slot: "10:30 AM", slotExact: true, visitCharge: "₹150", lang }),
    arrival: buildArrivalBrief({ providerPhone: ph, providerName: "Ramesh", category: job.category, sector: job.sector, lang }),
  };
  for (const [kind, text] of Object.entries(briefs)) {
    assert.ok(text.includes("Hogaya"), `${langName}/${kind}: missing Hogaya`);
    assert.ok(text.includes("Make one call only. Never redial. If the person hangs up, return the answers you have with status partial."), `${langName}/${kind}: no one-call-only rule`);
    if (lang !== "hindi") assert.ok(text.includes("Hogaya's AI assistant"), `${langName}/${kind}: not Hogaya's AI assistant`);
    if (lang !== "english") assert.ok(text.includes("Hogaya की AI असिस्टेंट"), `${langName}/${kind}: no Hindi opening`);
    // the Hindi brief says its lines in Devanagari; the unknown brief asks first, in both languages
    if (lang === "hindi") assert.ok(/[\u0900-\u097F]{10}/.test(text.split("OPENING LINE")[1]), `${langName}/${kind}: opening not in Devanagari`);
    assert.equal(text.includes("Aap Hindi mein baat karna chahenge ya English mein? Would you prefer Hindi or English?"), lang === undefined, `${langName}/${kind}: language question`);
    assert.ok(text.includes("never mix") || text.includes("Never mix"), `${langName}/${kind}: no-mixing rule`);
    assert.ok(/switch to (Hindi on your very next sentence|English immediately)/.test(text), `${langName}/${kind}: no switching rule`);
    if (lang !== "hindi") assert.ok(/answers or speaks in Hindi or Hinglish.*continue in Hindi for the rest of the call/.test(text), `${langName}/${kind}: (iii) Hindi reply must lead to Hindi for the rest of the call`);
    for (const b of banned) assert.ok(!text.toLowerCase().includes(b.toLowerCase()), `${langName}/${kind}: contains "${b}"`);
    // the address appears only in the booking brief
    assert.equal(text.includes("H-12 Example Street"), kind === "booking", `${langName}/${kind}: address rule`);
    out.push(`${"=".repeat(70)}\n${kind.toUpperCase()} CALL (${langName})\n${"=".repeat(70)}\n${text}\n`);
    n++;
  }
}
const dir = join(homedir(), "Desktop", "Hogaya-Review");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "call-briefs.txt"), "Fake data only. Rendered by scripts/test-briefs.ts.\n\n" + out.join("\n"));
console.log(`ok ${n} briefs`);
console.log("ALL PASSED");
