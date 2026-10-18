import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { buildArrivalBrief, buildBookingBrief, buildCustomerBrief, buildProviderBrief, buildReconfirmBrief } from "@/lib/briefs";

// Dev helper: preview the briefs for an example request. Does not call anyone. Phone numbers and the address are fake.
export async function GET(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "provider";
  const job = { category: "electrician", problem: "Mera Phanka khrab hai chal nhi raha h aj subah se", sector: "New Kondli", timeWindow: "Now (1–2 hours)" };
  const opt = (name: string, slot: string, exact: boolean) => ({ providerName: name, slot, slotExact: exact, visitCharge: "₹150", labourEstimate: null, afterInspection: true, bringsParts: true });
  const text =
    kind === "customer"
      ? buildCustomerBrief({ customerPhone: "+91XXXXXXXXXX", customerName: "Asha", ...job, best: opt("Ramesh Kumar", "6:15 PM", true), second: opt("Suresh Yadav", "7–8 PM", false), reason: "Exact time confirmed (6:15 PM)" })
      : kind === "arrival"
        ? buildArrivalBrief({ providerPhone: "+91XXXXXXXXXX", category: "electrician", sector: "New Kondli" })
      : kind === "reconfirm"
        ? buildReconfirmBrief({ providerPhone: "+91XXXXXXXXXX", category: "electrician", sector: "New Kondli", slot: "5–8 PM", slotExact: false, visitCharge: "₹150" })
      : kind === "booking"
        ? buildBookingBrief({ providerPhone: "+91XXXXXXXXXX", ...job, address: "H-12 (example address)", slot: "5–8 PM", slotExact: false, visitCharge: "₹150" })
        : buildProviderBrief({ providerPhone: "+91XXXXXXXXXX", ...job, notes: "brand Usha" });
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
