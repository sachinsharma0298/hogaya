import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { arrivalSummaryToJson, bookingSummaryToJson, customerSummaryToJson, reconfirmSummaryToJson, summaryToJson } from "@/lib/summarise";

// Dev helper: check that Claude turns a call summary into the right JSON. No Fo calls. Disabled in production.
export async function POST(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { kind = "provider", text, timeWindow, requestedAt, names, slot } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "Send {text}" }, { status: 400 });
  try {
    if (kind === "customer") return NextResponse.json(await customerSummaryToJson(text, names ?? ["Ramesh Kumar", "Suresh Yadav"]));
    if (kind === "arrival") return NextResponse.json(await arrivalSummaryToJson(text));
    if (kind === "reconfirm") return NextResponse.json(await reconfirmSummaryToJson(text));
    if (kind === "booking") return NextResponse.json(await bookingSummaryToJson(text, { slot }));
    return NextResponse.json(await summaryToJson(text, { timeWindow, requestedAt }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***") : "failed" }, { status: 500 });
  }
}
