import { describe, expect, it } from "vitest";
import { type PricingProduct, type PricingPromotion, bestQuote } from "@/lib/domain/pricing";
import { promoText } from "@/lib/domain/promo-messages";
import { businessLocalToUtc, formatPromoEnd, utcToBusinessLocal } from "@/lib/domain/schedule";

const taza: PricingProduct = {
  id: "t",
  name: "Taza",
  basePriceCents: 35000,
  tiers: [
    { minQty: 1, maxQty: 5, unitPriceCents: 35000 },
    { minQty: 6, maxQty: null, unitPriceCents: 30000 },
  ],
};
const window = { isActive: true, startsAt: "2026-12-01T04:00:00Z", endsAt: "2026-12-21T04:00:00Z" };
const p10: PricingPromotion = { ...window, id: "cat", name: "Categoría 10%", discount: { kind: "percent", bps: 1000 } };
const fixed: PricingPromotion = { ...window, id: "prod", name: "Precio fijo", discount: { kind: "fixed_unit_price", unitPriceCents: 29900 } };
const policy = { stacking: "best_price", rounding: 1 } as const;
const during = new Date("2026-12-10T12:00:00Z");

describe("bestQuote", () => {
  it("elige la oferta que deja el menor total", () => {
    const q = bestQuote({ product: taza, quantity: 2, policy, now: during }, [p10, fixed]);
    expect(q.appliedPromotion?.id).toBe("prod");
    expect(q.unitCents).toBe(29900);
  });
  it("sin ofertas vigentes usa el precio normal o por volumen", () => {
    const after = new Date("2026-12-21T04:00:01Z");
    expect(bestQuote({ product: taza, quantity: 2, policy, now: after }, [p10, fixed]).unitCents).toBe(35000);
    expect(bestQuote({ product: taza, quantity: 6, policy, now: after }, [p10, fixed]).unitCents).toBe(30000);
  });
  it("con best_price, el volumen gana si es más barato que la oferta", () => {
    expect(bestQuote({ product: taza, quantity: 6, policy, now: during }, [p10]).unitCents).toBe(30000);
  });
});

describe("horas de RD en el panel", () => {
  it("ida y vuelta datetime-local ↔ UTC", () => {
    const utc = businessLocalToUtc("2026-12-20T23:59");
    expect(utc.toISOString()).toBe("2026-12-21T03:59:00.000Z");
    expect(utcToBusinessLocal(utc)).toBe("2026-12-20T23:59");
  });
  it("fecha legible del fin de la oferta", () => {
    expect(formatPromoEnd("2026-12-21T03:59:00Z")).toBe("20 de diciembre");
    expect(formatPromoEnd("2026-12-20T22:00:00Z")).toMatch(/^20 de diciembre.*6:00/);
  });
});

describe("mensajes promocionales", () => {
  it("usa el texto del estilo con la fecha de fin, o el personalizado", () => {
    expect(promoText("fire", {}, "20 de diciembre").body).toBe("Promoción válida hasta el 20 de diciembre. ¡Haz tu pedido ahora!");
    expect(promoText("gift", { headline: "Navidad" }, "x").headline).toBe("Navidad");
  });
});
