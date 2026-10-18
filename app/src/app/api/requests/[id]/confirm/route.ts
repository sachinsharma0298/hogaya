import { NextResponse } from "next/server";
import { requireBookingAccess } from "@/lib/guard";
import { setCustomerChoice } from "@/lib/live-actions";
import { bookNow } from "@/lib/orchestrator";
import { getRequest } from "@/lib/store";

// "Confirm on screen": the customer's backup to the Fo callback.
// Demo requests book straight away. Live requests only record the choice; the operator then clicks "Call provider to book".
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireBookingAccess(id, { customerOnly: true });
  if ("error" in access) return access.error;
  const { provider_id } = await req.json().catch(() => ({}));
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (!r.matched.includes(provider_id)) return NextResponse.json({ error: "Invalid option." }, { status: 400 });
  if (r.booking) return NextResponse.json({ ok: true });
  await setCustomerChoice(id, provider_id, "screen");
  if (r.demo) await bookNow(id, provider_id, "screen");
  return NextResponse.json({ ok: true });
}
