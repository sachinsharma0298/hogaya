import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { flagBooking, notify } from "@/lib/booking";
import { quoteLimit } from "@/lib/pro-jobs";
import { getRequest, updateProvider, updateRequest } from "@/lib/store";
import type { ProviderCallJson } from "@/lib/types";

const n = (v: unknown) => {
  const x = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(x) && x >= 0 ? Math.round(x) : NaN;
};

// The Pro's final bill after the work. It shows on the customer's booking page ("Not an invoice").
// If it is above the quote the booking is flagged; more than 20% above also lowers the Pro's reliability score.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getSessionUser();
  if (u?.role !== "pro" || !u.provider_id) return NextResponse.json({ error: "Please log in as a Pro." }, { status: 401 });
  const r = await getRequest(id);
  const b = r?.booking;
  if (!r || !b || b.provider_id !== u.provider_id || b.provider_confirmed === false) return NextResponse.json({ error: "This is not your booked job." }, { status: 403 });
  if (!b.arrival_verified_at) return NextResponse.json({ error: "Confirm your arrival with the service code first." }, { status: 409 });
  if (b.bill) return NextResponse.json({ error: "The bill was already sent." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const visit_fee = n(body.visit_fee), labour = n(body.labour), parts = n(body.parts);
  if ([visit_fee, labour, parts].some(Number.isNaN)) return NextResponse.json({ error: "Enter amounts as numbers." }, { status: 400 });
  const total = visit_fee + labour + parts;
  if (total <= 0 || total > 200000) return NextResponse.json({ error: "Check the amounts." }, { status: 400 });

  const now = new Date().toISOString();
  await updateRequest(id, (x) => {
    x.booking!.bill = { visit_fee, labour, parts, total, note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined, submitted_at: now };
    x.events.push({ at: now, text: `${u.name} sent the final bill: ₹${total}` });
  });
  await notify(id, "bill");

  // Compare with what the Pro quoted on the call.
  const j = r.calls.find((c) => c.kind === "provider" && c.provider_id === u.provider_id && c.status === "done")?.json as ProviderCallJson | undefined;
  const q = quoteLimit(j?.visit_charge ?? b.visit_charge, j?.labour_estimate ?? null);
  let flagged = false;
  if (q.total !== null && q.total > 0 && total > q.total) {
    const over = Math.round(((total - q.total) / q.total) * 100);
    await flagBooking(id, `Final bill ₹${total} is ${over}% above the quote (up to ₹${q.total})`, { halt: false });
    flagged = true;
    if (total > q.total * 1.2) {
      const p = await updateProvider(u.provider_id, (x) => void (x.reliability = Math.max(0, x.reliability - 5)));
      await updateRequest(id, (x) => void x.events.push({ at: now, text: `Bill is more than 20% above the quote: ${u.name}'s reliability lowered to ${p?.reliability}` }));
    }
  }
  return NextResponse.json({ ok: true, flagged });
}
