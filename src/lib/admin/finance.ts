import "server-only";
import { BANKS } from "@/lib/admin/settings-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { type OrderStatus, isConfirmedStatus } from "@/lib/domain/order-status";
import type { Period } from "@/lib/domain/periods";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface VerifiedPayment {
  id: string;
  verifiedAt: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  bankName: string;
  verifiedCents: number;
  note: string | null;
}

/**
 * Finanzas: solo cuenta como recibido lo verificado por un administrador.
 * Lo declarado por el cliente aparece aparte como "por verificar".
 */
export async function getFinance(period: Period) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const from = period.fromUtc.toISOString();
  const to = period.toUtc.toISOString();

  const [verified, confirmed, pending, open] = await Promise.all([
    supabase
      .from("payments")
      .select("id, verified_cents, verified_at, note, orders(id, code, customer_name, bank_snapshot), bank_accounts(bank_code)")
      .eq("status", "verified")
      .gte("verified_at", from)
      .lt("verified_at", to)
      .order("verified_at", { ascending: false }),
    supabase.from("orders").select("total_cents").neq("status", "cancelled").gte("confirmed_at", from).lt("confirmed_at", to),
    supabase.from("payments").select("declared_cents").eq("status", "pending"),
    supabase.from("orders").select("status, total_cents, paid_verified_cents").neq("status", "cancelled"),
  ]);
  for (const r of [verified, confirmed, pending, open]) if (r.error) throw new Error(`No se pudieron cargar las finanzas: ${r.error.message}`);

  type Row = { id: string; verified_cents: number; verified_at: string; note: string | null; orders: { id: string; code: string; customer_name: string; bank_snapshot: { bankCode?: keyof typeof BANKS } | null } | null; bank_accounts: { bank_code: keyof typeof BANKS } | null };
  const payments: VerifiedPayment[] = ((verified.data as unknown as Row[]) ?? []).map((p) => {
    const code = p.bank_accounts?.bank_code ?? p.orders?.bank_snapshot?.bankCode;
    return {
      id: p.id,
      verifiedAt: p.verified_at,
      orderId: p.orders?.id ?? "",
      orderCode: p.orders?.code ?? "—",
      customerName: p.orders?.customer_name ?? "—",
      bankName: code ? BANKS[code].name : "Sin banco",
      verifiedCents: Number(p.verified_cents),
      note: p.note,
    };
  });

  const byBank = new Map<string, number>();
  for (const p of payments) byBank.set(p.bankName, (byBank.get(p.bankName) ?? 0) + p.verifiedCents);

  const receivable = (open.data ?? [])
    .filter((o) => isConfirmedStatus(o.status as OrderStatus))
    .reduce((s, o) => s + Math.max(0, Number(o.total_cents) - Number(o.paid_verified_cents)), 0);

  return {
    receivedCents: payments.reduce((s, p) => s + p.verifiedCents, 0),
    confirmedSalesCents: (confirmed.data ?? []).reduce((s, o) => s + Number(o.total_cents), 0),
    confirmedCount: (confirmed.data ?? []).length,
    pendingVerificationCents: (pending.data ?? []).reduce((s, p) => s + Number(p.declared_cents), 0),
    pendingVerificationCount: (pending.data ?? []).length,
    receivableCents: receivable,
    byBank: [...byBank.entries()].map(([bank, cents]) => ({ bank, cents })).sort((a, b) => b.cents - a.cents),
    payments,
  };
}
