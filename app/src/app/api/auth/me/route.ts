import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProviders } from "@/lib/store";

export async function GET() {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ user: null });
  const provider = u.provider_id ? (await getProviders()).find((p) => p.id === u.provider_id) : undefined;
  // The person's own number goes back to their own browser only. The provider's KYC is a status and a date, never an ID number.
  return NextResponse.json({ user: { id: u.id, role: u.role, name: u.name, phone: u.phone.startsWith("demo-") ? "" : u.phone, provider_id: u.provider_id, review: u.review ?? "approved", approval_notice: u.role !== "operator" && u.review === "approved" && u.approval_seen === false, must_change_password: u.must_change_password === true }, provider });
}
