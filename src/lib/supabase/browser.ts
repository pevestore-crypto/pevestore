"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente del navegador: solo clave pública; lo que puede hacer lo decide RLS. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
