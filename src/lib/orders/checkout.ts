import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { type PriceQuote, PricingError, type PricingPolicy, calculatePrice, splitPayment } from "@/lib/domain/pricing";
import { type IsoDate, type WorkCalendar, earliestDeliveryDate } from "@/lib/domain/schedule";
import { UPLOAD_LIMITS } from "@/lib/domain/uploads";
import { isValidDominicanMobile, normalizeWhatsAppNumber } from "@/lib/domain/whatsapp";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/** Archivos que el cliente anuncia antes de subir (se validan de nuevo al subir). */
const declaredFile = z.object({
  purpose: z.enum(["design", "reference"]),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  size: z.number().int().min(1),
  name: z.string().max(200),
});

export const cartItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(100000),
  mode: z.enum(["own_design", "gallery", "idea"]).nullable(),
  ideaText: z.string().trim().max(2000).default(""),
  files: z.array(declaredFile).max(5).default([]),
});
export type CartItemInput = z.input<typeof cartItemSchema>;

export const orderSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Tu pedido está vacío.").max(30),
  customerName: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  customerWhatsapp: z.string().trim().refine(isValidDominicanMobile, "Número de WhatsApp dominicano válido (809, 829 u 849)."),
  requiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha en que lo necesitas."),
  notes: z.string().trim().max(1000).default(""),
  paymentPlan: z.enum(["deposit_50", "full"]),
  bankAccountId: z.uuid({ error: "Elige el banco al que transferirás." }),
  termsVersion: z.number().int().min(1),
  acceptTerms: z.literal(true, { error: "Debes aceptar las condiciones comerciales." }),
});
export type OrderInput = z.input<typeof orderSchema>;

export interface PublicBank {
  id: string;
  bankCode: "banreservas" | "popular" | "bhd";
  accountHolder: string;
  accountNumber: string;
  accountType: "ahorros" | "corriente";
  holderIdDoc: string | null;
}

export interface CheckoutContext {
  policy: PricingPolicy;
  calendar: WorkCalendar;
  defaultProductionDays: number;
  whatsappNumber: string | null;
  banks: PublicBank[];
  terms: { version: number; body: string } | null;
}

/** Siempre fresco (sin caché): fechas, cuentas y condiciones deben ser las vigentes. */
export async function loadCheckoutContext(): Promise<CheckoutContext> {
  const db = createSupabaseServiceClient();
  const [s, banks, dates, terms] = await Promise.all([
    db.from("settings").select("*").single(),
    db.from("bank_accounts").select("id, bank_code, account_holder, account_number, account_type, holder_id_doc").eq("is_active", true).order("sort_order"),
    db.from("blocked_dates").select("date").gte("date", new Date(Date.now() - 86400000).toISOString().slice(0, 10)),
    db.from("terms_versions").select("version, body").eq("is_current", true).maybeSingle(),
  ]);
  if (s.error) throw new Error(`Configuración no disponible: ${s.error.message}`);
  return {
    policy: { stacking: s.data.pricing_stacking, rounding: s.data.rounding_unit },
    calendar: {
      nonWorkingWeekdays: s.data.non_working_weekdays ?? [],
      blockedDates: (dates.data ?? []).map((d) => d.date),
      cutoffHour: s.data.order_cutoff_hour ?? undefined,
    },
    defaultProductionDays: s.data.default_production_days,
    whatsappNumber: s.data.whatsapp_number,
    banks: (banks.data ?? []).map((b) => ({
      id: b.id,
      bankCode: b.bank_code,
      accountHolder: b.account_holder,
      accountNumber: b.account_number,
      accountType: b.account_type,
      holderIdDoc: b.holder_id_doc,
    })),
    terms: terms.data ?? null,
  };
}

export interface PricedLine {
  index: number;
  productId: string;
  slug: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  mode: "own_design" | "gallery" | "idea" | null;
  allowedModes: ("own_design" | "gallery" | "idea")[];
  productionDays: number;
  quote: PriceQuote | null;
  error: string | null;
}

