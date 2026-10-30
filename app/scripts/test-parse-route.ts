// Calls POST /api/book/parse 3 times in a row on a RUNNING server (dev login on). Usage: npm run test:parse-route [http://localhost:3000]
const BASE = process.argv[2] ?? "http://localhost:3000";
(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "123456", role: "customer", name: "Parse Test", phone: "6000000066", email: "parse@test.in" }) });
  if (!login.ok) { console.log(`FAILED: could not log in (${login.status}); is DEV_LOGIN on?`); process.exit(1); }
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  let failed = 0;
  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/book/parse`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ text: "Bedroom ki light ka switch spark kar raha hai, kal shaam 6 baje ke baad, Sector 62 Noida" }) });
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 200 && body.category === "electrician";
    if (!ok) failed++;
    console.log(`call ${i}: ${res.status} ${Date.now() - t0}ms ${ok ? "PASS" : "FAIL " + JSON.stringify(body)}`);
  }
  console.log(failed ? `${failed} of 3 FAILED` : "ALL PASSED");
  process.exit(failed ? 1 : 0);
})();
