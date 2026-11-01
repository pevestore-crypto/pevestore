"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const input = z.object({
  id: z.uuid(),
  status: z.enum(["new", "quoted", "won", "lost"]),
  adminNote: z.string().trim().max(2000),
});

export async function updateQuote(raw: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: { _: "Datos inválidos." } };
  const { id, status, adminNote } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("quote_requests").update({ status, admin_note: adminNote || null }).eq("id", id);
  if (error) return { ok: false, errors: { _: "No se pudo guardar." } };
  return { ok: true, id };
}
