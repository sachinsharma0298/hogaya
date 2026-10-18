import { NextResponse } from "next/server";
import { devLoginEnabled } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.json({ supabase: supabaseConfigured(), dev: devLoginEnabled() });
}
