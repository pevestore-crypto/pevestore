"use server";

import { parseOrderNumber } from "@/lib/domain/order-number";
import type { OrderStatus } from "@/lib/domain/order-status";
import { isValidDominicanMobile, normalizeWhatsAppNumber } from "@/lib/domain/whatsapp";
import { allowRequest, clientIp } from "@/lib/orders/access";
import { TURNSTILE_ERROR, verifyTurnstile } from "@/lib/security/turnstile";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type LookupResult =
  | { ok: true; code: string; status: OrderStatus; requiredDate: string; estimatedDate: string | null; pendingCents: number; paidCents: number }
  | { ok: false; error: string };

const NOT_FOUND = "No encontramos un pedido con esos datos. Revisa el número y el WhatsApp con que hiciste el pedido.";

export async function lookupOrder(code: string, whatsapp: string, turnstileToken: string | null): Promise<LookupResult> {
  // Límite estricto: evita probar números de pedido o teléfonos al azar.
  if (!(await allowRequest("lookup", 10, 3600))) return { ok: false, error: "Demasiados intentos. Espera una hora o escríbenos por WhatsApp." };
  if (!(await verifyTurnstile(turnstileToken, await clientIp()))) return { ok: false, error: TURNSTILE_ERROR };
  const number = parseOrderNumber(code);
  if (!number || !isValidDominicanMobile(whatsapp)) return { ok: false, error: NOT_FOUND };

  const { data, error } = await createSupabaseServiceClient().rpc("lookup_order", { p_number: number, p_whatsapp: normalizeWhatsAppNumber(whatsapp) });
  const o = (data as { code: string; status: OrderStatus; required_date: string; estimated_date: string | null; total_cents: number; paid_verified_cents: number }[] | null)?.[0];
  if (error || !o) return { ok: false, error: NOT_FOUND };

  const total = Number(o.total_cents);
  const paid = Number(o.paid_verified_cents);
  return {
    ok: true,
    code: o.code,
    status: o.status,
    requiredDate: o.required_date,
    estimatedDate: o.estimated_date,
    paidCents: paid,
    pendingCents: Math.max(0, total - paid),
  };
}
