import { z } from "zod";
import { isValidDominicanMobile } from "@/lib/domain/whatsapp";

export const quoteFileSchema = z.object({
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  size: z.number().int().min(1).max(10 * 1024 * 1024, "Cada archivo debe pesar menos de 10 MB."),
  name: z.string().max(200),
});

export const quoteSchema = z.object({
  serviceId: z.uuid({ error: "Elige el tipo de trabajo." }),
  customerName: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  whatsapp: z.string().trim().refine(isValidDominicanMobile, "Número de WhatsApp dominicano válido (809, 829 u 849)."),
  measurements: z.string().trim().max(200),
  quantity: z.union([z.literal(""), z.number().int().min(1).max(100000)]),
  material: z.string().trim().max(120),
  requiredDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")]),
  description: z.string().trim().min(15, "Describe el trabajo (al menos 15 caracteres).").max(3000),
  files: z.array(quoteFileSchema).max(5, "Máximo 5 archivos."),
});
export type QuoteInput = z.input<typeof quoteSchema>;
