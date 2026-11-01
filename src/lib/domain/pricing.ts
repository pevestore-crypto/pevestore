/**
 * Motor de precios. Función pura: recibe los datos configurados en el panel y
 * devuelve el desglose. Se ejecuta igual en el navegador (vista previa) y en el
 * servidor, que siempre recalcula antes de registrar un pedido.
 */
import { type BasisPoints, type Cents, type RoundingUnit, assertCents, percentOf, roundTo } from "./money";
import { isPromotionActive, type PromotionWindow } from "./promotions";

export interface PriceTier {
  minQty: number;
  /** null = "o más". */
  maxQty: number | null;
  unitPriceCents: Cents;
}

export interface PricingProduct {
  id: string;
  name: string;
  /** Precio normal por unidad, antes de descuentos por volumen. */
  basePriceCents: Cents;
  tiers: PriceTier[];
  minQty?: number;
  maxQty?: number;
}

export interface PricingVariant {
  id: string;
  name: string;
  /** Diferencia por unidad respecto al precio del producto (puede ser 0). */
  priceDeltaCents: Cents;
}

export interface Surcharge {
  id: string;
  label: string;
  amountCents: Cents;
  per: "unit" | "order";
}

export type PromotionDiscount =
  | { kind: "percent"; bps: BasisPoints }
  | { kind: "fixed_unit_price"; unitPriceCents: Cents };

export interface PricingPromotion extends PromotionWindow {
  id: string;
  name: string;
  discount: PromotionDiscount;
}

/**
 * Cómo conviven la oferta y el descuento por volumen (decisión comercial):
 * - best_price: se aplica el que deje el precio más bajo (no se suman).
 * - promo_over_volume: si hay oferta vigente, ignora el volumen.
 * - stack: el porcentaje de la oferta se aplica sobre el precio por volumen.
 */
export type StackingPolicy = "best_price" | "promo_over_volume" | "stack";

export interface PricingPolicy {
  stacking: StackingPolicy;
  rounding: RoundingUnit;
}

export interface PriceInput {
  product: PricingProduct;
  quantity: number;
  variant?: PricingVariant | null;
  surcharges?: Surcharge[];
  promotion?: PricingPromotion | null;
  policy: PricingPolicy;
  now: Date;
}

export interface PriceQuote {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  /** Precio normal por unidad (con variante, sin descuentos). */
  listUnitCents: Cents;
  /** Precio por unidad aplicado (con descuentos, sin recargos). */
  unitCents: Cents;
  appliedTier: PriceTier | null;
  appliedPromotion: { id: string; name: string; discount: PromotionDiscount } | null;
  surcharges: (Surcharge & { totalCents: Cents })[];
  /** Precio normal × cantidad + recargos. */
  listSubtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
  policy: PricingPolicy;
  calculatedAt: string;
}

export class PricingError extends Error {}

export function findTier(tiers: PriceTier[], quantity: number): PriceTier | null {
  return tiers.find((t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)) ?? null;
}

/** Valida los rangos configurados: enteros, sin solapes y sin huecos. */
export function validateTiers(tiers: PriceTier[]): string[] {
  const errors: string[] = [];
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  sorted.forEach((t, i) => {
    const name = `Rango ${i + 1}`;
    if (!Number.isInteger(t.minQty) || t.minQty < 1) errors.push(`${name}: la cantidad mínima debe ser 1 o más.`);
    if (t.maxQty !== null && (!Number.isInteger(t.maxQty) || t.maxQty < t.minQty)) {
      errors.push(`${name}: la cantidad máxima debe ser mayor o igual que la mínima.`);
    }
    if (!Number.isSafeInteger(t.unitPriceCents) || t.unitPriceCents <= 0) errors.push(`${name}: el precio debe ser mayor que cero.`);
    const next = sorted[i + 1];
    if (next) {
      if (t.maxQty === null) errors.push(`${name}: solo el último rango puede ser "o más".`);
      else if (next.minQty <= t.maxQty) errors.push(`${name} y rango ${i + 2} se solapan.`);
      else if (next.minQty !== t.maxQty + 1) errors.push(`Hay cantidades sin precio entre ${t.maxQty} y ${next.minQty}.`);
    }
  });
  return errors;
}

