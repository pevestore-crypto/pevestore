import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain/order-status";
import { parseOrderNumber } from "@/lib/domain/order-number";
import type { PublicBank } from "@/lib/orders/checkout";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrderRow {
  id: string;
  code: string;
  customerName: string;
  customerWhatsapp: string;
  status: OrderStatus;
  totalCents: number;
  paidVerifiedCents: number;
  requiredDate: string;
  createdAt: string;
  pendingPayments: number;
}

export async function listOrders(filter: { status?: string; q?: string }): Promise<{ rows: OrderRow[]; counts: Record<string, number> }> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("orders")
    .select("id, code, customer_name, customer_whatsapp, status, total_cents, paid_verified_cents, required_date, created_at, payments(status)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter.status && (ORDER_STATUSES as readonly string[]).includes(filter.status)) query = query.eq("status", filter.status);
  const q = filter.q?.trim();
  if (q) {
    const number = parseOrderNumber(q);
    const digits = q.replace(/\D/g, "");
    if (number) query = query.eq("number", number);
    else if (digits.length >= 4) query = query.ilike("customer_whatsapp", `%${digits}%`);
    else query = query.ilike("customer_name", `%${q.replace(/[%_,()]/g, " ")}%`);
  }

  const [{ data, error }, statuses] = await Promise.all([query, supabase.from("orders").select("status")]);
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const o of statuses.data ?? []) counts[o.status] = (counts[o.status] ?? 0) + 1;

  return {
    counts,
    rows: data.map((o) => ({
      id: o.id,
      code: o.code,
      customerName: o.customer_name,
      customerWhatsapp: o.customer_whatsapp,
      status: o.status as OrderStatus,
      totalCents: Number(o.total_cents),
      paidVerifiedCents: Number(o.paid_verified_cents),
      requiredDate: o.required_date,
      createdAt: o.created_at,
      pendingPayments: ((o.payments as { status: string }[]) ?? []).filter((p) => p.status === "pending").length,
    })),
  };
}

export interface OrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerWhatsapp: string;
  requiredDate: string;
  notes: string | null;
  paymentPlan: "deposit_50" | "full";
  bank: PublicBank | null;
  totalCents: number;
  dueNowCents: number;
  balanceCents: number;
  paidVerifiedCents: number;
  termsVersion: number;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitCents: number;
    totalCents: number;
    mode: string | null;
    ideaText: string | null;
    design: { title: string; url: string } | null;
    files: FileLink[];
  }[];
  receipts: FileLink[];
  payments: {
    id: string;
    status: "pending" | "verified" | "rejected";
    declaredCents: number;
    verifiedCents: number | null;
    note: string | null;
    createdAt: string;
    verifiedAt: string | null;
    receiptId: string | null;
  }[];
  history: { from: string | null; to: string; note: string | null; at: string; by: string | null }[];
}

export interface FileLink {
  id: string;
  purpose: string;
  name: string;
  mime: string;
  sizeBytes: number;
  url: string | null;
}

/** Enlaces firmados de 10 minutos: los archivos nunca quedan públicos. */
const SIGNED_SECONDS = 600;

export async function getOrder(id: string): Promise<OrderDetail> {
  await requireAdmin();
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(*, designs(title, storage_path)), order_files(*), payments(*), order_status_history(*)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  type FileRow = { id: string; order_item_id: string | null; purpose: string; bucket: string; storage_path: string; mime: string; size_bytes: number; original_name: string | null };
  const files = (o.order_files as FileRow[]) ?? [];
  const signed = new Map<string, string | null>();
  for (const bucket of ["customer-files", "receipts"]) {
    const paths = files.filter((f) => f.bucket === bucket).map((f) => f.storage_path);
    if (!paths.length) continue;
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_SECONDS);
    for (const s of data ?? []) if (s.path) signed.set(s.path, s.signedUrl ?? null);
  }
  const link = (f: FileRow): FileLink => ({
    id: f.id,
    purpose: f.purpose,
    name: f.original_name || f.storage_path.split("/").pop() || "archivo",
    mime: f.mime,
    sizeBytes: f.size_bytes,
    url: signed.get(f.storage_path) ?? null,
  });

  // Nombres de quienes hicieron cambios (solo administradores).
  const { data: admins } = await supabase.from("admin_users").select("user_id, full_name");
  const nameOf = new Map((admins ?? []).map((a) => [a.user_id, a.full_name]));

  type Item = { id: string; product_name: string; variant_name: string | null; quantity: number; unit_cents: number; total_cents: number; customization_mode: string | null; idea_text: string | null; pricing_snapshot: { lineIndex?: number }; designs: { title: string; storage_path: string } | null };
  type Pay = { id: string; status: OrderDetail["payments"][number]["status"]; declared_cents: number; verified_cents: number | null; note: string | null; created_at: string; verified_at: string | null; receipt_file_id: string | null };
  type Hist = { from_status: string | null; to_status: string; note: string | null; created_at: string; changed_by: string | null; id: number };

  return {
    id: o.id,
    code: o.code,
    status: o.status,
    customerName: o.customer_name,
    customerWhatsapp: o.customer_whatsapp,
    requiredDate: o.required_date,
    notes: o.notes,
    paymentPlan: o.payment_plan,
    bank: o.bank_snapshot,
    totalCents: Number(o.total_cents),
    dueNowCents: Number(o.due_now_cents),
    balanceCents: Number(o.balance_cents),
    paidVerifiedCents: Number(o.paid_verified_cents),
    termsVersion: o.terms_version,
    createdAt: o.created_at,
    items: (o.order_items as Item[])
      .sort((a, b) => (a.pricing_snapshot?.lineIndex ?? 0) - (b.pricing_snapshot?.lineIndex ?? 0))
      .map((i) => ({
        id: i.id,
        productName: i.product_name,
        variantName: i.variant_name,
        quantity: i.quantity,
        unitCents: Number(i.unit_cents),
        totalCents: Number(i.total_cents),
        mode: i.customization_mode,
        ideaText: i.idea_text,
        design: i.designs ? { title: i.designs.title, url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${i.designs.storage_path}` } : null,
        files: files.filter((f) => f.order_item_id === i.id).map(link),
      })),
    receipts: files.filter((f) => f.purpose === "receipt").map(link),
    payments: (o.payments as Pay[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({
        id: p.id,
        status: p.status,
        declaredCents: Number(p.declared_cents),
        verifiedCents: p.verified_cents === null ? null : Number(p.verified_cents),
        note: p.note,
        createdAt: p.created_at,
        verifiedAt: p.verified_at,
        receiptId: p.receipt_file_id,
      })),
    history: (o.order_status_history as Hist[])
      .sort((a, b) => a.id - b.id)
      .map((h) => ({ from: h.from_status, to: h.to_status, note: h.note, at: h.created_at, by: h.changed_by ? nameOf.get(h.changed_by) ?? "Administrador" : null })),
  };
}
