import { z } from "zod";

const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas.");
const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);

export const promotionSchema = z
  .object({
    id: z.union([z.literal(""), z.uuid()]),
    name: text(80).min(3, "Ponle un nombre interno (ej.: Navidad tazas)."),
    target: z.enum(["product", "category"]),
    productId: z.union([z.literal(""), z.uuid()]),
    categoryId: z.union([z.literal(""), z.uuid()]),
    discountKind: z.enum(["percent", "fixed_unit_price"]),
    percent: z.number().min(1, "Entre 1 % y 90 %.").max(90, "Entre 1 % y 90 %."),
    fixedUnitPriceCents: z.number().int().min(0),
    startsLocal: local,
    endsLocal: local,
    messageStyle: z.enum(["fire", "last_days", "gift"]),
    headline: text(80),
    body: text(200),
    ctaLabel: text(40),
    showCountdown: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((p, ctx) => {
    if (p.endsLocal <= p.startsLocal) ctx.addIssue({ code: "custom", path: ["endsLocal"], message: "Debe terminar después de empezar." });
    if (p.target === "product" && !p.productId) ctx.addIssue({ code: "custom", path: ["productId"], message: "Elige el producto." });
    if (p.target === "category" && !p.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Elige la categoría." });
    if (p.discountKind === "fixed_unit_price") {
      if (p.target !== "product") ctx.addIssue({ code: "custom", path: ["discountKind"], message: "El precio fijo solo aplica a un producto." });
      if (p.fixedUnitPriceCents <= 0) ctx.addIssue({ code: "custom", path: ["fixedUnitPriceCents"], message: "Escribe el precio de oferta." });
    }
  });
export type PromotionInput = z.infer<typeof promotionSchema>;