function promoUnitPrice(discount: PromotionDiscount, base: Cents, variantDelta: Cents): Cents {
  if (discount.kind === "percent") return base - percentOf(base, discount.bps);
  return Math.min(base, discount.unitPriceCents + variantDelta);
}

export function calculatePrice(input: PriceInput): PriceQuote {
  const { product, quantity, policy, now } = input;
  const variant = input.variant ?? null;
  const minQty = product.minQty ?? 1;
  const maxQty = product.maxQty ?? 10000;

  if (!Number.isInteger(quantity) || quantity < minQty || quantity > maxQty) {
    throw new PricingError(`La cantidad debe estar entre ${minQty} y ${maxQty}.`);
  }
  assertCents(product.basePriceCents, "precio base");
  const variantDelta = variant ? assertCents(variant.priceDeltaCents, "precio de variante") : 0;

  const listUnit = product.basePriceCents + variantDelta;
  const tier = findTier(product.tiers, quantity);
  const volumeUnit = tier ? tier.unitPriceCents + variantDelta : listUnit;

  const promotion = input.promotion && isPromotionActive(input.promotion, now) ? input.promotion : null;
  let unit = volumeUnit;
  let usedPromotion = false;

  if (promotion) {
    const promoOnList = promoUnitPrice(promotion.discount, listUnit, variantDelta);
    if (policy.stacking === "promo_over_volume") {
      unit = promoOnList;
      usedPromotion = true;
    } else if (policy.stacking === "stack" && promotion.discount.kind === "percent") {
      unit = promoUnitPrice(promotion.discount, volumeUnit, variantDelta);
      usedPromotion = true;
    } else if (promoOnList < volumeUnit) {
      unit = promoOnList;
      usedPromotion = true;
    }
  }

  const surcharges = (input.surcharges ?? []).map((s) => {
    assertCents(s.amountCents, `recargo ${s.label}`);
    return { ...s, totalCents: s.per === "unit" ? s.amountCents * quantity : s.amountCents };
  });
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.totalCents, 0);

  const listSubtotal = listUnit * quantity + surchargeTotal;
  const total = roundTo(unit * quantity + surchargeTotal, policy.rounding);

  return {
    productId: product.id,
    productName: product.name,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    quantity,
    listUnitCents: listUnit,
    unitCents: unit,
    appliedTier: usedPromotion && policy.stacking !== "stack" ? null : tier,
    appliedPromotion: usedPromotion && promotion ? { id: promotion.id, name: promotion.name, discount: promotion.discount } : null,
    surcharges,
    listSubtotalCents: listSubtotal,
    discountCents: Math.max(0, listSubtotal - total),
    totalCents: total,
    policy,
    calculatedAt: now.toISOString(),
  };
}

/**
 * Con varias ofertas posibles (del producto y de su categoría), aplica la que
 * deje el total más bajo. Las vencidas o futuras se ignoran por fecha.
 */
export function bestQuote(input: Omit<PriceInput, "promotion">, promotions: PricingPromotion[]): PriceQuote {
  let best = calculatePrice({ ...input, promotion: null });
  for (const promotion of promotions) {
    const q = calculatePrice({ ...input, promotion });
    if (q.totalCents < best.totalCents) best = q;
  }
  return best;
}

export type PaymentPlan = "deposit_50" | "full";

export interface PaymentSplit {
  plan: PaymentPlan;
  totalCents: Cents;
  dueNowCents: Cents;
  balanceCents: Cents;
}

/** Anticipo y saldo. El saldo es siempre total − anticipo, así suman exacto. */
export function splitPayment(totalCents: Cents, plan: PaymentPlan, rounding: RoundingUnit): PaymentSplit {
  assertCents(totalCents, "total");
  const dueNow = plan === "full" ? totalCents : percentOf(totalCents, 5000, rounding);
  return { plan, totalCents, dueNowCents: dueNow, balanceCents: totalCents - dueNow };
}
