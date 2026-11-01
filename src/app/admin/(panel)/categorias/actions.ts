"use server";

import { updateTag } from "next/cache";
import { type ActionResult, categorySchema, dbErrorMessage, fieldErrors } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveCategory(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const c = parsed.data;

  const row = {
    name: c.name,
    slug: c.slug,
    description: c.description || null,
    sort_order: c.sortOrder,
    is_active: c.isActive,
    seo_title: c.seoTitle || null,
    seo_description: c.seoDescription || null,
  };

  const supabase = await createSupabaseServerClient();
  const query = c.id
    ? supabase.from("categories").update(row).eq("id", c.id).select("id").single()
    : supabase.from("categories").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) return { ok: false, errors: dbErrorMessage(error) };

  updateTag("catalog");
  return { ok: true, id: data.id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  // Los productos de la categoría quedan "sin categoría" (on delete set null).
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("catalog");
  return { ok: true, id };
}
