import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { createApprovedPro } from "@/lib/onboard";
import { findProviderByEmail, getPendingPro, isOperatorPhone, listProviders, OPERATOR_PHONE_ERROR, setPendingProStatus } from "@/lib/store";

// Operator only. Approve = create the Pro, their approved number and (already made at sign-up) their login. Reject = nothing is created.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const action = (await req.json().catch(() => ({}))).action;
  const p = await getPendingPro(id);
  if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (action === "reject") { await setPendingProStatus(id, "rejected"); return NextResponse.json({ ok: true }); }
  if (action !== "approve") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  if (await isOperatorPhone(p.phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  if ((await findProviderByEmail(p.email)) || (await listProviders()).some((x) => x.phone === p.phone)) return NextResponse.json({ error: "A Pro with this phone or email already exists." }, { status: 409 });
  await createApprovedPro({ name: p.name, phone: p.phone, email: p.email, area: p.area, visit: Number(p.visit_charge.replace(/[^\d.]/g, "")), categories: p.categories, consentDate: p.consent_at.slice(0, 10), by: auth.user.email ?? auth.user.name, note: "Approved from the pending list" });
  await setPendingProStatus(id, "approved");
  return NextResponse.json({ ok: true });
}
