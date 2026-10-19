import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { approvePerson, rejectPerson } from "@/lib/people";

// Operator only. Approve = add this email and phone to the approved list together (their next bookings are live). Reject = they stay in preview.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const action = (await req.json().catch(() => ({}))).action;
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const by = auth.user.email ?? auth.user.name;
  const r = action === "approve" ? await approvePerson(id, by) : await rejectPerson(id, by);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
