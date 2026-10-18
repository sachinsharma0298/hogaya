import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { startAuth } from "@/lib/fo-mcp";

// Open this URL in the browser once. It sends you to Wajo to sign in, then back to /api/fo/callback.
export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  try {
    const url = await startAuth();
    if (!url) return NextResponse.json({ signedIn: true, note: "Already signed in to Fo." });
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
