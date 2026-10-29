import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { approvedPros } from "@/lib/live";
import { MODE } from "@/lib/mode";

// Which categories run with real calls: the server is in real mode and at least one approved Pro does the job.
// Only category names are returned (no Pro details), so it is safe to show on public pages. The live gate itself is unchanged (lib/live.ts).
export async function GET() {
  const categories = [];
  if (MODE === "real") for (const c of CATEGORIES) if ((await approvedPros(c)).length > 0) categories.push(c);
  return NextResponse.json({ categories }, { headers: { "Cache-Control": "public, max-age=60" } });
}
