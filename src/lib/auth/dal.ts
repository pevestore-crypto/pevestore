import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: "owner" | "staff";
}

/**
 * Capa de acceso: valida la sesión con Supabase (no solo lee la cookie) y
 * exige que el usuario esté en admin_users. Toda página y acción del panel
 * pasa por aquí antes de tocar datos. `cache` evita repetir la consulta
 * dentro de una misma petición.
 */
export const requireAdmin = cache(async (): Promise<AdminUser> => {
  // Supabase lee la hora actual al validar el token: solo en tiempo de petición.
  await connection();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("full_name, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) redirect("/admin/login?error=sin-acceso");

  return { id: user.id, email: user.email ?? "", fullName: admin.full_name, role: admin.role };
});

export async function requireOwner(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== "owner") redirect("/admin");
  return admin;
}
