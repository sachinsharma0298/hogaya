// npm run rehearse:language -> TEXT rehearsal of the call language rules. No Fo, no phone: claude-haiku plays the assistant from the real
// rendered brief, against scripted replies from the person. 6 conversations, at most 10 turns each. Prints the estimated cost.
// Saves the transcripts to ~/Desktop/Hogaya-Review/language-rehearsal.txt.
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildProviderBrief, type LangPref } from "../src/lib/briefs";

const MODEL = "claude-haiku-5-5";
const PRICE_IN = 0.1 / 1e6; // $ per input token (prompts up to 100K)
const PRICE_OUT = 0.5 / 1e6; // $ per output token
const MAX_TURNS = 10;
if (!process.env.ANTHROPIC_API_KEY) { console.error("No ANTHROPIC_API_KEY (run with --env-file=.env.local)"); process.exit(1); }
const client = new Anthropic();
let inTok = 0, outTok = 0;

const banned = ["Sachin", "Virat", "Wajo", process.env.OPERATOR_NAME ?? "", process.env.OPERATOR_EMAIL ?? "", "personal assistant of", "Fo, an AI"].filter((s) => s.length > 2);
const job = { providerPhone: "+91XXXXXXXXXX", providerName: "Ramesh", category: "electrician", problem: "My ceiling fan stopped working this morning", sector: "New Kondli", timeWindow: "Today, 6–8 PM" };

type Lang = "hindi" | "english" | "mixed" | "none";
/** Which language one assistant turn is in. Allowed spoken-Hindi English words and names are ignored. */
function langOf(text: string): Lang {
  const dev = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const latinText = text.replace(/\b(booking|service code|app|visit charge|AC|fan|OK|Hogaya|AI|Ramesh|Pro|Noida|New Kondli)\b/gi, "");
  const lat = (latinText.match(/[A-Za-z]/g) ?? []).length;
  if (dev + lat === 0) return "none";
  if (dev >= 3 && lat >= 12) return "mixed";
  return dev > lat ? "hindi" : "english";
}

interface Scenario { id: string; title: string; pref: LangPref; replies: string[]; expect: { switchAfterReply?: number; to?: "hindi" | "english"; startLang?: "hindi" | "english"; timeReadback?: RegExp } }
const S: Scenario[] = [
  { id: "a", title: "stored preference Hindi", pref: "hindi", replies: ["हाँ, बोलिए", "हाँ, कर सकता हूँ", "साढ़े छह बजे आ जाऊँगा", "दो सौ रुपये", "ठीक है"], expect: { startLang: "hindi" } },
  { id: "b", title: "stored preference English", pref: "english", replies: ["Yes, go ahead", "Yes, I can do it", "I can come at 6:30 PM", "200 rupees", "OK"], expect: { startLang: "english" } },
  { id: "c", title: "unknown, person answers 'Hindi'", pref: undefined, replies: ["Hindi", "हाँ, बोलिए", "हाँ, कर सकता हूँ", "साढ़े छह बजे", "दो सौ रुपये", "ठीक है"], expect: { switchAfterReply: 1, to: "hindi" } },
  { id: "d", title: "English call, person says 'kaise ho, Hindi mein baat karo' at turn 2", pref: "english", replies: ["Yes, tell me", "kaise ho, Hindi mein baat karo", "haan, kar sakta hoon", "saadhe chhe baje", "do sau rupaye", "theek hai"], expect: { switchAfterReply: 2, to: "hindi" } },
  { id: "e", title: "Hindi call, person asks 'English please'", pref: "hindi", replies: ["हाँ, बोलिए", "English please", "Yes, I can do it", "6:30 PM", "200 rupees", "OK"], expect: { switchAfterReply: 2, to: "english" } },
  { id: "f", title: "provider call in Hindi, 'saadhe chhe baje aa jaunga, 200 rupaye'", pref: "hindi", replies: ["हाँ, बोलिए", "हाँ, कर सकता हूँ", "saadhe chhe baje aa jaunga, 200 rupaye", "हाँ, ठीक है"], expect: { startLang: "hindi", timeReadback: /6[:.]30|साढ़े\s*(छह|छः|6)/ } },
];

