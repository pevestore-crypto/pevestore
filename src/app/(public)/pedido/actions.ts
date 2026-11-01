"use server";

import { randomUUID } from "node:crypto";
import { fieldErrors } from "@/lib/admin/catalog-schema";
import { checkRequestedDate, formatIsoDateLong, isIsoDate } from "@/lib/domain/schedule";
import { allowRequest, clientIp, findOrderByToken, verifyStoredFile } from "@/lib/orders/access";
import { TURNSTILE_ERROR, verifyTurnstile } from "@/lib/security/turnstile";
import {
  type CartItemInput,
  type OrderInput,
  type PricedLine,
  type PublicBank,
  cartItemSchema,
  cartTotals,
  customizationErrors,
  earliestDateFor,
  extForMime,
  loadCheckoutContext,
  newTrackingToken,
  normalizeWhatsAppNumber,
  orderSchema,
  priceCart,
  splitPayment,
} from "@/lib/orders/checkout";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export interface CartQuote {
  lines: PricedLine[];
  totalCents: number;
  ok: boolean;
  earliestDate: string;
  banks: PublicBank[];
  terms: { version: number; body: string } | null;
  ready: boolean;
  rounding: 1 | 100;
}

/** Vista previa del pedido con precios del servidor. */
export async function quoteCart(items: CartItemInput[]): Promise<CartQuote | { error: string }> {
  if (!(await allowRequest("quote", 300, 600))) return { error: "Demasiadas solicitudes. Espera unos minutos." };
  const parsed = cartItemSchema.array().max(30).safeParse(items);
  if (!parsed.success) return { error: "El pedido tiene datos inválidos. Vacíalo y vuelve a agregar los productos." };
  const now = new Date();
  const ctx = await loadCheckoutContext();
  // La vista previa no exige diseño elegido: solo lista los disponibles.
  const lines = parsed.data.length ? await priceCart(parsed.data.map((i) => ({ ...i, designId: null })), ctx, now) : [];
  const { ok, totalCents } = cartTotals(lines);
  return {
    lines,
    totalCents,
    ok,
    earliestDate: earliestDateFor(lines, ctx, now),
    banks: ctx.banks,
    terms: ctx.terms,
    ready: ctx.banks.length > 0 && ctx.terms !== null,
    rounding: ctx.policy.rounding,
  };
}

export interface UploadTicket {
  itemIndex: number;
  purpose: "design" | "reference";
  fileIndex: number;
  path: string;
  token: string;
}

export type PlaceOrderResult =
  | { ok: true; code: string; token: string; uploads: UploadTicket[] }
  | { ok: false; errors: Record<string, string> };

export async function placeOrder(input: OrderInput, turnstileToken: string | null): Promise<PlaceOrderResult> {
  if (!(await allowRequest("order", 8, 3600))) {
    return { ok: false, errors: { _: "Has enviado varios pedidos seguidos. Espera un rato o escríbenos por WhatsApp." } };
  }
  if (!(await verifyTurnstile(turnstileToken, await clientIp()))) return { ok: false, errors: { _: TURNSTILE_ERROR } };
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const o = parsed.data;

  const custom = customizationErrors(o.items);
  if (Object.keys(custom).length) return { ok: false, errors: custom };

  const now = new Date();
  const ctx = await loadCheckoutContext();
  if (!ctx.terms || ctx.banks.length === 0) return { ok: false, errors: { _: "Los pedidos en línea aún no están habilitados. Escríbenos por WhatsApp." } };
  if (o.termsVersion !== ctx.terms.version) return { ok: false, errors: { acceptTerms: "Las condiciones se actualizaron. Revísalas y acéptalas de nuevo." } };
  const bank = ctx.banks.find((b) => b.id === o.bankAccountId);
  if (!bank) return { ok: false, errors: { bankAccountId: "Elige un banco de la lista." } };

  const lines = await priceCart(o.items, ctx, now);
  const bad = lines.find((l) => !l.quote);
  if (bad) return { ok: false, errors: { [`items.${bad.index}`]: bad.error ?? "Revisa este producto." } };

  const days = Math.max(ctx.defaultProductionDays, ...lines.map((l) => l.productionDays));
  if (!isIsoDate(o.requiredDate)) return { ok: false, errors: { requiredDate: "Fecha inválida." } };
  const dateCheck = checkRequestedDate(o.requiredDate, now, days, ctx.calendar);
  if (!dateCheck.ok) return { ok: false, errors: { requiredDate: `${dateCheck.reason} La primera fecha disponible es el ${formatIsoDateLong(dateCheck.earliest)}.` } };

  const { totalCents } = cartTotals(lines);
  const split = splitPayment(totalCents, o.paymentPlan, ctx.policy.rounding);
  const { token, hash } = newTrackingToken();
  const db = createSupabaseServiceClient();

  const { data: created, error } = await db.rpc("create_order", {
    p: {
      customerName: o.customerName,
      customerWhatsapp: normalizeWhatsAppNumber(o.customerWhatsapp),
      requiredDate: o.requiredDate,
      notes: o.notes,
      paymentPlan: o.paymentPlan,
      bankAccountId: bank.id,
      bankSnapshot: bank,
      totalCents: split.totalCents,
      dueNowCents: split.dueNowCents,
      balanceCents: split.balanceCents,
      termsVersion: ctx.terms.version,
      trackingTokenHash: hash,
      items: lines.map((l, i) => ({
        productId: l.productId,
        variantId: l.variantId ?? "",
        productName: l.name,
        variantName: l.variantName ?? "",
        quantity: l.quantity,
        unitCents: l.quote!.unitCents,
        totalCents: l.quote!.totalCents,
        customizationMode: l.mode ?? "",
        designId: l.mode === "gallery" ? (o.items[i].designId ?? "") : "",
        ideaText: o.items[i].ideaText,
        pricingSnapshot: { ...l.quote, lineIndex: i },
      })),
    },
  });
  if (error || !created?.[0]) return { ok: false, errors: { _: "No pudimos registrar el pedido. Inténtalo de nuevo en un momento." } };
  const order = created[0] as { id: string; code: string };

  // URLs firmadas para que el navegador suba los archivos directo al almacenamiento privado.
  const uploads: UploadTicket[] = [];
  for (const [itemIndex, item] of o.items.entries()) {
    for (const [fileIndex, f] of item.files.entries()) {
      const path = `orders/${order.id}/${itemIndex}-${f.purpose}-${randomUUID()}.${extForMime[f.mime]}`;
      const { data } = await db.storage.from("customer-files").createSignedUploadUrl(path);
      if (data) uploads.push({ itemIndex, fileIndex, purpose: f.purpose, path, token: data.token });
    }
  }
  return { ok: true, code: order.code, token, uploads };
}

