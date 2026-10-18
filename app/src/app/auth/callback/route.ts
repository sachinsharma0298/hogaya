import { NextResponse } from "next/server";
import { ensureProfile, safeNext } from "@/lib/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

const HOME = { customer: "/me", pro: "/pro", operator: "/operator" } as const;

// Where the magic link and the Google sign-in come back to. Swaps the one-time code for a session cookie.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = () => NextResponse.redirect(new URL("/login?error=1", url.origin));
  const code = url.searchParams.get("code");
  if (!code || !supabaseConfigured()) return fail();
  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return fail();
  const { data } = await sb.auth.getUser();
  if (!data.user) return fail();
  const user = await ensureProfile(data.user);
  const next = safeNext(url.searchParams.get("next"), HOME[user.role]);
  return NextResponse.redirect(new URL(next, url.origin));
}
