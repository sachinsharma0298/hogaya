// npm run test:summarise-hindi -> Fo's call summary comes back in Hindi (Devanagari): Claude must still fill the same fields correctly.
// Calls the Claude API once (a few cents at most), never Fo. Skipped with a notice when there is no ANTHROPIC_API_KEY.
import assert from "node:assert/strict";
import { summaryToJson } from "../src/lib/summarise";

if (!process.env.ANTHROPIC_API_KEY) { console.log("SKIPPED: no ANTHROPIC_API_KEY (run with --env-file=.env.local)"); process.exit(0); }

const SUMMARY = `रमेश जी ने फ़ोन उठाया। उन्होंने कहा कि वे यह पंखे का काम कर सकते हैं। मैंने पूछा कि आप कितने बजे आ सकते हैं, तो उन्होंने कहा "साढ़े छह बजे आ जाऊँगा"। मैंने दोहराया: शाम साढ़े छह बजे, ठीक है? उन्होंने कहा "हाँ, ठीक है"। Visit charge दो सौ रुपये है। काम का खर्चा देखने के बाद बताएँगे। पार्ट ज़रूरत पड़ी तो वे ख़ुद लाएँगे। रिमाइंडर कॉल के लिए उन्होंने हाँ कहा।`;

(async () => {
  const j = await summaryToJson(SUMMARY, { timeWindow: "Today, 6–8 PM" });
  assert.equal(j.answered, true, "answered");
  assert.equal(j.can_do, true, "can_do");
  assert.equal(j.slot, "6:30 PM", `slot (got ${j.slot})`);
  assert.equal(j.slot_exact, true, "slot_exact");
  assert.equal(j.status, "confirmed", "status");
  assert.match(j.visit_charge ?? "", /200/, `visit_charge (got ${j.visit_charge})`);
  assert.equal(j.price_type === "after_inspection" || j.price_type === "fixed", true, `price_type (got ${j.price_type})`);
  assert.equal(j.brings_parts, true, "brings_parts");
  assert.equal(j.reminder_ok, true, "reminder_ok");
  assert.equal(j.opt_out, false, "opt_out");
  assert.equal(j.callback_requested, false, "callback_requested");
  console.log("ok  Hindi summary filled the same fields:", JSON.stringify({ slot: j.slot, slot_raw: j.slot_raw, visit_charge: j.visit_charge, price_type: j.price_type, status: j.status }));
  console.log("ALL PASSED");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
