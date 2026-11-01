"use server";

import { z } from "zod";
import { type ActionResult, fieldErrors } from "@/lib/admin/catalog-schema";
import { newStaffSchema, passwordSchema } from "@/lib/admin/team-schema";
import { requireOwner } from "@/lib/auth/dal";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Gestión del equipo (solo dueño). Crear y borrar usuarios de acceso requiere
 * la clave secreta de Supabase, que solo existe en el servidor.
 */
export async function createStaff(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = newStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const db = createSupabaseServiceClient();

  const { data, error } = await db.auth.admin.createUser({ email: s.email, password: s.tempPassword, email_confirm: true });
  if (error || !data.user) {
    const exists = /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, errors: exists ? { email: "Ya existe un usuario con ese correo." } : { _: "No se pudo crear el usuario. Revisa la contraseña o inténtalo de nuevo." } };
  }
  const { error: rowErr } = await db
    .from("admin_users")
    .insert({ user_id: data.user.id, full_name: s.fullName, role: s.role, must_change_password: true });
  if (rowErr) {
    await db.auth.admin.deleteUser(data.user.id);
    return { ok: false, errors: { _: "No se pudo registrar al usuario en el equipo." } };
  }
  return { ok: true, id: data.user.id };
}

const roleInput = z.object({ userId: z.uuid(), role: z.enum(["owner", "staff"]) });

export async function changeRole(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = roleInput.safeParse(input);
  if (!parsed.success) return { ok: false, errors: { _: "Datos inválidos." } };
  const { error } = await createSupabaseServiceClient().from("admin_users").update({ role: parsed.data.role }).eq("user_id", parsed.data.userId);
  if (error) return { ok: false, errors: { _: error.message.includes("al menos un dueño") ? "Debe quedar al menos un dueño." : "No se pudo cambiar el rol." } };
  return { ok: true, id: parsed.data.userId };
}

export async function resetPassword(userId: string, tempPassword: string): Promise<ActionResult> {
  const me = await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { ok: false, errors: { _: "Usuario inválido." } };
  if (userId === me.id) return { ok: false, errors: { _: "Para tu propia cuenta usa “Cambiar mi contraseña”." } };
  const pw = passwordSchema.safeParse(tempPassword);
  if (!pw.success) return { ok: false, errors: { tempPassword: pw.error.issues[0].message } };
  const db = createSupabaseServiceClient();
  const { error } = await db.auth.admin.updateUserById(userId, { password: tempPassword });
  if (error) return { ok: false, errors: { _: "No se pudo cambiar la contraseña." } };
  await db.from("admin_users").update({ must_change_password: true }).eq("user_id", userId);
  // Cierra sus sesiones abiertas: tendrá que entrar con la nueva contraseña.
  await db.auth.admin.signOut(userId).catch(() => undefined);
  return { ok: true, id: userId };
}

export async function removeStaff(userId: string): Promise<ActionResult> {
  const me = await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { ok: false, errors: { _: "Usuario inválido." } };
  if (userId === me.id) return { ok: false, errors: { _: "No puedes quitarte a ti mismo." } };
  const db = createSupabaseServiceClient();
  const { error } = await db.from("admin_users").delete().eq("user_id", userId);
  if (error) return { ok: false, errors: { _: error.message.includes("al menos un dueño") ? "Debe quedar al menos un dueño." : "No se pudo quitar al usuario." } };
  // Sin fila en admin_users ya no entra al panel; además se elimina su acceso.
  await db.auth.admin.deleteUser(userId);
  return { ok: true, id: userId };
}
