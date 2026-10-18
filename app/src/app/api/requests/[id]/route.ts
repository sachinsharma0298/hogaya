import { NextResponse } from "next/server";
import { requireBookingAccess } from "@/lib/guard";
import { customerView } from "@/lib/guard";
import { kick } from "@/lib/kick";
import { END_STATES } from "@/lib/state";
import { getProviders } from "@/lib/store";


export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireBookingAccess(id);
  if ("error" in access) return access.error;
  const r = access.request;
  // A simulated booking moves along while its customer watches the page. (Live bookings are moved by the timer and the operator console.)
  if (r.demo && !r.archived && !END_STATES.includes(r.state)) kick(id);
  // Customer screens never get provider phone numbers.
  const providers = (await getProviders()).map((p) => ({ ...p, phone: undefined }));
  // The booking page never needs the customer's phone number.
  const request = access.user.role === "operator" ? { ...r, customer: { ...r.customer, phone: "" } } : customerView(r);
  return NextResponse.json({ request, providers });
}
