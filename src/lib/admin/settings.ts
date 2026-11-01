import "server-only";
import { requireAdmin } from "@/lib/auth/dal";
import { privacyDraft } from "@/lib/legal/privacy-draft";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BankAccountInput, BusinessInput, OrderRulesInput } from "./settings-schema";

export interface AdminSettings {
  business: BusinessInput;
  rules: OrderRulesInput;
  banks: BankAccountInput[];
  blockedDates: { date: string; reason: string }[];
  terms: { version: number; body: string } | null;
  privacy: { body: string; updatedAt: string | null; draft: string };
  isOwner: boolean;
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const admin = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [s, banks, dates, terms] = await Promise.all([
    supabase.from("settings").select("*").single(),
    supabase.from("bank_accounts").select("*").order("sort_order"),
    supabase.from("blocked_dates").select("*").order("date"),
    supabase.from("terms_versions").select("version, body").eq("is_current", true).maybeSingle(),
  ]);
  if (s.error) throw new Error(`No se pudo cargar la configuración: ${s.error.message}`);
  const st = s.data;
  return {
    business: {
      whatsappNumber: st.whatsapp_number ?? "",
      contactEmail: st.contact_email ?? "",
      address: st.address ?? "",
      businessHours: st.business_hours ?? "",
    },
    rules: {
      defaultProductionDays: st.default_production_days,
      nonWorkingWeekdays: st.non_working_weekdays ?? [],
      orderCutoffHour: st.order_cutoff_hour ?? "",
      pricingStacking: st.pricing_stacking,
      roundingUnit: st.rounding_unit,
    },
    banks: (banks.data ?? []).map((b) => ({
      id: b.id,
      bankCode: b.bank_code,
      accountHolder: b.account_holder,
      accountNumber: b.account_number,
      accountType: b.account_type,
      holderIdDoc: b.holder_id_doc ?? "",
      isActive: b.is_active,
      sortOrder: b.sort_order,
    })),
    blockedDates: (dates.data ?? []).map((d) => ({ date: d.date, reason: d.reason ?? "" })),
    terms: terms.data ?? null,
    privacy: {
      body: st.privacy_body ?? "",
      updatedAt: st.privacy_updated_at ?? null,
      draft: privacyDraft({ name: st.business_name, email: st.contact_email, whatsapp: st.whatsapp_number, address: st.address }),
    },
    isOwner: admin.role === "owner",
  };
}
