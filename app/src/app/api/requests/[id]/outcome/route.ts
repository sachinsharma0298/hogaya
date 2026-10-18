import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { recordOutcome } from "@/lib/outcome";

// Operator buttons: "Mark completed" / "Mark no-show". Both update the provider's reliability (demo formulas).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { outcome } = await req.json().catch(() => ({}));
  if (outcome !== "completed" && outcome !== "no_show") return NextResponse.json({ error: "Invalid outcome." }, { status: 400 });
  const res = await recordOutcome(id, outcome);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, reliability: res.reliability });
}
