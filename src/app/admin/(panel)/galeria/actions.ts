"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbErrorMessage, fieldErrors } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const designSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]),
  path: z.string().regex(/^designs\/[0-9a-f-]{36}\.webp$/, "Sube la imagen del diseño."),
  title: z.string().trim().min(2, "Ponle un nombre.").max(80),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  productIds: z.array(z.uuid()).max(200),
});
export type DesignInput = z.infer<typeof designSchema>;

export async function createDesignUpload(): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  const path = `designs/${randomUUID()}.webp`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("catalog").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path, token: data.token };
}

export async function saveDesign(input: DesignInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const row = { title: d.title, storage_path: d.path, is_active: d.isActive, sort_order: d.sortOrder };
  const { data, error } = d.id
    ? await supabase.from("designs").update(row).eq("id", d.id).select("id").single()
    : await supabase.from("designs").insert(row).select("id").single();
  if (error) return { ok: false, errors: dbErrorMessage(error) };

  // Productos donde se ofrece este diseño.
  await supabase.from("design_products").delete().eq("design_id", data.id);
  if (d.productIds.length) {
    const { error: linkErr } = await supabase.from("design_products").insert(d.productIds.map((product_id) => ({ design_id: data.id, product_id })));
    if (linkErr) return { ok: false, errors: dbErrorMessage(linkErr) };
  }
  updateTag("catalog");
  return { ok: true, id: data.id };
}

export async function deleteDesign(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: d } = await supabase.from("designs").select("storage_path").eq("id", id).maybeSingle();
  // Los pedidos que lo usaron conservan la referencia en blanco (on delete set null).
  const { error } = await supabase.from("designs").delete().eq("id", id);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  if (d?.storage_path) await supabase.storage.from("catalog").remove([d.storage_path]);
  updateTag("catalog");
  return { ok: true, id };
}
