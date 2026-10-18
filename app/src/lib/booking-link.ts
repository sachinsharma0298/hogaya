// A one-click sign-in link for a customer Hogaya added: opens the booking form already signed in as that email.
import { supabaseAdmin, supabaseConfigured } from "./supabase/server";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function bookingLink(email: string): Promise<string> {
  const fallback = `${appUrl()}/login?next=/book`;
  if (!supabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return fallback; // no Supabase: they sign in on the normal page
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return fallback;
  return `${appUrl()}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink&next=${encodeURIComponent("/book")}`;
}
