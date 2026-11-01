"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { type ActionResult, dbErrorMessage, fieldErrors, productSchema } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveProduct(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_save_product", { p: parsed.data });
  if (error) return { ok: false, errors: dbErrorMessage(error) };

  updateTag("catalog");
  return { ok: true, id: data as string };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, errors: { _: "Producto inválido." } };
  const supabase = await createSupabaseServerClient();

  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  if (images?.length) await supabase.storage.from("catalog").remove(images.map((i) => i.storage_path));

  updateTag("catalog");
  return { ok: true, id };
}

// ---------- Fotos ----------
// El navegador sube directo a Supabase con una URL firmada que solo emite el
// servidor tras verificar al administrador (evita el límite de tamaño de las
// funciones y no expone ninguna clave).

export async function createImageUpload(productId: string): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!UUID_RE.test(productId)) return { ok: false, error: "Producto inválido." };
  const path = `products/${productId}/${randomUUID()}.webp`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("catalog").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path, token: data.token };
}

export async function registerImage(productId: string, path: string, alt: string): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(productId) || !new RegExp(`^products/${productId}/[0-9a-f-]{36}\\.webp$`).test(path)) {
    return { ok: false, errors: { _: "Ruta de imagen inválida." } };
  }
  const supabase = await createSupabaseServerClient();

  // Confirmar que el archivo realmente se subió.
  const folder = `products/${productId}`;
  const name = path.slice(folder.length + 1);
  const { data: found } = await supabase.storage.from("catalog").list(folder, { search: name, limit: 1 });
  if (!found?.some((f) => f.name === name)) return { ok: false, errors: { _: "La imagen no llegó al almacenamiento." } };

  const { data: last } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, storage_path: path, alt: alt.slice(0, 160), sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, errors: dbErrorMessage(error) };

  updateTag("catalog");
  return { ok: true, id: data.id };
}

export async function deleteImage(imageId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: img } = await supabase.from("product_images").select("storage_path").eq("id", imageId).maybeSingle();
  if (!img) return { ok: false, errors: { _: "La imagen ya no existe." } };
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  await supabase.storage.from("catalog").remove([img.storage_path]);
  updateTag("catalog");
  return { ok: true, id: imageId };
}

/** Guarda el nuevo orden y los textos alternativos de las fotos de un producto. */
export async function saveImageOrder(productId: string, items: { id: string; alt: string }[]): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  for (const [index, item] of items.entries()) {
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: index, alt: item.alt.slice(0, 160) })
      .eq("id", item.id)
      .eq("product_id", productId);
    if (error) return { ok: false, errors: dbErrorMessage(error) };
  }
  updateTag("catalog");
  return { ok: true, id: productId };
}
