"use client";

import { useState, useTransition } from "react";
import { formatDOP } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/domain/order-status";
import { formatIsoDateLong } from "@/lib/domain/schedule";
import { type LookupResult, lookupOrder } from "./actions";

const input = "h-12 w-full rounded-xl border border-border bg-surface-raised px-4 text-base outline-none focus:border-brand";

const TIMELINE: { status: OrderStatus; label: string; hint: string }[] = [
  { status: "payment_review", label: "Pago por verificar", hint: "Estamos revisando tu transferencia." },
  { status: "confirmed", label: "Confirmado", hint: "Recibimos tu pago." },
  { status: "in_production", label: "En producción", hint: "Estamos preparando tu pedido." },
  { status: "ready_for_pickup", label: "Listo para retirar", hint: "Ya puedes pasar a buscarlo." },
  { status: "delivered", label: "Entregado", hint: "¡Gracias por tu compra!" },
];
const ORDER: OrderStatus[] = ["pending_payment", "payment_review", "confirmed", "pending_design", "in_production", "ready_for_pickup", "delivered"];

function reached(current: OrderStatus, step: OrderStatus) {
  if (current === "cancelled") return false;
  const c = current === "pending_design" ? ORDER.indexOf("confirmed") : ORDER.indexOf(current);
  return c >= ORDER.indexOf(step);
}

export function LookupForm() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setResult(await lookupOrder(code, phone)));
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-medium">Número de pedido</label>
          <input id="code" className={`${input} uppercase`} placeholder="PEV-000125" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-sm font-medium">Tu número de WhatsApp</label>
          <input id="phone" type="tel" inputMode="tel" autoComplete="tel" className={input} placeholder="809-123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="text-xs text-muted">El mismo con el que hiciste el pedido.</p>
        </div>
        <button type="submit" disabled={pending || !code || !phone} className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-contrast hover:bg-brand-hover disabled:opacity-50">
          {pending ? "Consultando…" : "Consultar pedido"}
        </button>
      </form>

      {result && !result.ok && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">{result.error}</p>}

      {result?.ok && (
        <section aria-live="polite" className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 font-semibold">
            <span aria-hidden className="text-success">✓</span> Pedido: {result.code}
          </div>
          {result.status === "cancelled" ? (
            <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">Este pedido fue cancelado. Escríbenos por WhatsApp si tienes dudas.</p>
          ) : result.status === "pending_payment" ? (
            <p className="rounded-xl bg-surface px-4 py-3 text-sm">Aún no recibimos tu comprobante de pago. Usa el enlace que te dimos al hacer el pedido para subirlo, o envíalo por WhatsApp.</p>
          ) : (
            <ol className="space-y-3">
              {TIMELINE.map((step) => {
                const done = reached(result.status, step.status);
                const current = result.status === step.status || (result.status === "pending_design" && step.status === "confirmed");
                return (
                  <li key={step.status} className="flex gap-3">
                    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs ${done ? "bg-success text-white" : "border-2 border-border"}`}>{done ? "✓" : ""}</span>
                    <span>
                      <span className={`block text-sm ${done ? "font-semibold" : "text-muted"}`}>{step.label}</span>
                      {current && <span className="block text-xs text-muted">{result.status === "pending_design" ? "Estamos trabajando en tu diseño." : step.hint}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <dl className="space-y-2 rounded-xl bg-surface p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Estado</dt><dd className="font-semibold">{ORDER_STATUS_LABEL[result.status]}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Fecha estimada de entrega</dt><dd className="font-semibold text-brand">{formatIsoDateLong(result.estimatedDate ?? result.requiredDate)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Pagado (verificado)</dt><dd className="tabular-nums">{formatDOP(result.paidCents)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Saldo pendiente</dt><dd className="font-semibold tabular-nums">{formatDOP(result.pendingCents)}</dd></div>
          </dl>
        </section>
      )}
    </div>
  );
}
