import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BankBadge } from "@/components/catalog/bank-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { IconWhatsApp } from "@/components/ui/icons";
import { type FileLink, getOrder } from "@/lib/admin/orders";
import { formatDOP } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/domain/order-status";
import { BUSINESS_TZ, formatIsoDateLong } from "@/lib/domain/schedule";
import { whatsappLink } from "@/lib/domain/whatsapp";
import { PaymentReview, StatusChanger } from "../order-actions";

export const metadata: Metadata = { title: "Pedido" };

const MODE_LABEL: Record<string, string> = { own_design: "Diseño del cliente", gallery: "Diseño de la galería", idea: "Idea del cliente" };
const PURPOSE_LABEL: Record<string, string> = { design: "Diseño", reference: "Referencia", receipt: "Comprobante" };
const when = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ });

export default function OrderDetailPage({ params }: PageProps<"/admin/pedidos/[id]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-background" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Files({ files }: { files: FileLink[] }) {
  if (!files.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          {f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
              {PURPOSE_LABEL[f.purpose] ?? "Archivo"}: <span className="max-w-40 truncate">{f.name}</span>
              <span className="text-muted">({Math.max(1, Math.round(f.sizeBytes / 1024))} KB)</span>
            </a>
          ) : (
            <span className="text-xs text-danger">No se pudo generar el enlace de {f.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrder(id);
  const remaining = Math.max(0, o.totalCents - o.paidVerifiedCents);
  const paidEnough = o.paidVerifiedCents >= o.dueNowCents;
  const customerMsg = `Hola ${o.customerName.split(" ")[0]}, te escribimos de PEVESTORE sobre tu pedido ${o.code}. Estado actual: ${ORDER_STATUS_LABEL[o.status as OrderStatus]}.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/pedidos" className="text-sm text-muted hover:text-foreground">← Pedidos</Link>
        <h1 className="font-mono text-2xl font-bold">{o.code}</h1>
        <StatusBadge status={o.status} />
        <span className="text-sm text-muted">Recibido {when.format(new Date(o.createdAt))}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Section title="Productos">
            <ul className="divide-y divide-border">
              {o.items.map((i) => (
                <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">
                      {i.quantity} × {i.productName}
                      {i.variantName && <span className="text-muted"> · {i.variantName}</span>}
                    </p>
                    <p className="tabular-nums">{formatDOP(i.totalCents)}</p>
                  </div>
                  <p className="text-xs text-muted">{formatDOP(i.unitCents)} c/u{i.mode && ` · ${MODE_LABEL[i.mode]}`}</p>
                  {i.ideaText && <p className="mt-2 whitespace-pre-line rounded-xl bg-surface px-3 py-2 text-sm">“{i.ideaText}”</p>}
                  {i.design && (
                    <a href={i.design.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border p-1.5 pr-3 text-sm hover:bg-surface">
                      <Image src={i.design.url} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" />
                      Diseño elegido: <strong>{i.design.title}</strong>
                    </a>
                  )}
                  {i.mode === "gallery" && !i.design && <p className="mt-2 text-xs font-medium text-warning">El diseño elegido ya no existe en la galería.</p>}
                  {i.mode === "own_design" && i.files.length === 0 && <p className="mt-2 text-xs font-medium text-warning">El cliente no subió el diseño: pídeselo por WhatsApp.</p>}
                  <Files files={i.files} />
                </li>
              ))}
            </ul>
            {o.notes && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted">Observaciones del cliente</p>
                <p className="whitespace-pre-line text-sm">{o.notes}</p>
              </div>
            )}
          </Section>

          <Section title="Pagos" aside={<span className="text-xs text-muted">{o.paymentPlan === "deposit_50" ? "Eligió 50 % de anticipo" : "Eligió pagar el 100 %"}</span>}>
            {o.payments.length === 0 ? (
              <p className="text-sm text-muted">El cliente aún no ha subido comprobantes.</p>
            ) : (
              <ul className="space-y-3">
                {o.payments.map((p) => {
                  const receipt = o.receipts.find((r) => r.id === p.receiptId);
                  return (
                    <li key={p.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          Declarado: <strong className="tabular-nums">{formatDOP(p.declaredCents)}</strong>
                          <span className="text-muted"> · {when.format(new Date(p.createdAt))}</span>
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            p.status === "verified" ? "bg-success-soft text-success" : p.status === "rejected" ? "bg-brand-soft text-danger" : "bg-warning-soft text-warning"
                          }`}
                        >
                          {p.status === "verified" ? `Verificado ${formatDOP(p.verifiedCents ?? 0)}` : p.status === "rejected" ? "Rechazado" : "Por verificar"}
                        </span>
                      </div>
                      {receipt && <Files files={[receipt]} />}
                      {p.note && <p className="mt-2 text-xs text-muted">Nota: {p.note}</p>}
                      {p.status === "pending" && <PaymentReview paymentId={p.id} declaredCents={p.declaredCents} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Historial">
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {o.history.map((h, i) => (
                <li key={i} className="relative text-sm">
                  <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand" />
                  <p className="font-medium">{ORDER_STATUS_LABEL[h.to as OrderStatus] ?? h.to}</p>
                  <p className="text-xs text-muted">{when.format(new Date(h.at))} · {h.by ?? "Cliente / sistema"}</p>
                  {h.note && <p className="mt-0.5 text-xs">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Cliente">
            <p className="font-medium">{o.customerName}</p>
            <p className="text-sm text-muted">+{o.customerWhatsapp}</p>
            <a
              href={whatsappLink(o.customerWhatsapp, customerMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white hover:brightness-95"
            >
              <IconWhatsApp className="size-4" /> Escribir al cliente
            </a>
            <p className="mt-3 text-sm">Lo necesita para el <strong>{formatIsoDateLong(o.requiredDate)}</strong></p>
          </Section>

          <Section title="Dinero">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="font-semibold tabular-nums">{formatDOP(o.totalCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Anticipo acordado</dt><dd className="tabular-nums">{formatDOP(o.dueNowCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Recibido (verificado)</dt><dd className="font-semibold text-success tabular-nums">{formatDOP(o.paidVerifiedCents)}</dd></div>
              <div className="flex justify-between border-t border-border pt-1.5"><dt className="font-medium">Falta por cobrar</dt><dd className="font-bold tabular-nums">{formatDOP(remaining)}</dd></div>
            </dl>
            {o.bank && (
              <div className="mt-3 border-t border-border pt-3 text-sm">
                <p className="mb-1 text-xs text-muted">Cuenta que vio el cliente</p>
                <BankBadge code={o.bank.bankCode} size="sm" />
                <p className="mt-1 font-mono text-xs">{o.bank.accountNumber}</p>
              </div>
            )}
          </Section>

          <Section title="Cambiar estado">
            <StatusChanger orderId={o.id} status={o.status} paidEnough={paidEnough} />
          </Section>

          <p className="px-1 text-xs text-muted">Aceptó las condiciones comerciales, versión {o.termsVersion}.</p>
        </div>
      </div>
    </div>
  );
}
