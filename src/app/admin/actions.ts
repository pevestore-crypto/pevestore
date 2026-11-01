"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
  email: string;
}

/** Solo rutas internas del panel: evita redirecciones abiertas a otros sitios. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(next) && !next.startsWith("/admin/login") ? next : "/admin";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Escribe tu correo y tu contraseña.", email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Mensaje genérico: no revela si el correo existe.
    const tooMany = error?.status === 429;
    return {
      error: tooMany ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." : "Correo o contraseña incorrectos.",
      email,
    };
  }

  const { data: admin } = await supabase.from("admin_users").select("role").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "Esta cuenta no tiene acceso al panel.", email };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
