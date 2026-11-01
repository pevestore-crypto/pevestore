"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { type BannerInput, bannerSchema } from "@/lib/admin/banner-schema";
import { type ActionResult, dbErrorMessage, fieldErrors } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { businessLocalToUtc } from "@/lib/domain/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createBannerUpload(): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  const path = `banners/${randomUUID()}.webp`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("catalog").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path, token: data.token };
}

export async function saveBanner(input: BannerInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const b = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Si se reemplazó una imagen, borrar la anterior del almacenamiento.
  let previous: { image_desktop_path: string; image_mobile_path: string | null } | null = null;
  if (b.id) previous = (await supabase.from("banners").select("image_desktop_path, image_mobile_path").eq("id", b.id).maybeSingle()).data;

  const row = {
    title: b.title,
    subtitle: b.subtitle || null,
    cta_label: b.ctaLabel || null,
    cta_href: b.ctaHref || null,
    image_desktop_path: b.imageDesktopPath,
    image_mobile_path: b.imageMobilePath || null,
    alt: b.alt || b.title,
    starts_at: b.startsLocal ? businessLocalToUtc(b.startsLocal).toISOString() : null,
    ends_at: b.endsLocal ? businessLocalToUtc(b.endsLocal).toISOString() : null,
    is_active: b.isActive,
    sort_order: b.sortOrder,
  };
  const { data, error } = b.id
    ? await supabase.from("banners").update(row).eq("id", b.id).select("id").single()
    : await supabase.from("banners").insert(row).select("id").single();
  if (error) return { ok: false, errors: dbErrorMessage(error) };

  if (previous) {
    const stale = [previous.image_desktop_path, previous.image_mobile_path].filter((p): p is string => !!p && p !== b.imageDesktopPath && p !== b.imageMobilePath);
    if (stale.length) await supabase.storage.from("catalog").remove(stale);
  }
  updateTag("banners");
  return { ok: true, id: data.id };
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: b } = await supabase.from("banners").select("image_desktop_path, image_mobile_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  const paths = [b?.image_desktop_path, b?.image_mobile_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("catalog").remove(paths);
  updateTag("banners");
  return { ok: true, id };
}
