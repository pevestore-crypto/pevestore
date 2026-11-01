"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { ORDER_STATUSES } from "@/lib/domain/order-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const statusInput = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500),
});

/** Traduce los errores que imponen las reglas de la base de datos. */
function message(error: { code?: string; message: string }): string {
  if (error.message.includes("pago verificado")) return "Primero verifica el pago: el anticipo aún no está cubierto.";
  if (error.message.includes("no permitido")) return "Ese cambio de estado no está permitido desde el estado actual.";
  if (error.message.includes("ya fue revisado")) return "Este pago ya fue revisado.";
  if (error.message.includes("mayor que cero")) return "El monto recibido debe ser mayor que cero.";
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  return "No se pudo guardar el cambio. Inténtalo de nuevo.";
}

export async function setOrderStatus(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { ok: false, errors: { _: "Datos inválidos." } };
  const { orderId, status, note } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_order_status", { p_order: orderId, p_status: status, p_note: note || null });
  if (error) return { ok: false, errors: { _: message(error) } };
  return { ok: true, id: orderId };
}

const paymentInput = z.object({
  paymentId: z.uuid(),
  decision: z.enum(["verify", "reject"]),
  verifiedCents: z.number().int().min(1).max(100_000_000).nullable(),
  note: z.string().trim().max(500),
});

export async function reviewPayment(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return { ok: false, errors: { _: "Escribe el monto que realmente llegó a la cuenta." } };
  const { paymentId, decision, verifiedCents, note } = parsed.data;
  if (decision === "verify" && !verifiedCents) return { ok: false, errors: { _: "Escribe el monto recibido." } };
  if (decision === "reject" && !note) return { ok: false, errors: { _: "Indica el motivo del rechazo." } };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_payment", {
    p_payment: paymentId,
    p_verified_cents: decision === "verify" ? verifiedCents : null,
    p_note: note || null,
  });
  if (error) return { ok: false, errors: { _: message(error) } };
  return { ok: true, id: paymentId };
}
