import { describe, expect, it } from "vitest";
import { formatDOP, percentOf, pesosToCents, roundTo } from "@/lib/domain/money";
import {
  type PricingProduct,
  type PricingPromotion,
  PricingError,
  calculatePrice,
  splitPayment,
  validateTiers,
} from "@/lib/domain/pricing";

const NOW = new Date("2026-12-10T15:00:00Z");

const taza: PricingProduct = {
  id: "taza",
  name: "Taza personalizada",
  basePriceCents: pesosToCents(350),
  tiers: [
    { minQty: 1, maxQty: 5, unitPriceCents: pesosToCents(350) },
    { minQty: 6, maxQty: 11, unitPriceCents: pesosToCents(300) },
    { minQty: 12, maxQty: null, unitPriceCents: pesosToCents(275) },
  ],
};

const promo15: PricingPromotion = {
  id: "navidad",
  name: "Navidad",
  isActive: true,
  startsAt: "2026-12-01T04:00:00Z",
  endsAt: "2026-12-21T04:00:00Z",
  discount: { kind: "percent", bps: 1500 },
};

const centavos = { stacking: "best_price", rounding: 1 } as const;

describe("dinero", () => {
  it("redondea mitad hacia arriba sin flotantes", () => {
    expect(percentOf(179400, 1500)).toBe(26910);
    expect(percentOf(152490, 5000)).toBe(76245);
    expect(percentOf(101, 5000)).toBe(51); // 50.5 → 51
    expect(roundTo(152490, 100)).toBe(152500);
    expect(roundTo(152449, 100)).toBe(152400);
  });

  it("formatea pesos dominicanos", () => {
    expect(formatDOP(150000)).toBe("RD$1,500");
    expect(formatDOP(152490)).toBe("RD$1,524.90");
    expect(formatDOP(27000)).toBe("RD$270");
  });
});

describe("motor de precios", () => {
  it("aplica el rango por cantidad del ejemplo del cliente", () => {
    expect(calculatePrice({ product: taza, quantity: 5, policy: centavos, now: NOW }).unitCents).toBe(35000);
    expect(calculatePrice({ product: taza, quantity: 6, policy: centavos, now: NOW }).unitCents).toBe(30000);
    const q12 = calculatePrice({ product: taza, quantity: 12, policy: centavos, now: NOW });
    expect(q12.unitCents).toBe(27500);
    expect(q12.totalCents).toBe(330000); // RD$3,300 del mensaje de ejemplo
    expect(q12.discountCents).toBe(90000);
  });

  it("best_price: no acumula oferta y volumen, usa el menor", () => {
    // 12 uds: volumen 275 vs oferta 350−15 % = 297.50 → gana volumen
    const q = calculatePrice({ product: taza, quantity: 12, promotion: promo15, policy: centavos, now: NOW });
    expect(q.unitCents).toBe(27500);
    expect(q.appliedPromotion).toBeNull();
    // 2 uds: volumen 350 vs oferta 297.50 → gana oferta
    const q2 = calculatePrice({ product: taza, quantity: 2, promotion: promo15, policy: centavos, now: NOW });
    expect(q2.unitCents).toBe(29750);
    expect(q2.appliedPromotion?.id).toBe("navidad");
  });

  it("stack: la oferta se aplica sobre el precio por volumen", () => {
    const q = calculatePrice({ product: taza, quantity: 6, promotion: promo15, policy: { stacking: "stack", rounding: 1 }, now: NOW });
    expect(q.unitCents).toBe(25500); // 300 − 15 %
    expect(q.totalCents).toBe(153000);
  });

  it("promo_over_volume: con oferta vigente ignora el volumen", () => {
    const q = calculatePrice({ product: taza, quantity: 12, promotion: promo15, policy: { stacking: "promo_over_volume", rounding: 1 }, now: NOW });
    expect(q.unitCents).toBe(29750);
  });

  it("una oferta vencida no aplica aunque siga marcada activa", () => {
    const after = new Date("2026-12-21T04:00:00Z");
    const q = calculatePrice({ product: taza, quantity: 2, promotion: promo15, policy: centavos, now: after });
    expect(q.unitCents).toBe(35000);
    expect(q.appliedPromotion).toBeNull();
  });

  it("precio fijo de oferta, variante y recargos", () => {
    const q = calculatePrice({
      product: taza,
      quantity: 3,
      variant: { id: "magica", name: "Mágica", priceDeltaCents: 10000 },
      surcharges: [
        { id: "a", label: "Diseño", amountCents: 50000, per: "order" },
        { id: "b", label: "Dos caras", amountCents: 2500, per: "unit" },
      ],
      promotion: { ...promo15, discount: { kind: "fixed_unit_price", unitPriceCents: 29900 } },
      policy: centavos,
      now: NOW,
    });
    expect(q.listUnitCents).toBe(45000);
    expect(q.unitCents).toBe(39900); // 299 + 100 de variante
    expect(q.totalCents).toBe(39900 * 3 + 50000 + 7500);
    expect(q.listSubtotalCents - q.totalCents).toBe(q.discountCents);
  });

  it("redondeo al peso cuando el negocio lo elige", () => {
    const q = calculatePrice({ product: { ...taza, tiers: [] }, quantity: 3, promotion: { ...promo15, discount: { kind: "percent", bps: 1333 } }, policy: { stacking: "best_price", rounding: 100 }, now: NOW });
    expect(q.totalCents % 100).toBe(0);
  });

  it("rechaza cantidades inválidas", () => {
    expect(() => calculatePrice({ product: taza, quantity: 0, policy: centavos, now: NOW })).toThrow(PricingError);
    expect(() => calculatePrice({ product: taza, quantity: 2.5, policy: centavos, now: NOW })).toThrow(PricingError);
  });

  it("valida rangos con huecos o solapes", () => {
    expect(validateTiers(taza.tiers)).toEqual([]);
    expect(validateTiers([{ minQty: 1, maxQty: 5, unitPriceCents: 1 }, { minQty: 5, maxQty: null, unitPriceCents: 1 }])).toHaveLength(1);
    expect(validateTiers([{ minQty: 1, maxQty: 5, unitPriceCents: 1 }, { minQty: 8, maxQty: null, unitPriceCents: 1 }])[0]).toMatch(/sin precio/);
    expect(validateTiers([{ minQty: 1, maxQty: null, unitPriceCents: 1 }, { minQty: 8, maxQty: null, unitPriceCents: 1 }])[0]).toMatch(/último/);
  });
});

describe("anticipo y saldo", () => {
  it("anticipo + saldo = total siempre", () => {
    for (const total of [152490, 152491, 1, 330000, 99999]) {
      const s = splitPayment(total, "deposit_50", 1);
      expect(s.dueNowCents + s.balanceCents).toBe(total);
    }
    expect(splitPayment(152490, "deposit_50", 1).dueNowCents).toBe(76245);
    expect(splitPayment(152490, "full", 1)).toMatchObject({ dueNowCents: 152490, balanceCents: 0 });
  });
});
