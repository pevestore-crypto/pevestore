import { z } from "zod";
import { isValidDominicanMobile, normalizeWhatsAppNumber } from "@/lib/domain/whatsapp";

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);

export const businessSchema = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidDominicanMobile(v), "Número dominicano válido: 809, 829 u 849 + 7 dígitos.")
    .transform((v) => (v ? normalizeWhatsAppNumber(v) : "")),
  contactEmail: z.union([z.literal(""), z.email("Correo inválido.")]),
  address: text(200),
  businessHours: text(200),
});
export type BusinessInput = z.input<typeof businessSchema>;

export const orderRulesSchema = z.object({
  defaultProductionDays: z.number().int().min(0).max(120),
  nonWorkingWeekdays: z.array(z.number().int().min(0).max(6)).max(6, "Debe quedar al menos un día laborable."),
  orderCutoffHour: z.union([z.literal(""), z.number().int().min(0).max(23)]),
  pricingStacking: z.enum(["best_price", "promo_over_volume", "stack"]),
  roundingUnit: z.union([z.literal(1), z.literal(100)]),
});
export type OrderRulesInput = z.infer<typeof orderRulesSchema>;

export const bankAccountSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]),
  bankCode: z.enum(["banreservas", "popular", "bhd"]),
  accountHolder: text(120).min(3, "Escribe el titular."),
  accountNumber: z.string().trim().regex(/^[0-9-]{6,30}$/, "Solo números y guiones."),
  accountType: z.enum(["ahorros", "corriente"]),
  holderIdDoc: text(30),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(99),
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const termsSchema = z.object({
  body: z.string().trim().min(40, "Escribe las condiciones (mínimo 40 caracteres).").max(10000),
});

export const blockedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  reason: text(80),
});

export const BANKS = {
  banreservas: { name: "Banreservas", color: "#0055A5" },
  popular: { name: "Banco Popular Dominicano", color: "#003A70" },
  bhd: { name: "Banco BHD", color: "#00843D" },
} as const;

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
