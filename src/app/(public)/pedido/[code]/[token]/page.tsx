import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BankBadge } from "@/components/catalog/bank-badge";
import { IconWhatsApp } from "@/components/ui/icons";
import { formatDOP } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/domain/order-status";
import { formatIsoDateLong } from "@/lib/domain/schedule";
import { buildOrderMessage, whatsappLink } from "@/lib/domain/whatsapp";
import { findOrderByToken } from "@/lib/orders/access";
import type { PublicBank } from "@/lib/orders/checkout";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { CopyButton } from "./copy-button";
import { ReceiptUpload } from "./receipt-upload";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
  // El enlace contiene un código privado: no se envía a otros sitios al salir.
  referrer: "no-referrer",
};

const MODE_LABEL: Record<string, string> = { own_design: "Diseño suministrado", gallery: "Diseño de la galería", idea: "Idea del cliente" };
const STEPS: { key: string; label: string; done: (s: OrderStatus) => boolean }[] = [
  { key: "order", label: "Pedido", done: () => true },
  { key: "pay", label: "Pago", done: (s) => s !== "pending_payment" },
  { key: "ok", label: "Confirmación", done: (s) => !["pending_payment", "payment_review", "cancelled"].includes(s) },
];

export default function OrderStatusPage({ params, searchParams }: PageProps<"/pedido/[code]/[token]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 lg:pt-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ params, searchParams }: { params: Promise<{ code: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ code, token }, sp] = await Promise.all([params, searchParams]);
  const order = await findOrderByToken(code, token);
  if (!order) notFound();

  const db = createSupabaseServiceClient();
  const [items, files, payments, settings] = await Promise.all([
    db.from("order_items").select("id, product_name, variant_name, quantity, unit_cents, total_cents, customization_mode, pricing_snapshot").eq("order_id", order.id),
    db.from("order_files").select("purpose").eq("order_id", order.id),
    db.from("payments").select("status").eq("order_id", order.id),
    db.from("settings").select("whatsapp_number").single(),
  ]);
  const lines = (items.data ?? []).sort((a, b) => Number(a.pricing_snapshot?.lineIndex ?? 0) - Number(b.pricing_snapshot?.lineIndex ?? 0));
  const status = order.status as OrderStatus;
  const bank = order.bank_snapshot as PublicBank | null;
  const hasReceipt = (files.data ?? []).some((f) => f.purpose === "receipt");
  const canUpload = status === "pending_payment" || status === "payment_review";
  const failedUploads = Number(sp.archivos ?? 0);
  const dueNow = Number(order.due_now_cents);
  const total = Number(order.total_cents);
  const balance = Number(order.balance_cents);
  const paidVerified = Number(order.paid_verified_cents);

  const waNumber = settings.data?.whatsapp_number;
  const waText = buildOrderMessage({
    orderNumber: order.code,
    customerName: order.customer_name,
    items: lines.map((l) => ({
      name: l.variant_name ? `${l.product_name} (${l.variant_name})` : l.product_name,
      quantity: l.quantity,
      customization: MODE_LABEL[l.customization_mode ?? ""] ?? "Sin personalización",
    })),
    requiredDate: formatIsoDateLong(order.required_date),
    totalCents: total,
    dueNowCents: dueNow,
    balanceCents: balance,
    bankName: bank ? { banreservas: "Banreservas", popular: "Banco Popular", bhd: "Banco BHD" }[bank.bankCode] : null,
    statusLabel: hasReceipt ? "Pago pendiente de verificación" : "Pendiente de pago",
    receiptUploaded: hasReceipt,
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-success-soft p-4 sm:p-5">
        <p className="text-sm font-semibold text-success">¡Pedido registrado!</p>
        <h1 className="mt-1 text-2xl font-bold">Pedido {order.code}</h1>
        <p className="mt-1 text-sm">Estado: <strong>{ORDER_STATUS_LABEL[status]}</strong></p>
        <p className="mt-2 text-xs text-muted">Guarda esta página en tus favoritos: con este enlace privado puedes consultar tu pedido cuando quieras.</p>
      </div>

      <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progreso">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${s.done(status) ? "bg-brand text-brand-contrast" : "bg-surface text-muted"}`}>{s.done(status) ? "✓" : i + 1}</span>
            <span className={s.done(status) ? "" : "text-muted"}>{s.label}</span>
            {i < STEPS.length - 1 && <span aria-hidden className={`h-0.5 flex-1 ${STEPS[i + 1].done(status) ? "bg-brand" : "bg-border"}`} />}
          </li>
        ))}
      </ol>

      {failedUploads > 0 && (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          No pudimos recibir {failedUploads === 1 ? "uno de tus archivos" : `${failedUploads} de tus archivos`}. Envíalos por WhatsApp junto con el número de pedido.
        </p>
      )}

      {canUpload && bank && (
        <section aria-labelledby="h-transfer" className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
          <h2 id="h-transfer" className="text-lg font-bold">{hasReceipt ? "Comprobante recibido" : "Realiza tu transferencia"}</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-surface p-3"><dt className="text-muted">Total del pedido</dt><dd className="text-lg font-bold tabular-nums">{formatDOP(total)}</dd></div>
            <div className="rounded-xl bg-brand-soft p-3 text-brand"><dt>Monto a transferir</dt><dd className="text-lg font-bold tabular-nums">{formatDOP(paidVerified > 0 ? balance : dueNow)}</dd></div>
            <div className="rounded-xl bg-surface p-3"><dt className="text-muted">Saldo pendiente</dt><dd className="text-lg font-bold tabular-nums">{formatDOP(balance)}</dd></div>
          </dl>

          <div className="rounded-xl border border-border p-4">
            <BankBadge code={bank.bankCode} />
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-muted">Cuenta {bank.accountType === "ahorros" ? "de ahorros" : "corriente"}</dt>
                <dd className="flex items-center gap-2 font-mono text-base font-bold">{bank.accountNumber}<CopyButton value={bank.accountNumber.replace(/-/g, "")} label="Copiar número de cuenta" /></dd>
              </div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Titular</dt><dd className="text-right font-medium">{bank.accountHolder}</dd></div>
              {bank.holderIdDoc && <div className="flex justify-between gap-2"><dt className="text-muted">RNC / Cédula</dt><dd className="font-medium">{bank.holderIdDoc}</dd></div>}
              <div className="flex justify-between gap-2"><dt className="text-muted">Concepto</dt><dd className="font-medium">{order.code}</dd></div>
            </dl>
          </div>

          <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
            📸 Recuerda guardar una captura de tu transferencia. La necesitarás para completar tu pedido.
          </p>
          <ReceiptUpload code={order.code} token={token} hasReceipt={hasReceipt} />
        </section>
      )}

      {waNumber && (
        <a
          href={whatsappLink(waNumber, waText)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white hover:brightness-95"
        >
          <IconWhatsApp className="size-5" /> Continuar por WhatsApp
        </a>
      )}

      <section aria-labelledby="h-resumen" className="rounded-2xl border border-border p-4 sm:p-5">
        <h2 id="h-resumen" className="text-lg font-bold">Resumen</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{l.quantity} × {l.product_name}</span>
                {l.variant_name && <span className="text-muted"> · {l.variant_name}</span>}
                {l.customization_mode && <span className="block text-xs text-muted">{MODE_LABEL[l.customization_mode]}</span>}
              </span>
              <span className="tabular-nums">{formatDOP(Number(l.total_cents))}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
          <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{formatDOP(total)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Pago verificado</dt><dd className="tabular-nums">{formatDOP(paidVerified)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Fecha requerida</dt><dd>{formatIsoDateLong(order.required_date)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Comprobantes enviados</dt><dd>{(payments.data ?? []).length}</dd></div>
        </dl>
      </section>
    </div>
  );
}
