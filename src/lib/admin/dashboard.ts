import "server-only";
import { requireAdmin } from "@/lib/auth/dal";
import { type OrderStatus, isConfirmedStatus } from "@/lib/domain/order-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DashboardData {
  counts: Record<"pending_payment" | "payment_review" | "in_production" | "ready_for_pickup", number>;
  confirmedSalesCents: number;
  verifiedReceivedCents: number;
  pendingBalanceCents: number;
  recent: { id: string; code: string; customerName: string; status: OrderStatus; totalCents: number; createdAt: string }[];
}

/**
 * Indicadores del panel. Se consultan con la sesión del administrador, así que
 * RLS los protege igual que al resto. Los pagos sin verificar nunca cuentan
 * como dinero recibido.
 */
export async function getDashboard(): Promise<DashboardData> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("status, total_cents, paid_verified_cents")
    .neq("status", "cancelled");
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  const counts = { pending_payment: 0, payment_review: 0, in_production: 0, ready_for_pickup: 0 };
  let confirmedSales = 0;
  let verifiedReceived = 0;
  let pendingBalance = 0;

  for (const o of orders ?? []) {
    const status = o.status as OrderStatus;
    if (status in counts) counts[status as keyof typeof counts]++;
    const total = Number(o.total_cents);
    const paid = Number(o.paid_verified_cents);
    verifiedReceived += paid;
    if (isConfirmedStatus(status)) {
      confirmedSales += total;
      pendingBalance += Math.max(0, total - paid);
    }
  }

  const { data: recent, error: recentError } = await supabase
    .from("orders")
    .select("id, code, customer_name, status, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (recentError) throw new Error(`No se pudieron cargar los pedidos recientes: ${recentError.message}`);

  return {
    counts,
    confirmedSalesCents: confirmedSales,
    verifiedReceivedCents: verifiedReceived,
    pendingBalanceCents: pendingBalance,
    recent: (recent ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      customerName: r.customer_name,
      status: r.status as OrderStatus,
      totalCents: Number(r.total_cents),
      createdAt: r.created_at,
    })),
  };
}
