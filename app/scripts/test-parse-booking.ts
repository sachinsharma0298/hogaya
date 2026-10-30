// Calls the Claude API (not Fo) with 11 spoken-style inputs and checks what "Say it once" returns. Usage: npm run test:parse-booking
import { parseBooking } from "../src/lib/parse-booking";
import type { ParsedBooking } from "../src/lib/parse-types";

const ist = (add = 0) => new Date(Date.now() + add * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dev = /[ऀ-ॿ]/;

const CASES: { name: string; text: string; check: (p: ParsedBooking) => string | null }[] = [
  { name: "Devanagari Hindi", text: "बेडरूम की लाइट का स्विच स्पार्क कर रहा है, कल शाम 6 बजे के बाद, सेक्टर 62 नोएडा",
    check: (p) => p.category !== "electrician" ? "category should be electrician" : !p.problem || !dev.test(p.problem) ? "problem should stay in Devanagari" : p.date !== ist(1) ? "date should be tomorrow" : p.time !== "18:00" ? "time should be 18:00" : !/62/.test(p.area ?? "") ? "area should mention 62" : null },
  { name: "Hinglish", text: "Kitchen ka nal leak ho raha hai, aaj shaam 7 baje, Indirapuram Ghaziabad",
    check: (p) => p.category !== "plumber" ? "category should be plumber" : p.date !== ist(0) ? "date should be today" : p.time !== "19:00" ? "time should be 19:00" : !/indirapuram/i.test(p.area ?? "") ? "area should be Indirapuram" : null },
  { name: "English", text: "My AC is not cooling. Please send someone tomorrow at 11 AM to Sector 50, Gurgaon.",
    check: (p) => p.category !== "ac" ? "category should be ac" : p.date !== ist(1) ? "date should be tomorrow" : p.time !== "11:00" ? "time should be 11:00" : !/50|gurgaon/i.test(p.area ?? "") ? "area missing" : null },
  { name: "Missing time", text: "Washing machine paani nahi nikaal rahi, Vaishali Ghaziabad",
    check: (p) => p.category !== "washing_machine" ? "category should be washing_machine" : p.time !== null ? "time should be null" : !p.missing_fields.includes("time") ? "missing_fields should list time" : !/vaishali/i.test(p.area ?? "") ? "area should be Vaishali" : null },
  { name: "Missing area", text: "Geyser se paani garam nahi ho raha, kal subah 9 baje",
    check: (p) => p.category !== "geyser" ? "category should be geyser" : p.time !== "09:00" ? "time should be 09:00" : p.area !== null ? "area should be null" : !p.missing_fields.includes("area") ? "missing_fields should list area" : null },
  { name: "Two problems", text: "Fan bhi nahi chal raha aur tap bhi leak kar raha hai, kal 5 baje, Sector 15 Noida",
    check: (p) => p.category !== "electrician" && p.category !== "plumber" ? "category should be electrician or plumber" : !p.problem ? "problem should keep both issues" : null },
  { name: "Not a service request", text: "Mujhe pizza order karna hai aur cricket ka score batao",
    check: (p) => p.category !== null ? "category should be null" : !p.missing_fields.includes("category") ? "missing_fields should list category" : null },
  { name: "Gibberish", text: "asdf qwer zxcv lkjh poiu mnbv",
    check: (p) => p.category !== null || p.problem !== null ? "category and problem should be null" : null },
  { name: "Area + address + time (English)", text: "The light has been out since this morning, and there is no electricity in the room. I need the electrician by tomorrow at 11 a.m. The address is Noida Sector 63. Nearby location: metro, ground floor, H123.",
    check: (p) => p.category !== "electrician" ? "category should be electrician" : !/63/.test(p.area ?? "") ? "area should be Noida Sector 63" : !/H123/i.test(p.address ?? "") ? "address should have H123" : !/ground/i.test(p.address ?? "") ? "address should have the floor" : p.date !== ist(1) ? "date should be tomorrow" : p.time !== "11:00" ? "time should be 11:00" : null },
  { name: "Flat and landmark (Hinglish)", text: "Flat 402, B tower, Sector 62 Noida, Fortis ke paas, AC thanda nahi kar raha, kal dopahar 2 baje",
    check: (p) => !/62/.test(p.area ?? "") ? "area should have Sector 62" : !/402/.test(p.address ?? "") || !/fortis/i.test(p.address ?? "") ? "address should have 402 and Fortis" : p.time !== "14:00" ? "time should be 14:00" : null },
  { name: "Exact time", text: "Kal subah 10:30 baje AC ko dekhna hai, paani tapak raha hai, Sector 18 Noida",
    check: (p) => p.time !== "10:30" ? "time should be 10:30" : p.date !== ist(1) ? "date should be tomorrow" : !p.time_window ? "time_window should keep the spoken time" : null },
];

(async () => {
  let failed = 0;
  const rows: string[] = [];
  for (const [i, c] of CASES.entries()) {
    let verdict: string;
    try {
      const p = await parseBooking(c.text);
      console.log(`\n#${i + 1} ${c.name}\n${c.text}\n${JSON.stringify(p, null, 2)}`);
      const why = c.check(p);
      verdict = why ? `FAIL (${why})` : "PASS";
    } catch (e) {
      verdict = `FAIL (${e instanceof Error ? e.message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***") : "error"})`;
    }
    if (verdict !== "PASS") failed++;
    rows.push(`| ${i + 1} | ${c.name} | ${verdict} |`);
    console.log(`=> ${verdict}`);
  }
  console.log(`\n| # | Input | Result |\n|---|---|---|\n${rows.join("\n")}`);
  console.log(failed ? `${failed} of ${CASES.length} FAILED` : "ALL PASSED");
  process.exit(failed ? 1 : 0);
})();
