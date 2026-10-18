"use client";
// Supabase in the browser: only the public URL and anon key are used here.
import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowser = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
