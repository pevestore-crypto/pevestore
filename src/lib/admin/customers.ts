import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { type OrderStatus, isConfirmedStatus } from "@/lib/domain/order-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OrderMini = { id: string; code: string; status: OrderStatus; total_cents: number; paid_verified_cents: number; created_at: string };

function summarize(orders: OrderMini[]) {
  const live = orders.filter((o) => o.status !== "cancelled");
  return {
    orderCount: live.length,
    paidCents: live.reduce((s, o) => s + Number(o.paid_verified_cents), 0),
    owedCents: live.filter((o) => isConfirmedStatus(o.status)).reduce((s, o) => s + Math.max(0, Number(o.total_cents) - Number(o.paid_verified_cents)), 0),
    lastOrderAt: orders.map((o) => o.created_at).sort().at(-1) ?? null,
  };
}

export async function listCustomers(q: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("customers")
    .select("id, full_name, whatsapp, created_at, orders(id, code, status, total_cents, paid_verified_cents, created_at)")
    .order("updated_at", { ascending: false })
    .limit(200);
  const term = q.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    query = digits.length >= 4 ? query.ilike("whatsapp", `%${digits}%`) : query.ilike("full_name", `%${term.replace(/[%_,()]/g, " ")}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron cargar los clientes: ${error.message}`);
  return data.map((c) => ({ id: c.id, name: c.full_name, whatsapp: c.whatsapp, ...summarize((c.orders as OrderMini[]) ?? []) }));
}

export async function getCustomer(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase
    .from("customers")
    .select("id, full_name, whatsapp, created_at, orders(id, code, status, total_cents, paid_verified_cents, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const orders = ((c.orders as OrderMini[]) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    id: c.id,
    name: c.full_name,
    whatsapp: c.whatsapp,
    since: c.created_at,
    ...summarize(orders),
    orders: orders.map((o) => ({ id: o.id, code: o.code, status: o.status, totalCents: Number(o.total_cents), paidCents: Number(o.paid_verified_cents), createdAt: o.created_at })),
  };
}
