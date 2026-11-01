import { z } from "zod";

const local = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas.")]);
const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const imagePath = z.string().regex(/^banners\/[0-9a-f-]{36}\.webp$/, "Sube la imagen.");

export const bannerSchema = z
  .object({
    id: z.union([z.literal(""), z.uuid()]),
    title: text(80).min(3, "Escribe el título."),
    subtitle: text(160),
    ctaLabel: text(30),
    // Solo enlaces del propio sitio: los banners promocionan exclusivamente a PEVESTORE.
    ctaHref: z.union([z.literal(""), z.string().trim().regex(/^\/(?!\/)[\w\-/?=&.%]*$/, "Usa una dirección de esta tienda, por ejemplo /ofertas o /productos/tazas-personalizadas.")]),
    imageDesktopPath: imagePath,
    imageMobilePath: z.union([z.literal(""), imagePath]),
    alt: text(160),
    startsLocal: local,
    endsLocal: local,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(99),
  })
  .superRefine((b, ctx) => {
    if (Boolean(b.ctaLabel) !== Boolean(b.ctaHref)) ctx.addIssue({ code: "custom", path: ["ctaHref"], message: "El botón necesita texto y enlace (o deja ambos vacíos)." });
    if (b.startsLocal && b.endsLocal && b.endsLocal <= b.startsLocal) ctx.addIssue({ code: "custom", path: ["endsLocal"], message: "Debe terminar después de empezar." });
  });
export type BannerInput = z.infer<typeof bannerSchema>;
