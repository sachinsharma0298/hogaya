import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { isSignedIn } from "@/lib/fo-mcp";

export async function GET() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ signedIn: await isSignedIn() });
}
