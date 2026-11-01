import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { utcToBusinessLocal } from "@/lib/domain/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BannerInput } from "./banner-schema";

export async function listBanners() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("banners").select("*").order("sort_order").order("updated_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los banners: ${error.message}`);
  const now = Date.now();
  return data.map((b) => {
    const started = !b.starts_at || new Date(b.starts_at).getTime() <= now;
    const ended = b.ends_at && new Date(b.ends_at).getTime() <= now;
    const phase = !b.is_active ? "Pausado" : ended ? "Terminado" : !started ? "Programado" : "Visible";
    return { id: b.id as string, title: b.title as string, imagePath: b.image_desktop_path as string, sortOrder: b.sort_order as number, phase };
  });
}

export async function getBanner(id: string): Promise<BannerInput> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: b } = await supabase.from("banners").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle ?? "",
    ctaLabel: b.cta_label ?? "",
    ctaHref: b.cta_href ?? "",
    imageDesktopPath: b.image_desktop_path,
    imageMobilePath: b.image_mobile_path ?? "",
    alt: b.alt ?? "",
    startsLocal: b.starts_at ? utcToBusinessLocal(b.starts_at) : "",
    endsLocal: b.ends_at ? utcToBusinessLocal(b.ends_at) : "",
    isActive: b.is_active,
    sortOrder: b.sort_order,
  };
}
