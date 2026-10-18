import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { jobsFor } from "@/lib/pro-jobs";

// The signed-in Pro's own jobs. No customer phone or name, and never the service code.
export async function GET() {
  const u = await getSessionUser();
  if (u?.role !== "pro" || !u.provider_id) return NextResponse.json({ error: "Please log in as a Pro." }, { status: 401 });
  return NextResponse.json({ jobs: await jobsFor(u.provider_id) });
}
