"use server";

import { redirect } from "next/navigation";
import { passwordSchema } from "@/lib/admin/team-schema";
import { requireAdminForPasswordChange } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PasswordState {
  error: string | null;
}

export async function changeOwnPassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const admin = await requireAdminForPasswordChange();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (next !== confirm) return { error: "Las contraseñas nuevas no coinciden." };
  if (next === current) return { error: "La nueva contraseña debe ser distinta de la actual." };

  const supabase = await createSupabaseServerClient();
  // Confirmar la contraseña actual antes de cambiarla.
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: admin.email, password: current });
  if (authErr) return { error: "La contraseña actual no es correcta." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." };
  await supabase.rpc("admin_password_changed");
  redirect("/admin?clave=cambiada");
}
