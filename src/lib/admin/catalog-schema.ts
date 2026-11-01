/**
 * Validación de los formularios del catálogo. La usan el navegador (errores
 * inmediatos) y el servidor (que nunca confía en lo que llega).
 */
import { z } from "zod";
import { SLUG_RE } from "@/lib/domain/slug";
import { validateTiers } from "@/lib/domain/pricing";

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const cents = z.number().int().min(0).max(100_000_000);
const optionalId = z.union([z.literal(""), z.uuid()]);

export const categorySchema = z.object({
  id: optionalId,
  name: text(80).min(2, "Escribe el nombre."),
  slug: z.string().trim().regex(SLUG_RE, "Solo minúsculas, números y guiones."),
  description: text(500),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
  seoTitle: text(70),
  seoDescription: text(160),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const tierSchema = z.object({
  minQty: z.number().int().min(1),
  maxQty: z.number().int().min(1).nullable(),
  unitPriceCents: cents.min(1, "El precio debe ser mayor que cero."),
});

export const variantSchema = z.object({
  id: optionalId,
  name: text(60).min(1, "Nombre de la variante."),
  sku: text(40),
  priceDeltaCents: cents,
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export const surchargeSchema = z.object({
  label: text(80).min(1, "Describe el recargo."),
  amountCents: cents.min(1, "El recargo debe ser mayor que cero."),
  per: z.enum(["unit", "order"]),
  customizationMode: z.enum(["", "own_design", "gallery", "idea"]),
  isActive: z.boolean(),
});

export const productSchema = z
  .object({
    id: optionalId,
    name: text(120).min(2, "Escribe el nombre."),
    slug: z.string().trim().regex(SLUG_RE, "Solo minúsculas, números y guiones."),
    categoryId: optionalId,
    shortDescription: text(160),
    description: text(4000),
    basePriceCents: cents.min(1, "El precio debe ser mayor que cero."),
    minQty: z.number().int().min(1).max(100000),
    maxQty: z.number().int().min(1).max(100000),
    productionDays: z.union([z.literal(""), z.number().int().min(0).max(120)]),
    allowsOwnDesign: z.boolean(),
    allowsGallery: z.boolean(),
    allowsIdea: z.boolean(),
    availability: z.enum(["available", "on_request", "unavailable"]),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
    seoTitle: text(70),
    seoDescription: text(160),
    tiers: z.array(tierSchema).max(20),
    variants: z.array(variantSchema).max(30),
    surcharges: z.array(surchargeSchema).max(20),
  })
  .superRefine((p, ctx) => {
    if (p.maxQty < p.minQty) ctx.addIssue({ code: "custom", path: ["maxQty"], message: "Debe ser mayor o igual que la cantidad mínima." });
    for (const message of validateTiers(p.tiers)) ctx.addIssue({ code: "custom", path: ["tiers"], message });
    const names = p.variants.map((v) => v.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["variants"], message: "Hay variantes con el mismo nombre." });
  });
export type ProductInput = z.infer<typeof productSchema>;

/** Errores de zod → { "campo": "mensaje" } para mostrarlos junto a cada campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export type ActionResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

/** Traduce errores de Postgres a mensajes para el administrador. */
export function dbErrorMessage(error: { code?: string; message: string }): Record<string, string> {
  if (error.code === "23505") return { slug: "Ya existe otro elemento con esa dirección (slug)." };
  if (error.code === "42501") return { _: "No tienes permiso para esta acción." };
  return { _: "No se pudo guardar. Revisa los datos e inténtalo de nuevo." };
}
