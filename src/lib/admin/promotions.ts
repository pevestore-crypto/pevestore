import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { promotionPhase, type PromotionPhase } from "@/lib/domain/promotions";
import { utcToBusinessLocal } from "@/lib/domain/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PromotionInput } from "./promo-schema";

export interface PromotionRow {
  id: string;
  name: string;
  targetName: string;
  discountLabel: string;
  startsAt: string;
  endsAt: string;
  phase: PromotionPhase;
}

export async function listPromotions(): Promise<PromotionRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, name, discount_kind, discount_bps, fixed_unit_price_cents, starts_at, ends_at, is_active, products(name), categories(name)")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las promociones: ${error.message}`);
  const now = new Date();
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    targetName: (p.products as unknown as { name: string } | null)?.name ?? `Categoría: ${(p.categories as unknown as { name: string } | null)?.name ?? "—"}`,
    discountLabel: p.discount_kind === "percent" ? `−${p.discount_bps / 100} %` : `Precio fijo RD$${(Number(p.fixed_unit_price_cents) / 100).toLocaleString("es-DO")}`,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    phase: promotionPhase({ isActive: p.is_active, startsAt: p.starts_at, endsAt: p.ends_at }, now),
  }));
}

export async function getPromotion(id: string): Promise<PromotionInput> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase.from("promotions").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  return {
    id: p.id,
    name: p.name,
    target: p.product_id ? "product" : "category",
    productId: p.product_id ?? "",
    categoryId: p.category_id ?? "",
    discountKind: p.discount_kind,
    percent: p.discount_bps ? p.discount_bps / 100 : 10,
    fixedUnitPriceCents: Number(p.fixed_unit_price_cents ?? 0),
    startsLocal: utcToBusinessLocal(p.starts_at),
    endsLocal: utcToBusinessLocal(p.ends_at),
    messageStyle: p.message_style,
    headline: p.headline ?? "",
    body: p.body ?? "",
    ctaLabel: p.cta_label ?? "",
    showCountdown: p.show_countdown,
    isActive: p.is_active,
  };
}

export async function promotionTargets() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [products, categories] = await Promise.all([
    supabase.from("products").select("id, name, base_price_cents").order("name"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  return {
    products: (products.data ?? []).map((p) => ({ id: p.id, name: p.name, basePriceCents: Number(p.base_price_cents) })),
    categories: categories.data ?? [],
  };
}

export function nowLocalDefaults() {
  const now = new Date();
  const start = utcToBusinessLocal(now);
  const end = utcToBusinessLocal(new Date(now.getTime() + 7 * 86400000)).slice(0, 10) + "T23:59";
  return { start, end };
}
