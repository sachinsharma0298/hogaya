// A call with an empty or incomplete script must never be dialled. No network, no Fo.
import assert from "node:assert/strict";
import { buildProviderBrief } from "../src/lib/briefs";
(async () => {
  const mod = await import("../src/lib/agent-service");
  const brief = buildProviderBrief({ providerPhone: "+919999900001", providerName: "Test Pro", category: "electrician", problem: "Fan not working since morning", sector: "New Kondli", timeWindow: "Tomorrow, 11:00 AM", notes: "", lang: undefined } as never);
  assert.ok(brief.length > 500, "a real brief is long");
  const { checkedBrief } = mod as unknown as { checkedBrief: (s: string) => string };
  assert.equal(checkedBrief(brief), brief.trim());
  for (const bad of ["", "   ", "Call +919999900001", "x".repeat(300)]) assert.throws(() => checkedBrief(bad), (e: Error) => e.name === "BriefError", `refuses: ${JSON.stringify(bad.slice(0, 20))}`);
  console.log("ok  an empty, short or number-less script is refused (BriefError) before anything is sent; a real brief passes");
  const line = "Never ask if this is the front desk or reception.";
  const { buildCustomerBrief, buildBookingBrief, buildReconfirmBrief, buildArrivalBrief } = await import("../src/lib/briefs");
  assert.ok(brief.includes(line), "provider brief has the front-desk line");
  assert.ok(buildBookingBrief({ providerPhone: "+919999900001", category: "electrician", problem: "x", sector: "s", address: "a", slot: "6 PM", slotExact: true, visitCharge: null } as never).includes(line));
  assert.ok(buildReconfirmBrief({ providerPhone: "+919999900001", category: "electrician", sector: "s", slot: "6 PM", slotExact: true, visitCharge: null } as never).includes(line));
  assert.ok(buildArrivalBrief({ providerPhone: "+919999900001", category: "electrician", sector: "s" }).includes(line));
  assert.ok(!buildCustomerBrief({ customerPhone: "+919999900002", customerName: "C", category: "electrician", problem: "x", sector: "s", timeWindow: "t", best: { providerName: "P", slot: "6 PM", slotExact: true, visitCharge: null, labourEstimate: null, afterInspection: false, bringsParts: null } } as never).includes(line), "the customer call does not get it");
  console.log("ok  Pro-facing briefs say 'individual tradesperson, not a front desk'; the customer brief is unchanged");
  console.log("ALL PASSED");
})();
