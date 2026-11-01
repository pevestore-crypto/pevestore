import { describe, expect, it } from "vitest";
import { categorySchema, productSchema } from "@/lib/admin/catalog-schema";
import { centsToInput, parsePesos } from "@/lib/domain/money";
import { SLUG_RE, slugify } from "@/lib/domain/slug";

describe("slugify", () => {
  it("genera direcciones amigables en español", () => {
    expect(slugify("Taza Mágica 11 oz")).toBe("taza-magica-11-oz");
    expect(slugify("Mesas de dominó")).toBe("mesas-de-domino");
    expect(slugify("  Niño & Niña!! ")).toBe("nino-nina");
    expect(SLUG_RE.test(slugify("Señalética ¡nueva!"))).toBe(true);
  });
});

describe("parsePesos", () => {
  it("acepta formatos comunes y rechaza basura", () => {
    expect(parsePesos("350")).toBe(35000);
    expect(parsePesos("1,500.50")).toBe(150050);
    expect(parsePesos("RD$ 4,500")).toBe(450000);
    expect(parsePesos("2.5")).toBe(250);
    expect(parsePesos("-5")).toBeNull();
    expect(parsePesos("3.333")).toBeNull();
    expect(parsePesos("abc")).toBeNull();
    expect(parsePesos("")).toBeNull();
  });
  it("ida y vuelta con centsToInput", () => {
    for (const c of [35000, 150050, 250, 1]) expect(parsePesos(centsToInput(c))).toBe(c);
  });
});

const product = {
  id: "", name: "Taza", slug: "taza", categoryId: "", shortDescription: "", description: "",
  basePriceCents: 35000, minQty: 1, maxQty: 100, productionDays: "" as const,
  allowsOwnDesign: true, allowsGallery: false, allowsIdea: true, availability: "available" as const,
  isActive: false, isFeatured: false, sortOrder: 0, seoTitle: "", seoDescription: "",
  tiers: [], variants: [], surcharges: [],
};

describe("validación del catálogo", () => {
  it("producto válido pasa", () => {
    expect(productSchema.safeParse(product).success).toBe(true);
  });
  it("detecta rangos con huecos, máximos menores y variantes repetidas", () => {
    const r = productSchema.safeParse({
      ...product,
      maxQty: 0,
      tiers: [{ minQty: 1, maxQty: 5, unitPriceCents: 1 }, { minQty: 9, maxQty: null, unitPriceCents: 1 }],
      variants: [
        { id: "", name: "Roja", sku: "", priceDeltaCents: 0, isActive: true, sortOrder: 0 },
        { id: "", name: "roja", sku: "", priceDeltaCents: 0, isActive: true, sortOrder: 1 },
      ],
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["maxQty", "tiers", "variants"]));
  });
  it("categoría exige slug válido", () => {
    const c = { id: "", name: "Tazas", slug: "Tazas Rojas", description: "", sortOrder: 0, isActive: true, seoTitle: "", seoDescription: "" };
    expect(categorySchema.safeParse(c).success).toBe(false);
    expect(categorySchema.safeParse({ ...c, slug: "tazas-rojas" }).success).toBe(true);
  });
});
