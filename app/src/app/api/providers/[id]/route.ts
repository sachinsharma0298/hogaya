import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { updateProvider } from "@/lib/store";

// Operator: pause or resume AI calls to a Pro (opt-out), or fix their visit charge or area.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const p = await updateProvider(id, (x) => {
    if (typeof b.opt_out === "boolean") x.opt_out = b.opt_out;
    if (typeof b.area === "string" && b.area.trim()) x.area = b.area.trim().slice(0, 60);
    if (typeof b.visit_charge === "string" && /\d/.test(b.visit_charge)) x.visit_charge = `₹${Number(b.visit_charge.replace(/[^\d.]/g, ""))}`;
  });
  return p ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Pro not found." }, { status: 404 });
}
