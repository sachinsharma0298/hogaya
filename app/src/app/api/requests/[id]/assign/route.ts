import { NextResponse } from "next/server";
import { approvedPros } from "@/lib/live";
import { requireRole } from "@/lib/guard";
import { kick } from "@/lib/kick";
import { getRequest, simulatedProviders, updateRequest } from "@/lib/store";

export const maxDuration = 300;

// Operator: assign one specific Pro to a booking that has no booking yet. The normal flow then runs for that Pro only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { provider_id } = await req.json().catch(() => ({}));
  const r = await getRequest(id);
  if (!r) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (r.booking || ["cancelled", "completed", "closed"].includes(r.state)) return NextResponse.json({ error: "This booking already has a Pro or is finished." }, { status: 409 });
  // A simulated booking only takes simulated Pros; a live booking only takes onboarded Pros on the approved list.
  const pool = r.demo ? simulatedProviders().filter((p) => p.category === r.category) : await approvedPros(r.category);
  const pro = pool.find((p) => p.id === provider_id);
  if (!pro) return NextResponse.json({ error: "That Pro cannot be assigned to this booking (wrong category, or not approved for live calls)." }, { status: 400 });
  await updateRequest(id, (x) => {
    x.matched = [pro.id];
    x.skip_rest = false; x.skipped = []; x.awaiting_call = undefined; x.call_approved = undefined; x.customer_choice = undefined; x.not_selected = undefined;
    x.flags.forEach((f) => { if (!f.resolved_at) f.resolved_at = new Date().toISOString(); });
    x.events.push({ at: new Date().toISOString(), text: `Operator assigned ${pro.name} to this booking` });
  });
  // Back to the start of the provider step, whatever state it was stuck in (flagged and options_ready included).
  await updateRequest(id, (x) => { x.state = "calling_providers"; x.prev_state = undefined; x.step = "matching"; });
  kick(id);
  return NextResponse.json({ ok: true });
}
