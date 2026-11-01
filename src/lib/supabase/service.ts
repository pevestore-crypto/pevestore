import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Cliente con la clave secreta: ignora RLS. Solo para operaciones del
 * servidor que el público no puede hacer por sí mismo (registrar pedidos,
 * guardar comprobantes). Nunca se importa desde código de cliente.
 */
export function createSupabaseServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. Revisa .env.local.");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
