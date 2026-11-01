import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { PricingPolicy, PriceTier } from "@/lib/domain/pricing";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * Catálogo público. Todo se cachea con la etiqueta "catalog"; el panel la
 * invalida con updateTag("catalog") al guardar, así los cambios se ven al
 * instante y el resto del tiempo las páginas se sirven sin consultar la BD.
 */

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  /** Precio más bajo posible por unidad (rangos por cantidad incluidos). */
  fromPriceCents: number;
  basePriceCents: number;
  imagePath: string | null;
  imageAlt: string;
  availability: "available" | "on_request" | "unavailable";
  isFeatured: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  minQty: number;
  maxQty: number;
  productionDays: number | null;
  allowsOwnDesign: boolean;
  allowsGallery: boolean;
  allowsIdea: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  tiers: PriceTier[];
  variants: { id: string; name: string; priceDeltaCents: number }[];
  surcharges: { id: string; label: string; amountCents: number; per: "unit" | "order"; customizationMode: "own_design" | "gallery" | "idea" | null }[];
  images: { path: string; alt: string }[];
}

type Row = Record<string, unknown>;

const SUMMARY_SELECT =
  "id, category_id, slug, name, short_description, base_price_cents, availability, is_featured, sort_order, categories(slug, name, is_active), price_tiers(unit_price_cents), product_images(storage_path, alt, sort_order)";

function toSummary(p: Row): ProductSummary {
  const tiers = (p.price_tiers as { unit_price_cents: number }[]) ?? [];
  const images = ((p.product_images as { storage_path: string; alt: string; sort_order: number }[]) ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const category = p.categories as { slug: string; name: string; is_active: boolean } | null;
  const base = Number(p.base_price_cents);
  return {
    id: p.id as string,
    slug: p.slug as string,
    name: p.name as string,
    shortDescription: (p.short_description as string | null) ?? null,
    // Para emparejar ofertas por categoría, igual que el servidor al cobrar.
    categoryId: (p.category_id as string | null) ?? null,
    categorySlug: category?.is_active ? category.slug : null,
    categoryName: category?.is_active ? category.name : null,
    basePriceCents: base,
    fromPriceCents: Math.min(base, ...tiers.map((t) => Number(t.unit_price_cents))),
    imagePath: images[0]?.storage_path ?? null,
    imageAlt: images[0]?.alt || (p.name as string),
    availability: p.availability as ProductSummary["availability"],
    isFeatured: p.is_featured as boolean,
  };
}

export async function getCategories(): Promise<PublicCategory[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient()
    .from("categories")
    .select("id, slug, name, description, seo_title, seo_description")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Catálogo no disponible: ${error.message}`);
  return data.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    seoTitle: c.seo_title,
    seoDescription: c.seo_description,
  }));
}

export async function getProducts(): Promise<ProductSummary[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient()
    .from("products")
    .select(SUMMARY_SELECT)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Catálogo no disponible: ${error.message}`);
  return data.map(toSummary);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const { data: p, error } = await createSupabasePublicClient()
    .from("products")
    .select(
      `${SUMMARY_SELECT}, description, min_qty, max_qty, production_days, allows_own_design, allows_gallery, allows_idea, seo_title, seo_description,
       tiers:price_tiers(min_qty, max_qty, unit_price_cents),
       product_variants(id, name, price_delta_cents, sort_order),
       product_surcharges(id, label, amount_cents, per, customization_mode),
       design_products(design_id)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Catálogo no disponible: ${error.message}`);
  if (!p) return null;

  const summary = toSummary(p);
  type Tier = { min_qty: number; max_qty: number | null; unit_price_cents: number };
  type Variant = { id: string; name: string; price_delta_cents: number; sort_order: number };
  type Surcharge = { id: string; label: string; amount_cents: number; per: "unit" | "order"; customization_mode: ProductDetail["surcharges"][number]["customizationMode"] };
  type Image = { storage_path: string; alt: string; sort_order: number };

  return {
    ...summary,
    description: p.description,
    minQty: p.min_qty,
    maxQty: p.max_qty,
    productionDays: p.production_days,
    allowsOwnDesign: p.allows_own_design,
    // Sin diseños en la galería la opción no tiene sentido para el cliente.
    allowsGallery: p.allows_gallery && ((p.design_products as unknown[]) ?? []).length > 0,
    allowsIdea: p.allows_idea,
    seoTitle: p.seo_title,
    seoDescription: p.seo_description,
    tiers: ((p as unknown as { tiers: Tier[] }).tiers)
      .sort((a, b) => a.min_qty - b.min_qty)
      .map((t) => ({ minQty: t.min_qty, maxQty: t.max_qty, unitPriceCents: Number(t.unit_price_cents) })),
    variants: (p.product_variants as Variant[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, name: v.name, priceDeltaCents: Number(v.price_delta_cents) })),
    surcharges: (p.product_surcharges as Surcharge[]).map((s) => ({
      id: s.id,
      label: s.label,
      amountCents: Number(s.amount_cents),
      per: s.per,
      customizationMode: s.customization_mode,
    })),
    images: (p.product_images as Image[]).sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ path: i.storage_path, alt: i.alt || p.name })),
  };
}

