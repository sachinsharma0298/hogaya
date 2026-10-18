import { NextResponse } from "next/server";
import { ensureProfile, safeNext } from "@/lib/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

const HOME = { customer: "/me", pro: "/pro", operator: "/operator" } as const;

// The one-click link Hogaya sends to a customer it added. Works in any browser (no code verifier needed).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = () => NextResponse.redirect(new URL("/login?error=1", url.origin));
  const token_hash = url.searchParams.get("token_hash");
  if (!token_hash || !supabaseConfigured() || url.searchParams.get("type") !== "magiclink") return fail();
  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ token_hash, type: "magiclink" });
  if (error) return fail();
  const { data } = await sb.auth.getUser();
  if (!data.user) return fail();
  const user = await ensureProfile(data.user);
  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next"), HOME[user.role]), url.origin));
}
