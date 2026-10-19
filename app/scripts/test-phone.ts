import assert from "node:assert/strict";
import { canonPhone, foMayCall, toE164 } from "../src/lib/phone";

assert.equal(toE164("9876543210"), "+919876543210");
assert.equal(toE164("+91 98765 43210"), "+919876543210");
assert.equal(toE164("+254 718 795 772"), "+254718795772");
assert.equal(toE164("+254718795772"), "+254718795772");
assert.equal(toE164("4718795772"), null, "a 10-digit number is Indian and this one is not a valid Indian mobile");
assert.equal(toE164("12345"), null);
assert.equal(canonPhone("0000000009"), "+910000000009"); // stored test numbers still compare
assert.equal(foMayCall("+919876543210"), true);
assert.equal(foMayCall("+254718795772"), false, "Kenya is not on the default call list");
console.log("ok  phone numbers: E.164, international, India default, Kenya warned");
