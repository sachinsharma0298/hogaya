import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listRequests } from "@/lib/store";

// The signed-in customer's own bookings only (matched by account, or by phone for older bookings).
export async function GET() {
  const u = await getSessionUser();
  if (!u || u.role !== "customer") return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const mine = (await listRequests({ customerId: u.id })).filter((r) => !r.archived);
  return NextResponse.json({
    bookings: mine.map((r) => ({ id: r.id, category: r.category, problem: r.problem, sector: r.sector, state: r.state, created_at: r.created_at })),
  });
}
