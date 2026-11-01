import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Cliente sin sesión (rol anónimo) para leer el catálogo público dentro de
 * funciones con "use cache". Solo ve lo que RLS permite a cualquier visitante.
 */
export function createSupabasePublicClient() {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
