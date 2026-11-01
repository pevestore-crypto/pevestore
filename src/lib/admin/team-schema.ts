import { z } from "zod";

/** Contraseña razonable: 10+ caracteres con letras y números. */
export const passwordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres.")
  .max(72, "Máximo 72 caracteres.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Usa letras y números.");

export const newStaffSchema = z.object({
  fullName: z.string().trim().min(3, "Escribe el nombre completo.").max(80),
  email: z.email("Correo inválido.").transform((e) => e.trim().toLowerCase()),
  role: z.enum(["owner", "staff"]),
  tempPassword: passwordSchema,
});
export type NewStaffInput = z.input<typeof newStaffSchema>;

export const ROLE_LABEL = { owner: "Dueño", staff: "Personal" } as const;
export const ROLE_HINT = {
  owner: "Todo, incluidas cuentas bancarias, condiciones, reglas de precios y el equipo.",
  staff: "Pedidos, pagos, productos, ofertas, banners y cotizaciones. No cambia bancos, condiciones, reglas ni el equipo.",
} as const;
