// One place that decides who may call what. Every API route starts with one of these.
import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { getRequest } from "./store";
import type { HogayaRequest, Role, User } from "./types";

type Denied = { error: NextResponse };

export async function requireRole(...roles: Role[]): Promise<{ user: User } | Denied> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  if (user.must_change_password && user.role !== "operator") return { error: NextResponse.json({ error: "Please choose a new password first.", must_change_password: true }, { status: 403 }) };
  if (!roles.includes(user.role)) return { error: NextResponse.json({ error: "You do not have access to this." }, { status: 403 }) };
  return { user };
}

/** The booking, if the caller is its customer or the operator. Anyone else gets a "not found" (never a hint that it exists). */
export async function requireBookingAccess(id: string, opts: { customerOnly?: boolean } = {}): Promise<{ user: User; request: HogayaRequest } | Denied> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  if (user.must_change_password && user.role !== "operator") return { error: NextResponse.json({ error: "Please choose a new password first.", must_change_password: true }, { status: 403 }) };
  const request = await getRequest(id);
  const owner = Boolean(request) && request!.customer.user_id === user.id; // the operator can book as a customer too
  const operator = user.role === "operator" && !opts.customerOnly;
  if (!request || !(owner || operator)) return { error: NextResponse.json({ error: "Booking not found." }, { status: 404 }) };
  return { user, request };
}

/** The booking as its customer may see it: no Fo conversation ids, no call transcripts, no provider phone numbers. */
export function customerView(r: HogayaRequest): HogayaRequest {
  return {
    ...r,
    customer: { ...r.customer, phone: "" },
    calls: r.calls.map(({ fo_conversation_id, summary_text, operator_reply, question, ...c }) => c),
    flags: r.flags.map((f) => ({ ...f, reason: "" })),
  };
}
