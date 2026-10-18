import { NextResponse } from "next/server";
import { devLoginEnabled } from "@/lib/auth";
import { listProviders } from "@/lib/store";

// Local development only: the one-click Pro picker for the stand-in login.
export async function GET() {
  if (!devLoginEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ providers: (await listProviders()).map((p) => ({ id: p.id, name: p.name })) });
}
