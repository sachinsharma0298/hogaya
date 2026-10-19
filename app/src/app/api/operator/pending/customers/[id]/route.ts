import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { toE164 } from "@/lib/phone";
import { addApproved, findUser, isOperatorPhone, OPERATOR_PHONE_ERROR, setReview } from "@/lib/store";

// Operator only. Approve = add this email and phone to the approved list together (their next bookings are live). Reject = they stay in preview.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const action = (await req.json().catch(() => ({}))).action;
  const u = await findUser(id);
  if (!u || u.role !== "customer") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (action === "reject") { await setReview(id, "rejected"); return NextResponse.json({ ok: true }); }
  if (action !== "approve") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const phone = toE164(u.phone);
  if (!phone || !u.email) return NextResponse.json({ error: "This customer has no valid phone or email. Add them from the Approved tab instead." }, { status: 400 });
  if (await isOperatorPhone(phone)) return NextResponse.json({ error: OPERATOR_PHONE_ERROR }, { status: 409 });
  await addApproved({ phone, kind: "customer", name: u.name || u.email, email: u.email, added_by: auth.user.email ?? auth.user.name, note: "Approved from the pending list" });
  await setReview(id, "approved");
  return NextResponse.json({ ok: true });
}