export async function attachOrderFile(
  code: string,
  token: string,
  file: { path: string; itemIndex: number; purpose: "design" | "reference"; name: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await allowRequest("upload", 60, 3600))) return { ok: false, error: "Demasiados archivos seguidos. Espera un rato." };
  const order = await findOrderByToken(code, token);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (!new RegExp(`^orders/${order.id}/${file.itemIndex}-${file.purpose}-[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(file.path)) {
    return { ok: false, error: "Archivo inválido." };
  }
  const check = await verifyStoredFile("customer-files", file.path, file.purpose === "design" ? "design" : "reference");
  if (!check.ok) return { ok: false, error: check.reason };

  const db = createSupabaseServiceClient();
  const { data: item } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", order.id)
    .eq("pricing_snapshot->>lineIndex", String(file.itemIndex))
    .maybeSingle();
  const { error } = await db.from("order_files").insert({
    order_id: order.id,
    order_item_id: item?.id ?? null,
    purpose: file.purpose,
    bucket: "customer-files",
    storage_path: file.path,
    mime: check.mime,
    size_bytes: check.size,
    original_name: file.name.slice(0, 200) || null,
  });
  return error ? { ok: false, error: "No se pudo registrar el archivo." } : { ok: true };
}

export async function createReceiptUpload(
  code: string,
  token: string,
  mime: string,
): Promise<{ ok: true; path: string; uploadToken: string } | { ok: false; error: string }> {
  if (!(await allowRequest("upload", 60, 3600))) return { ok: false, error: "Demasiados archivos seguidos. Espera un rato." };
  const order = await findOrderByToken(code, token);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (!["pending_payment", "payment_review"].includes(order.status)) return { ok: false, error: "Este pedido ya no admite comprobantes." };
  const ext = extForMime[mime];
  if (!ext) return { ok: false, error: "Usa una foto (JPG, PNG, WebP) o un PDF." };
  const path = `orders/${order.id}/${randomUUID()}.${ext}`;
  const { data } = await createSupabaseServiceClient().storage.from("receipts").createSignedUploadUrl(path);
  if (!data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path, uploadToken: data.token };
}

export async function confirmReceipt(code: string, token: string, path: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await findOrderByToken(code, token);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (!new RegExp(`^orders/${order.id}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(path)) return { ok: false, error: "Archivo inválido." };
  const check = await verifyStoredFile("receipts", path, "receipt");
  if (!check.ok) return { ok: false, error: check.reason };

  const db = createSupabaseServiceClient();
  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("order_id", order.id);
  // Primer comprobante = lo acordado ahora; los siguientes = el saldo. El administrador confirma lo que realmente llegó.
  const declared = (count ?? 0) === 0 ? Number(order.due_now_cents) : Math.max(1, Number(order.balance_cents));
  const { error } = await db.rpc("submit_receipt", {
    p_order: order.id,
    p_file: { path, mime: check.mime, size: check.size, name: name.slice(0, 200) },
    p_declared: declared,
  });
  return error ? { ok: false, error: "No se pudo registrar el comprobante." } : { ok: true };
}
