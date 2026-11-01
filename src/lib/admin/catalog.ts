import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CategoryInput, ProductInput } from "./catalog-schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
}

export async function listCategories(): Promise<CategoryRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, is_active, sort_order, products(count)")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.is_active,
    sortOrder: c.sort_order,
    productCount: (c.products as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getCategory(id: string): Promise<CategoryInput> {
  await requireAdmin();
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description ?? "",
    sortOrder: data.sort_order,
    isActive: data.is_active,
    seoTitle: data.seo_title ?? "",
    seoDescription: data.seo_description ?? "",
  };
}

export async function categoryOptions(): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("categories").select("id, name").order("sort_order").order("name");
  return data ?? [];
}

export interface ProductRow {
  id: string;
  name: string;
  categoryName: string | null;
  basePriceCents: number;
  isActive: boolean;
  isFeatured: boolean;
  availability: string;
  imagePath: string | null;
}

export async function listProducts(): Promise<ProductRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, base_price_cents, is_active, is_featured, availability, categories(name), product_images(storage_path, sort_order)")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  return data.map((p) => {
    const images = (p.product_images as unknown as { storage_path: string; sort_order: number }[]) ?? [];
    const first = [...images].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: p.id,
      name: p.name,
      categoryName: (p.categories as unknown as { name: string } | null)?.name ?? null,
      basePriceCents: Number(p.base_price_cents),
      isActive: p.is_active,
      isFeatured: p.is_featured,
      availability: p.availability,
      imagePath: first?.storage_path ?? null,
    };
  });
}

export interface ProductImage {
  id: string;
  path: string;
  alt: string;
  sortOrder: number;
}

export async function getProduct(id: string): Promise<{ product: ProductInput; images: ProductImage[] }> {
  await requireAdmin();
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase
    .from("products")
    .select("*, price_tiers(*), product_variants(*), product_surcharges(*), product_images(*)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  type Tier = { min_qty: number; max_qty: number | null; unit_price_cents: number };
  type Variant = { id: string; name: string; sku: string | null; price_delta_cents: number; is_active: boolean; sort_order: number };
  type Surcharge = { label: string; amount_cents: number; per: "unit" | "order"; customization_mode: string | null; is_active: boolean };
  type Image = { id: string; storage_path: string; alt: string; sort_order: number };

  return {
    product: {
      id: p.id,
      name: p.name,
      slug: p.slug,
      categoryId: p.category_id ?? "",
      shortDescription: p.short_description ?? "",
      description: p.description ?? "",
      basePriceCents: Number(p.base_price_cents),
      minQty: p.min_qty,
      maxQty: p.max_qty,
      productionDays: p.production_days ?? "",
      allowsOwnDesign: p.allows_own_design,
      allowsGallery: p.allows_gallery,
      allowsIdea: p.allows_idea,
      availability: p.availability,
      isActive: p.is_active,
      isFeatured: p.is_featured,
      sortOrder: p.sort_order,
      seoTitle: p.seo_title ?? "",
      seoDescription: p.seo_description ?? "",
      tiers: (p.price_tiers as Tier[])
        .sort((a, b) => a.min_qty - b.min_qty)
        .map((t) => ({ minQty: t.min_qty, maxQty: t.max_qty, unitPriceCents: Number(t.unit_price_cents) })),
      variants: (p.product_variants as Variant[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({ id: v.id, name: v.name, sku: v.sku ?? "", priceDeltaCents: Number(v.price_delta_cents), isActive: v.is_active, sortOrder: v.sort_order })),
      surcharges: (p.product_surcharges as Surcharge[]).map((s) => ({
        label: s.label,
        amountCents: Number(s.amount_cents),
        per: s.per,
        customizationMode: (s.customization_mode ?? "") as ProductInput["surcharges"][number]["customizationMode"],
        isActive: s.is_active,
      })),
    },
    images: (p.product_images as Image[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, path: i.storage_path, alt: i.alt, sortOrder: i.sort_order })),
  };
}

/** URL pública de una imagen del bucket catalog. */
export function catalogImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path}`;
}
