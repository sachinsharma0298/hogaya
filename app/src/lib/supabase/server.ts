// Supabase clients for the server. The browser-facing one uses the public anon key and the user's own session cookie;
// the admin one uses the secret service-role key and must never be imported from client code.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = () => Boolean(supabaseUrl() && supabaseAnonKey());

/** A client acting as the signed-in user (reads the session from cookies). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component: the proxy refreshes the session cookie instead.
        }
      },
    },
  });
}

/** Full-access client for server jobs (for example creating a sign-in link for a customer Hogaya added). Server only. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl() || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
