import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { requireRole } from "@/lib/guard";
import { getOperatorProfile, listPendingCustomers, listPendingPros, listRequests, phoneInUseByOthers, saveOperatorProfile } from "@/lib/store";

// Operator only: display name and phone. The email and password are not editable here.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const [all, pc, pp] = await Promise.all([listRequests(), listPendingCustomers(), listPendingPros()]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const done = (s: string) => s === "completed" || s === "closed";
  const stats = {
    total: all.length,
    live: all.filter((r) => !r.archived && !done(r.state) && r.state !== "cancelled").length, // still moving: not finished, not cancelled
    completed: all.filter((r) => done(r.state)).length,
    flagged: all.filter((r) => r.state === "flagged" || r.flags.some((f) => !f.resolved_at)).length,
    pending: pc.length + pp.length,
    calls_week: all.reduce((n, r) => n + r.calls.filter((c) => new Date(c.started_at).getTime() >= weekAgo).length, 0),
  };
  return NextResponse.json({ ...(await getOperatorProfile()), email: auth.user.email ?? "", stats });
}

export async function PUT(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const raw = String(b.phone ?? "").trim();
  const phone = raw ? toE164(raw) : "";
  if (name.length < 2) return NextResponse.json({ error: "Enter a display name (at least 2 characters)." }, { status: 400 });
  if (phone === null) return NextResponse.json({ error: "Enter a valid phone number (with country code), or leave it empty." }, { status: 400 });
  if (phone && (await phoneInUseByOthers(phone))) return NextResponse.json({ error: "A Pro, approved person or customer already uses this number. The operator's number is reserved, so use a different one." }, { status: 409 });
  await saveOperatorProfile(name, phone);
  return NextResponse.json({ ok: true, ...(await getOperatorProfile()) });
}
