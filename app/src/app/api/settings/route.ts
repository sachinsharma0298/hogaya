import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { getSettings, updateSettings } from "@/lib/store";
import { kickAll } from "@/lib/kick";

export const maxDuration = 60;

export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getSettings());
}

// Operator switches: "Simulate no reconfirm" (demo fallback) and "Autopilot" (default OFF).
export async function POST(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const b = await req.json().catch(() => ({}));
  const patch: { simulate_no_reconfirm?: boolean; autopilot?: boolean } = {};
  if (typeof b.simulate_no_reconfirm === "boolean") patch.simulate_no_reconfirm = b.simulate_no_reconfirm;
  if (typeof b.autopilot === "boolean") patch.autopilot = b.autopilot;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Invalid setting." }, { status: 400 });
  const settings = await updateSettings(patch);
  // Turning Autopilot ON picks up bookings that are waiting for a next step.
  if (patch.autopilot) kickAll();
  return NextResponse.json(settings);
}
