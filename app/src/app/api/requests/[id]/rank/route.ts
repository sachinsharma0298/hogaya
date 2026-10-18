import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { getRequest, updateRequest } from "@/lib/store";

// Operator: rank the Pro after a successfully completed job (1 to 5). One ranking per booking; a new one replaces the old.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { stars, note } = await req.json().catch(() => ({}));
  const r = await getRequest(id);
  if (!r?.booking || r.booking.outcome !== "completed") return NextResponse.json({ error: "Only a completed job can be ranked." }, { status: 409 });
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) return NextResponse.json({ error: "Pick 1 to 5." }, { status: 400 });
  await updateRequest(id, (x) => {
    x.booking!.ranking = { stars: n, note: typeof note === "string" ? note.slice(0, 300) : "", by: auth.user.email ?? auth.user.name, at: new Date().toISOString() };
    x.events.push({ at: new Date().toISOString(), text: `Operator ranked the Pro ${n}/5` });
  });
  return NextResponse.json({ ok: true });
}
