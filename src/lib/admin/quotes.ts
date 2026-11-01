import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const QUOTE_STATUS = {
  new: { label: "Nueva", tone: "bg-warning-soft text-warning" },
  quoted: { label: "Cotizada", tone: "bg-info-soft text-info" },
  won: { label: "Aceptada", tone: "bg-success-soft text-success" },
  lost: { label: "No concretada", tone: "bg-surface text-muted" },
} as const;
export type QuoteStatus = keyof typeof QUOTE_STATUS;

export async function listQuotes(status: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("quote_requests")
    .select("id, code, service_name, customer_name, whatsapp, status, required_date, created_at, quote_files(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status in QUOTE_STATUS) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`No se pudieron cargar las cotizaciones: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    code: r.code,
    serviceName: r.service_name,
    customerName: r.customer_name,
    status: r.status as QuoteStatus,
    requiredDate: r.required_date,
    createdAt: r.created_at,
    fileCount: (r.quote_files as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getQuote(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase.from("quote_requests").select("*, quote_files(*)").eq("id", id).maybeSingle();
  if (!q) notFound();
  type F = { id: string; storage_path: string; mime: string; size_bytes: number; original_name: string | null };
  const files = (q.quote_files as F[]) ?? [];
  const { data: signed } = files.length
    ? await supabase.storage.from("customer-files").createSignedUrls(files.map((f) => f.storage_path), 600)
    : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return {
    id: q.id as string,
    code: q.code as string,
    serviceName: q.service_name as string,
    customerName: q.customer_name as string,
    whatsapp: q.whatsapp as string,
    measurements: q.measurements as string | null,
    quantity: q.quantity as number | null,
    material: q.material as string | null,
    requiredDate: q.required_date as string | null,
    description: q.description as string,
    status: q.status as QuoteStatus,
    adminNote: (q.admin_note as string | null) ?? "",
    createdAt: q.created_at as string,
    files: files.map((f) => ({
      id: f.id,
      name: f.original_name || f.storage_path.split("/").pop() || "archivo",
      sizeBytes: f.size_bytes,
      url: urlOf.get(f.storage_path) ?? null,
    })),
  };
}