async function say(system: string, msgs: Anthropic.MessageParam[]): Promise<string> {
  const params = { model: MODEL, max_tokens: 1500, system, messages: msgs, output_config: { effort: "low" } };
  const res = await client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming);
  inTok += res.usage.input_tokens; outTok += res.usage.output_tokens;
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
}

const SYSTEM_WRAP = (brief: string) => `You are rehearsing a phone call in text. Below is the brief you were given for the call. Play the assistant exactly as the brief says. Say only the words you would say aloud in your next turn (one short turn, no stage directions, no notes, no JSON). When the task is done, say the closing line and stop.\n\n=== BRIEF ===\n${brief}`;

(async () => {
  const out: string[] = [`Language rehearsal (text only, no Fo, no phone). Model: ${MODEL}. Brief: provider call, fake data.\n`];
  let allPass = true;
  const results: string[] = [];
  for (const sc of S.slice(0, 8)) {
    const brief = buildProviderBrief({ ...job, lang: sc.pref });
    const msgs: Anthropic.MessageParam[] = [{ role: "user", content: "[The call connects. The person picks up and says: \"Hello?\"]" }];
    const turns: string[] = [];
    for (let t = 0; t < MAX_TURNS; t++) {
      const a = await say(SYSTEM_WRAP(brief), msgs);
      turns.push(a);
      msgs.push({ role: "assistant", content: a });
      if (t >= sc.replies.length) break;
      msgs.push({ role: "user", content: sc.replies[t] });
    }
    // checks
    const fails: string[] = [];
    const langs = turns.map(langOf);
    if (!turns[0].includes("Hogaya")) fails.push("'Hogaya' missing from the first turn");
    for (const b of banned) if (turns.some((x) => x.toLowerCase().includes(b.toLowerCase()))) fails.push(`banned name "${b}" appears`);
    const first = sc.pref === undefined ? 1 : 0; // the unknown call's first turn is the two-language question
    if (sc.expect.startLang) for (let i = first; i < turns.length; i++) if (langs[i] !== sc.expect.startLang && langs[i] !== "none") fails.push(`turn ${i + 1} is ${langs[i]}, expected ${sc.expect.startLang}`);
    if (sc.expect.to && sc.expect.switchAfterReply) {
      // assistant turn index n+1 follows person reply n (1-based): every turn from there on must be in the new language
      for (let i = sc.expect.switchAfterReply; i < turns.length; i++) if (langs[i] !== sc.expect.to && langs[i] !== "none") fails.push(`turn ${i + 1} is ${langs[i]}, expected ${sc.expect.to} after the switch`);
    }
    if (sc.expect.timeReadback && !turns.slice(3).some((x) => sc.expect.timeReadback!.test(x))) fails.push("6:30 PM was not read back correctly");
    const pass = fails.length === 0;
    allPass &&= pass;
    results.push(`(${sc.id}) ${pass ? "PASS" : "FAIL"}  ${sc.title}${pass ? "" : "\n      " + fails.join("\n      ")}`);
    out.push(`${"=".repeat(70)}\n(${sc.id}) ${sc.title}  =>  ${pass ? "PASS" : "FAIL"}\n${"=".repeat(70)}`);
    turns.forEach((x, i) => { out.push(`ASSISTANT [${langs[i]}]: ${x}`); if (i < sc.replies.length) out.push(`PERSON: ${sc.replies[i]}`); });
    if (!pass) out.push(`FAILED CHECKS: ${fails.join("; ")}`);
    out.push("");
  }
  const cost = inTok * PRICE_IN + outTok * PRICE_OUT;
  const summary = `${results.join("\n")}\n\nTokens: ${inTok} in, ${outTok} out. Estimated cost: $${cost.toFixed(4)} (about ₹${(cost * 90).toFixed(2)}) at ${MODEL} list prices.`;
  out.push(summary);
  const dir = join(homedir(), "Desktop", "Hogaya-Review");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "language-rehearsal.txt"), out.join("\n"));
  console.log(summary);
  console.log(allPass ? "ALL PASSED" : "SOME FAILED (see language-rehearsal.txt)");
  process.exit(allPass ? 0 : 1);
})().catch((e) => { console.error("FAILED", e instanceof Error ? e.message : e); process.exit(1); });
