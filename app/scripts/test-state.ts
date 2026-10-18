// npm run test:state -> the booking state rules and the reminder timing. Pure checks: no database, no network, no calls.
import assert from "node:assert/strict";
import { ALLOWED, canMove, computeReconfirmAt, maxAttempts } from "../src/lib/state";
import type { BookingState } from "../src/lib/types";

const ST = Object.keys(ALLOWED) as BookingState[];
// the happy path is a chain of valid moves
const happy: BookingState[] = ["requested", "calling_providers", "options_ready", "calling_customer", "customer_chose", "booking_provider", "booked", "reconfirm_due", "reconfirmed", "pro_arrived", "arrived", "completed", "closed"];
for (let i = 0; i < happy.length - 1; i++) assert.ok(canMove(happy[i], happy[i + 1]), `${happy[i]} -> ${happy[i + 1]} must be allowed`);
console.log("ok  the full happy path is a chain of valid transitions");
// things that must never happen
const bad: [BookingState, BookingState][] = [["requested", "booked"], ["requested", "completed"], ["options_ready", "arrived"], ["booked", "arrived"], ["booked", "closed"], ["completed", "booked"], ["closed", "requested"], ["arrived", "booked"], ["calling_providers", "reconfirmed"], ["pro_arrived", "closed"]];
for (const [a, b] of bad) assert.ok(!canMove(a, b), `${a} -> ${b} must be refused`);
assert.ok(canMove("booked", "booked"));
assert.deepEqual(ALLOWED.closed, []);
assert.equal(ST.length, 16);
console.log(`ok  ${bad.length} invalid jumps are refused (for example requested -> booked, booked -> arrived without the Pro and customer steps)`);
// the code can only be issued after the Pro arrived: arrived is reachable only from pro_arrived (or the retired reconfirmed shortcut), never from booked
assert.ok(!canMove("booked", "arrived") && canMove("pro_arrived", "arrived"));
console.log("ok  'arrived' (code issued) is reachable only after 'pro_arrived'");

// attempts: mock bookings 4, live 2
assert.equal(maxAttempts({ demo: true }), 4);
assert.equal(maxAttempts({ demo: false }), process.env.FO_DRY_RUN === "1" ? 4 : 2);
console.log("ok  attempts: up to 4 for simulated bookings, 2 for real calls");

// timing (India time, UTC+5:30). Slot 6:00 PM today.
const IST = 5.5 * 3600_000;
const at = (h: number, m = 0) => { const d = new Date(Date.UTC(2026, 9, 20, h, m) - IST); return d.toISOString(); }; // 20 Oct 2026, IST clock time
const hm = (iso: string) => new Date(new Date(iso).getTime() + IST).toISOString().slice(11, 16);
const created = at(9);
assert.equal(hm(computeReconfirmAt("6:00 PM", at(9, 30), "Today evening", created)), "17:00"); // reminder at T-60
assert.equal(hm(computeReconfirmAt("6:00 PM", at(9, 30), "Today evening", created, 30, 10)), "17:30"); // confirmation call at T-30
assert.equal(hm(computeReconfirmAt("6:00 PM", at(17, 20), "Today evening", created)), "17:25"); // booked late: never sooner than 5 min after booking
assert.equal(hm(computeReconfirmAt("6:00 PM", at(17, 20), "Today evening", created, 30, 10)), "17:30");
assert.equal(hm(computeReconfirmAt("6:00 PM", at(17, 55), "Today evening", created, 30, 10)), "18:05"); // very late: after the booking call, not before it
const rem = new Date(computeReconfirmAt("6:00 PM", at(9, 30), "Today evening", created)).getTime();
const conf = new Date(computeReconfirmAt("6:00 PM", at(9, 30), "Today evening", created, 30, 10)).getTime();
assert.ok(conf - rem === 30 * 60_000, "the confirmation call comes 30 minutes after the reminder");
console.log("ok  reminder at T-60, confirmation call at T-30, never right after booking (5/10 minute floors)");
console.log("ALL PASSED");