/** Recalcula cada línea con los datos actuales de la base de datos. */
export async function priceCart(items: z.output<typeof cartItemSchema>[], ctx: CheckoutContext, now: Date): Promise<PricedLine[]> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from("products")
    .select("id, slug, name, base_price_cents, min_qty, max_qty, production_days, allows_own_design, allows_gallery, allows_idea, availability, is_active, price_tiers(min_qty, max_qty, unit_price_cents), product_variants(id, name, price_delta_cents, is_active), product_surcharges(id, label, amount_cents, per, customization_mode, is_active), design_products(design_id)")
    .in("id", ids);
  if (error) throw new Error(`No se pudo calcular el pedido: ${error.message}`);
  const byId = new Map(data.map((p) => [p.id, p]));

  return items.map((item, index) => {
    const p = byId.get(item.productId);
    const base = { index, productId: item.productId, quantity: item.quantity, mode: item.mode, variantId: item.variantId };
    if (!p || !p.is_active) {
      return { ...base, slug: "", name: "Producto no disponible", variantName: null, allowedModes: [], productionDays: 0, quote: null, error: "Este producto ya no está disponible. Quítalo del pedido." };
    }
    const allowedModes = (
      [
        p.allows_own_design && "own_design",
        p.allows_gallery && (p.design_products as unknown[]).length > 0 && "gallery",
        p.allows_idea && "idea",
      ] as const
    ).filter(Boolean) as PricedLine["allowedModes"];
    const variants = (p.product_variants as { id: string; name: string; price_delta_cents: number; is_active: boolean }[]).filter((v) => v.is_active);
    const variant = item.variantId ? variants.find((v) => v.id === item.variantId) : null;
    const common = {
      ...base,
      slug: p.slug,
      name: p.name,
      variantName: variant?.name ?? null,
      allowedModes,
      productionDays: p.production_days ?? ctx.defaultProductionDays,
    };

    let err: string | null = null;
    if (p.availability === "unavailable") err = "Agotado por el momento.";
    else if (item.variantId && !variant) err = "El modelo elegido ya no está disponible.";
    else if (!item.variantId && variants.length > 0) err = "Elige un modelo.";
    else if (allowedModes.length > 0 && (!item.mode || !allowedModes.includes(item.mode))) err = "Elige una opción de personalización válida.";
    if (err) return { ...common, quote: null, error: err };

    try {
      const quote = calculatePrice({
        product: {
          id: p.id,
          name: p.name,
          basePriceCents: Number(p.base_price_cents),
          minQty: p.min_qty,
          maxQty: p.max_qty,
          tiers: (p.price_tiers as { min_qty: number; max_qty: number | null; unit_price_cents: number }[]).map((t) => ({
            minQty: t.min_qty,
            maxQty: t.max_qty,
            unitPriceCents: Number(t.unit_price_cents),
          })),
        },
        quantity: item.quantity,
        variant: variant ? { id: variant.id, name: variant.name, priceDeltaCents: Number(variant.price_delta_cents) } : null,
        surcharges: (p.product_surcharges as { id: string; label: string; amount_cents: number; per: "unit" | "order"; customization_mode: string | null; is_active: boolean }[])
          .filter((s) => s.is_active && (s.customization_mode === null || s.customization_mode === item.mode))
          .map((s) => ({ id: s.id, label: s.label, amountCents: Number(s.amount_cents), per: s.per })),
        policy: ctx.policy,
        now,
      });
      return { ...common, quote, error: null };
    } catch (e) {
      return { ...common, quote: null, error: e instanceof PricingError ? e.message : "No se pudo calcular el precio." };
    }
  });
}

export function cartTotals(lines: PricedLine[]) {
  const ok = lines.every((l) => l.quote);
  const totalCents = lines.reduce((sum, l) => sum + (l.quote?.totalCents ?? 0), 0);
  return { ok, totalCents };
}

export function earliestDateFor(lines: PricedLine[], ctx: CheckoutContext, now: Date): IsoDate {
  const days = Math.max(ctx.defaultProductionDays, ...lines.map((l) => l.productionDays));
  return earliestDeliveryDate(now, days, ctx.calendar);
}

/** Valida lo que exige cada modo de personalización. */
export function customizationErrors(items: z.output<typeof cartItemSchema>[]): Record<string, string> {
  const errors: Record<string, string> = {};
  items.forEach((item, i) => {
    const designs = item.files.filter((f) => f.purpose === "design");
    if (item.mode === "own_design" && designs.length === 0) errors[`items.${i}.files`] = "Sube el archivo de tu diseño (JPG, PNG o PDF).";
    if (item.mode === "idea" && item.ideaText.length < 10) errors[`items.${i}.ideaText`] = "Describe tu idea (al menos 10 caracteres).";
    if (item.mode !== "own_design" && designs.length > 0) errors[`items.${i}.files`] = "Solo se suben diseños con la opción “Tengo mi diseño”.";
    for (const f of item.files) {
      const rule = f.purpose === "design" ? UPLOAD_LIMITS.design : UPLOAD_LIMITS.reference;
      if (f.size > rule.maxBytes) errors[`items.${i}.files`] = `“${f.name}” supera ${Math.round(rule.maxBytes / 1048576)} MB.`;
      if (f.purpose === "design" && f.mime === "image/webp") errors[`items.${i}.files`] = "El diseño debe ser JPG, PNG o PDF.";
    }
  });
  return errors;
}

export { splitPayment };

export function newTrackingToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const extForMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export { normalizeWhatsAppNumber };
