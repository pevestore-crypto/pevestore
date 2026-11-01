"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inputClass, primaryButton, secondaryButton } from "@/components/admin/form-ui";
import { centsToInput, formatDOP, parsePesos } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, type OrderStatus, allowedNextStatuses } from "@/lib/domain/order-status";
import { reviewPayment, setOrderStatus } from "./actions";

export function PaymentReview({ paymentId, declaredCents }: { paymentId: string; declaredCents: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(centsToInput(declaredCents));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (decision: "verify" | "reject") =>
    start(async () => {
      setError(null);
      const cents = parsePesos(amount);
      if (decision === "verify") {
        if (cents === null || cents <= 0) return setError("Monto inválido. Ejemplo: 1,900");
        if (!window.confirm(`¿Confirmas que ${formatDOP(cents)} llegaron a la cuenta del negocio?`)) return;
      }
      const r = await reviewPayment({ paymentId, decision, verifiedCents: decision === "verify" ? cents : null, note });
      if (!r.ok) return setError(r.errors._);
      router.refresh();
    });

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface p-3">
      <p className="text-xs text-muted">Revisa tu cuenta bancaria. Verifica solo si el dinero realmente llegó.</p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor={`amt-${paymentId}`} className="mb-1 block text-xs font-medium">Monto recibido (RD$)</label>
          <input id={`amt-${paymentId}`} inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`note-${paymentId}`} className="mb-1 block text-xs font-medium">Nota (obligatoria si rechazas)</label>
          <input id={`note-${paymentId}`} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: referencia 12345 / no aparece en la cuenta" />
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run("verify")} className={`${primaryButton} h-10 text-sm`}>Verificar pago</button>
        <button type="button" disabled={pending} onClick={() => run("reject")} className={`${secondaryButton} h-10 text-sm`}>Rechazar</button>
      </div>
    </div>
  );
}

export function StatusChanger({ orderId, status, paidEnough }: { orderId: string; status: OrderStatus; paidEnough: boolean }) {
  const router = useRouter();
  const next = allowedNextStatuses(status);
  const [target, setTarget] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (next.length === 0) return <p className="text-sm text-muted">Este pedido está cerrado ({ORDER_STATUS_LABEL[status]}).</p>;

  const submit = () =>
    start(async () => {
      setError(null);
      if (!target) return setError("Elige el nuevo estado.");
      if (target === "cancelled" && !window.confirm("¿Cancelar este pedido? No se puede reabrir.")) return;
      const r = await setOrderStatus({ orderId, status: target, note });
      if (!r.ok) return setError(r.errors._);
      setTarget("");
      setNote("");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nuevo estado">
        {next.map((s) => {
          const blocked = s === "confirmed" && !paidEnough;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={target === s}
              disabled={blocked}
              title={blocked ? "Verifica primero el pago del anticipo" : undefined}
              onClick={() => setTarget(s)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${target === s ? "border-brand bg-brand-soft text-brand" : "border-border bg-background hover:bg-surface"}`}
            >
              {ORDER_STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      {next.includes("confirmed") && !paidEnough && <p className="text-xs text-muted">Para confirmar, primero verifica el pago del anticipo.</p>}
      <div>
        <label htmlFor="status-note" className="mb-1 block text-xs font-medium">Nota (opcional, queda en el historial)</label>
        <input id="status-note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <button type="button" disabled={pending || !target} onClick={submit} className={`${primaryButton} h-10 text-sm`}>
        {pending ? "Guardando…" : target ? `Cambiar a “${ORDER_STATUS_LABEL[target]}”` : "Cambiar estado"}
      </button>
    </div>
  );
}
