"use server";

import { updateTag } from "next/cache";
import { type ActionResult, dbErrorMessage, fieldErrors } from "@/lib/admin/catalog-schema";
import { bankAccountSchema, blockedDateSchema, businessSchema, orderRulesSchema, termsSchema } from "@/lib/admin/settings-schema";
import { requireAdmin, requireOwner } from "@/lib/auth/dal";
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
