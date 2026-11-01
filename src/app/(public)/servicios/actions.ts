"use server";

import { randomUUID } from "node:crypto";
import { fieldErrors } from "@/lib/admin/catalog-schema";
import { normalizeWhatsAppNumber } from "@/lib/domain/whatsapp";
import { allowRequest, verifyStoredFile } from "@/lib/orders/access";
import { extForMime } from "@/lib/orders/checkout";
import { type QuoteInput, quoteSchema } from "@/lib/quotes/quote-schema";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type QuoteResult =
  | { ok: true; quoteId: string; code: string; serviceName: string; uploads: { index: number; path: string; token: string }[] }
  | { ok: false; errors: Record<string, string> };

export async function submitQuote(input: QuoteInput): Promise<QuoteResult> {
  if (!(await allowRequest("quote-request", 6, 3600))) {
    return { ok: false, errors: { _: "Has enviado varias solicitudes seguidas. Espera un rato o escríbenos por WhatsApp." } };
  }
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const q = parsed.data;

  const db = createSupabaseServiceClient();
  const { data: service } = await db.from("services").select("id, name").eq("id", q.serviceId).eq("is_active", true).maybeSingle();
  if (!service) return { ok: false, errors: { serviceId: "Ese servicio no está disponible." } };

  const { data: created, error } = await db
    .from("quote_requests")
    .insert({
      service_id: service.id,
      service_name: service.name,
      customer_name: q.customerName,
      whatsapp: normalizeWhatsAppNumber(q.whatsapp),
      measurements: q.measurements || null,
      quantity: q.quantity === "" ? null : q.quantity,
      material: q.material || null,
      required_date: q.requiredDate || null,
      description: q.description,
    })
    .select("id, code")
    .single();
  if (error || !created) return { ok: false, errors: { _: "No pudimos registrar la solicitud. Inténtalo de nuevo." } };

  const uploads: { index: number; path: string; token: string }[] = [];
  for (const [index, f] of q.files.entries()) {
    const path = `quotes/${created.id}/${randomUUID()}.${extForMime[f.mime]}`;
    const { data } = await db.storage.from("customer-files").createSignedUploadUrl(path);
    if (data) uploads.push({ index, path, token: data.token });
  }
  return { ok: true, quoteId: created.id, code: created.code, serviceName: service.name, uploads };
}

/**
 * Registra un archivo ya subido. El id de la cotización solo lo conoce quien la
 * envió, y solo se aceptan archivos durante los primeros 30 minutos.
 */
export async function attachQuoteFile(quoteId: string, path: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await allowRequest("upload", 60, 3600))) return { ok: false, error: "Demasiados archivos seguidos." };
  if (!/^[0-9a-f-]{36}$/.test(quoteId) || !new RegExp(`^quotes/${quoteId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(path)) {
    return { ok: false, error: "Archivo inválido." };
  }
  const db = createSupabaseServiceClient();
  const { data: quote } = await db.from("quote_requests").select("id, created_at, quote_files(count)").eq("id", quoteId).maybeSingle();
  if (!quote) return { ok: false, error: "Solicitud no encontrada." };
  if (Date.now() - new Date(quote.created_at).getTime() > 30 * 60 * 1000) return { ok: false, error: "El tiempo para adjuntar archivos terminó. Envíalos por WhatsApp." };
  if (((quote.quote_files as unknown as { count: number }[])[0]?.count ?? 0) >= 5) return { ok: false, error: "Máximo 5 archivos." };

  const check = await verifyStoredFile("customer-files", path, "reference");
  if (!check.ok) return { ok: false, error: check.reason };
  const { error } = await db.from("quote_files").insert({ quote_id: quoteId, storage_path: path, mime: check.mime, size_bytes: check.size, original_name: name.slice(0, 200) || null });
  return error ? { ok: false, error: "No se pudo registrar el archivo." } : { ok: true };
}
