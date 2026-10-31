// npm run test:fo-json -> Fo's own JSON is read exactly (customer choice, partial pro answers). No network, no Claude, no calls.
import assert from "node:assert/strict";
import { customerFromFoJson, parseFoJson, sanitize } from "../src/lib/summarise";

// Pranjal's real result from Fo (booking r-5hz4fv), notes shortened; the Hindi stays.
const PRANJAL = '{"confirmed": true, "preferred_option": "shankar", "notes": "ग्राहक ने कहा: हाँ confirm है, शंकर जी ठीक हैं"}';
const OFFERED = ["Shankar Lal", "Dashrath Sharma"];

const c = customerFromFoJson(`Call done. Pranjal agreed.\n\`\`\`json\n${PRANJAL}\n\`\`\``, OFFERED);
assert.equal(c?.confirmed, true);
assert.equal(c?.preferred_option, "Shankar Lal", "lower-case first name matches the offered Pro");
assert.match(c?.notes ?? "", /हाँ confirm है/, "Hindi in notes survives");
assert.equal(customerFromFoJson('{confirmed: true, preferred_option: "  DASHRATH  ", notes: "ok"}', OFFERED)?.preferred_option, "Dashrath Sharma", "unquoted keys, upper case, spaces");
assert.equal(customerFromFoJson('{"confirmed": false, "preferred_option": null, "notes": ""}', OFFERED)?.confirmed, false);
assert.equal(customerFromFoJson("no json here", OFFERED), null);
assert.deepEqual(parseFoJson("a {not json} b {\"x\": 1}"), { x: 1 });
console.log("ok  customer JSON: Pranjal's yes parses as confirmed with Shankar chosen (case, spaces, Hindi notes)");

// Dashrath: Fo returned "partial" (he hung up when Fo redialled) but gave can_do, one time and the visit charge.
const DASHRATH = { answered: true, can_do: true, slot: "12:45 PM", slot_raw: "पौने एक", slot_exact: true, visit_charge: "200", status: "partial", opt_out: false, callback_requested: false, notes: "" };
const d = sanitize(DASHRATH);
assert.equal(d.status, "confirmed"); assert.equal(d.slot, "12:45 PM"); assert.equal(d.visit_charge, "200"); assert.equal(d.slot_exact, true);
assert.equal(sanitize({ ...DASHRATH, visit_charge: null }).status, "unclear", "partial without a visit charge is not usable");
assert.equal(sanitize({ ...DASHRATH, slot: null }).status, "unclear", "partial without a time is not usable");
assert.equal(sanitize({ ...DASHRATH, can_do: false }).status, "unclear", "partial where he cannot come is not usable");
assert.equal(sanitize({ ...DASHRATH, status: "declined", can_do: false }).status, "declined");
console.log("ok  partial pro answer (can do + time + visit charge) counts as confirmed; missing pieces do not");
console.log("ALL PASSED");