export interface PublicService {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  asksMeasurements: boolean;
  asksMaterial: boolean;
}

export async function getServices(): Promise<PublicService[]> {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient()
    .from("services")
    .select("id, slug, name, description, asks_measurements, asks_material")
    .order("sort_order");
  if (error) throw new Error(`Servicios no disponibles: ${error.message}`);
  return data.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    asksMeasurements: s.asks_measurements,
    asksMaterial: s.asks_material,
  }));
}

export interface PublicPromotion {
  id: string;
  name: string;
  productId: string | null;
  categoryId: string | null;
  discount: { kind: "percent"; bps: number } | { kind: "fixed_unit_price"; unitPriceCents: number };
  startsAt: string;
  endsAt: string;
  messageStyle: "fire" | "last_days" | "gift";
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  showCountdown: boolean;
}

/**
 * Ofertas en curso (RLS solo deja ver las vigentes). Caché corta: una oferta
 * programada aparece al minuto de empezar; la que vence se oculta en el
 * navegador por su fecha y el servidor nunca la cobra.
 */
export async function getActivePromotions(): Promise<PublicPromotion[]> {
  "use cache";
  cacheTag("promotions");
  cacheLife("minutes");
  const { data, error } = await createSupabasePublicClient()
    .from("promotions")
    .select("id, name, product_id, category_id, discount_kind, discount_bps, fixed_unit_price_cents, starts_at, ends_at, message_style, headline, body, cta_label, show_countdown")
    .order("ends_at");
  if (error) throw new Error(`Ofertas no disponibles: ${error.message}`);
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    productId: p.product_id,
    categoryId: p.category_id,
    discount: p.discount_kind === "percent" ? { kind: "percent", bps: p.discount_bps } : { kind: "fixed_unit_price", unitPriceCents: Number(p.fixed_unit_price_cents) },
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    messageStyle: p.message_style,
    headline: p.headline,
    body: p.body,
    ctaLabel: p.cta_label,
    showCountdown: p.show_countdown,
  }));
}

export function promotionsFor(product: { id: string; categoryId: string | null }, promos: PublicPromotion[]) {
  return promos.filter((p) => p.productId === product.id || (p.categoryId !== null && p.categoryId === product.categoryId));
}

/** Precio por unidad con la mejor oferta (1 unidad, sin variante): para tarjetas. */
export function promoUnitPrice(basePriceCents: number, promos: PublicPromotion[]): { cents: number; promo: PublicPromotion } | null {
  let best: { cents: number; promo: PublicPromotion } | null = null;
  for (const p of promos) {
    const cents =
      p.discount.kind === "percent"
        ? basePriceCents - Math.floor((basePriceCents * p.discount.bps + 5000) / 10000)
        : Math.min(basePriceCents, p.discount.unitPriceCents);
    if (cents < basePriceCents && (!best || cents < best.cents)) best = { cents, promo: p };
  }
  return best;
}

export interface PublicBanner {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  desktopPath: string;
  mobilePath: string | null;
  alt: string;
  startsAt: string | null;
  endsAt: string | null;
}

export async function getActiveBanners(): Promise<PublicBanner[]> {
  "use cache";
  cacheTag("banners");
  cacheLife("minutes");
  const { data, error } = await createSupabasePublicClient().from("banners").select("*").order("sort_order");
  if (error) throw new Error(`Banners no disponibles: ${error.message}`);
  return data.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.cta_label,
    ctaHref: b.cta_href,
    desktopPath: b.image_desktop_path,
    mobilePath: b.image_mobile_path,
    alt: b.alt || b.title,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
  }));
}

export interface PublicSettings {
  whatsappNumber: string | null;
  policy: PricingPolicy;
  defaultProductionDays: number;
  address: string | null;
  businessHours: string | null;
  contactEmail: string | null;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  const { data, error } = await createSupabasePublicClient()
    .from("settings")
    .select("whatsapp_number, pricing_stacking, rounding_unit, default_production_days, address, business_hours, contact_email")
    .single();
  if (error) throw new Error(`Configuración no disponible: ${error.message}`);
  return {
    whatsappNumber: data.whatsapp_number,
    policy: { stacking: data.pricing_stacking, rounding: data.rounding_unit },
    defaultProductionDays: data.default_production_days,
    address: data.address,
    businessHours: data.business_hours,
    contactEmail: data.contact_email,
  };
}

export async function getLegalTexts(): Promise<{ terms: { version: number; body: string; createdAt: string } | null; privacy: { body: string; updatedAt: string | null } | null }> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  const db = createSupabasePublicClient();
  const [terms, settings] = await Promise.all([
    db.from("terms_versions").select("version, body, created_at").eq("is_current", true).maybeSingle(),
    db.from("settings").select("privacy_body, privacy_updated_at").single(),
  ]);
  return {
    terms: terms.data ? { version: terms.data.version, body: terms.data.body, createdAt: terms.data.created_at } : null,
    privacy: settings.data?.privacy_body ? { body: settings.data.privacy_body, updatedAt: settings.data.privacy_updated_at } : null,
  };
}

export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path}`;
}

/** Búsqueda sin acentos ni mayúsculas: "domino" encuentra "Mesa de dominó". */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
