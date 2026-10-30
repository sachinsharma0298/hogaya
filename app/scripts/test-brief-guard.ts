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
  console.log("ALL PASSED");
})();
