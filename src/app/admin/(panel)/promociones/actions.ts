"use server";

import { updateTag } from "next/cache";
import { type ActionResult, dbErrorMessage, fieldErrors } from "@/lib/admin/catalog-schema";
import { promotionSchema } from "@/lib/admin/promo-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { businessLocalToUtc } from "@/lib/domain/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function savePromotion(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const p = parsed.data;
  const supabase = await createSupabaseServerClient();

  if (p.discountKind === "fixed_unit_price") {
    const { data: prod } = await supabase.from("products").select("base_price_cents").eq("id", p.productId).maybeSingle();
    if (prod && p.fixedUnitPriceCents >= Number(prod.base_price_cents)) {
      return { ok: false, errors: { fixedUnitPriceCents: "El precio de oferta debe ser menor que el precio normal." } };
    }
  }

  const row = {
    name: p.name,
    product_id: p.target === "product" ? p.productId : null,
    category_id: p.target === "category" ? p.categoryId : null,
    discount_kind: p.discountKind,
    discount_bps: p.discountKind === "percent" ? Math.round(p.percent * 100) : null,
    fixed_unit_price_cents: p.discountKind === "fixed_unit_price" ? p.fixedUnitPriceCents : null,
    // Las fechas se capturan en hora de RD y se guardan como instantes UTC.
    starts_at: businessLocalToUtc(p.startsLocal).toISOString(),
    ends_at: businessLocalToUtc(p.endsLocal).toISOString(),
    message_style: p.messageStyle,
    headline: p.headline || null,
    body: p.body || null,
    cta_label: p.ctaLabel || null,
    show_countdown: p.showCountdown,
    is_active: p.isActive,
  };
  const { data, error } = p.id
    ? await supabase.from("promotions").update(row).eq("id", p.id).select("id").single()
    : await supabase.from("promotions").insert(row).select("id").single();
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("promotions");
  return { ok: true, id: data.id };
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("promotions");
  return { ok: true, id };
}
