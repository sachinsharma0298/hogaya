// Reports translation problems: keys missing in a language, keys used in the code but defined nowhere,
// and Hindi / Hinglish text hiding in the English dictionary. Usage: npm run check:i18n
import fs from "node:fs";
import path from "node:path";
import { DICTS } from "../src/lib/translations";

let problems = 0;
const say = (s: string) => { problems++; console.log(s); };
const all = new Set([...Object.keys(DICTS.en), ...Object.keys(DICTS.hing), ...Object.keys(DICTS.hi)]);
for (const l of ["en", "hing", "hi"] as const) {
  const missing = [...all].filter((k) => !(k in DICTS[l]));
  if (missing.length) say(`MISSING in ${l} (${missing.length}): ${missing.join(", ")}`);
}

// keys used in the code
const used = new Set<string>();
const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) for (const m of fs.readFileSync(p, "utf8").matchAll(/\bt\(\s*["']([\w.]+)["']/g)) used.add(m[1]); } };
walk(path.join(process.cwd(), "src"));
const unknown = [...used].filter((k) => !(k in DICTS.en));
if (unknown.length) say(`USED in code but not defined (${unknown.length}): ${unknown.join(", ")}`);

const SAMPLE = /^voice\.s\d$/;
// stray Hindi / Hinglish in English
const HING = /\b(kaam|pakka|hogaya ki|aap|aapka|aapki|karein|kijiye|hai|hain|namaste|shukriya|dobara|bhejein|chuniye|banayein|nahi|abhi|kya|mein)\b/i;
for (const [k, v] of Object.entries(DICTS.en)) {
  if (SAMPLE.test(k)) continue; // the voice sample sentences are example input in each language
  if (/[ऀ-ॿ]/.test(v)) say(`DEVANAGARI in en: ${k}`);
  else if (HING.test(v) && !/^(brand\.name|qf\.ph)$/.test(k)) say(`HINGLISH? in en: ${k} = ${v}`);
}
// stray English-only mentions that must be gone
for (const l of ["en", "hing", "hi"] as const) for (const [k, v] of Object.entries(DICTS[l])) if (k !== "lp.foot.fo" && /Wajo|hackathon/i.test(v)) say(`FORBIDDEN word in ${l}: ${k}`);
console.log(problems ? `${problems} problem(s)` : "ALL PASSED");
process.exit(problems ? 1 : 0);
