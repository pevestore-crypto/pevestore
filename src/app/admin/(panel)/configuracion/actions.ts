"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbErrorMessage, fieldErrors } from "@/lib/admin/catalog-schema";
import { BANKS, bankAccountSchema, blockedDateSchema, businessSchema, orderRulesSchema, termsSchema } from "@/lib/admin/settings-schema";
import { requireAdmin, requireOwner } from "@/lib/auth/dal";
import { type BankCode, parseBankLogoPaths } from "@/lib/domain/bank-logos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ok = (id = "settings"): ActionResult => ({ ok: true, id });

export async function saveBusiness(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const b = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("settings")
    .update({
      whatsapp_number: b.whatsappNumber || null,
      contact_email: b.contactEmail || null,
      address: b.address || null,
      business_hours: b.businessHours || null,
    })
    .eq("id", true);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok();
}

export async function saveOrderRules(input: unknown): Promise<ActionResult> {
  // Afecta precios y fechas de entrega: solo el dueño.
  await requireOwner();
  const parsed = orderRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const r = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("settings")
    .update({
      default_production_days: r.defaultProductionDays,
      non_working_weekdays: [...new Set(r.nonWorkingWeekdays)].sort(),
      order_cutoff_hour: r.orderCutoffHour === "" ? null : r.orderCutoffHour,
      pricing_stacking: r.pricingStacking,
      rounding_unit: r.roundingUnit,
    })
    .eq("id", true);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok();
}

export async function saveBankAccount(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const a = parsed.data;
  const row = {
    bank_code: a.bankCode,
    account_holder: a.accountHolder,
    account_number: a.accountNumber,
    account_type: a.accountType,
    holder_id_doc: a.holderIdDoc || null,
    is_active: a.isActive,
    sort_order: a.sortOrder,
  };
  const supabase = await createSupabaseServerClient();
  const { data, error } = a.id
    ? await supabase.from("bank_accounts").update(row).eq("id", a.id).select("id").single()
    : await supabase.from("bank_accounts").insert(row).select("id").single();
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok(data.id);
}

export async function deleteBankAccount(id: string): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createSupabaseServerClient();
  // Los pedidos guardan una copia de la cuenta mostrada (bank_snapshot); borrarla no altera su historial.
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok(id);
}

const bankCodeSchema = z.enum(Object.keys(BANKS) as [BankCode, ...BankCode[]]);

export async function createBankLogoUpload(code: string): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  await requireOwner();
  const parsed = bankCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "Banco inválido." };
  const path = `banks/${parsed.data}-${randomUUID()}.webp`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("catalog").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida." };
  return { ok: true, path, token: data.token };
}

/** Guarda (o quita, con path null) el logo de un banco y borra el archivo anterior. */
export async function saveBankLogo(code: string, path: string | null): Promise<ActionResult> {
  await requireOwner();
  const parsed = bankCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, errors: { _: "Banco inválido." } };
  const bank = parsed.data;
  // Solo rutas creadas por createBankLogoUpload para ese banco.
  if (path !== null && !new RegExp(`^banks/${bank}-[0-9a-f-]{36}\\.webp$`).test(path)) return { ok: false, errors: { _: "Archivo inválido." } };

  const supabase = await createSupabaseServerClient();
  const { data: s, error: readErr } = await supabase.from("settings").select("bank_logos").single();
  if (readErr) return { ok: false, errors: dbErrorMessage(readErr) };
  const logos = parseBankLogoPaths(s.bank_logos);
  const previous = logos[bank];
  if (path) logos[bank] = path;
  else delete logos[bank];

  const { error } = await supabase.from("settings").update({ bank_logos: logos }).eq("id", true);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  if (previous && previous !== path) await supabase.storage.from("catalog").remove([previous]);
  updateTag("settings");
  return ok(bank);
}

export async function publishTerms(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data: last } = await supabase.from("terms_versions").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  // Nueva versión: los pedidos anteriores conservan la que aceptaron.
  const { error: offErr } = await supabase.from("terms_versions").update({ is_current: false }).eq("is_current", true);
  if (offErr) return { ok: false, errors: dbErrorMessage(offErr) };
  const { error } = await supabase.from("terms_versions").insert({ version, body: parsed.data.body, is_current: true });
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok(String(version));
}

export async function publishPrivacy(body: string): Promise<ActionResult> {
  await requireOwner();
  const text = body.trim();
  if (text.length < 200) return { ok: false, errors: { privacy: "La política parece incompleta (mínimo 200 caracteres)." } };
  if (text.length > 20000) return { ok: false, errors: { privacy: "Máximo 20,000 caracteres." } };
  if (/\[(completar|razón social|dirección|indicar|revisa)/i.test(text)) {
    return { ok: false, errors: { privacy: "Completa los datos entre corchetes [ … ] antes de publicar." } };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("settings").update({ privacy_body: text, privacy_updated_at: new Date().toISOString() }).eq("id", true);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok();
}

export async function addBlockedDate(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = blockedDateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("blocked_dates").upsert({ date: parsed.data.date, reason: parsed.data.reason || null });
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok(parsed.data.date);
}

export async function removeBlockedDate(date: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("date", date);
  if (error) return { ok: false, errors: dbErrorMessage(error) };
  updateTag("settings");
  return ok(date);
}
