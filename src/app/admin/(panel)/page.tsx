import Link from "next/link";
import { Suspense } from "react";
import { getDashboard } from "@/lib/admin/dashboard";
import { formatDOP } from "@/lib/domain/money";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/domain/order-status";

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Panel de control</h1>
      <p className="mt-1 text-sm text-muted">Resumen de pedidos y cobros.</p>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

const toneClass = {
  neutral: "bg-surface text-foreground",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  danger: "bg-brand-soft text-danger",
} as const;

async function Dashboard() {
  const d = await getDashboard();

  const tiles = [
    { label: "Pendientes de pago", value: d.counts.pending_payment, tone: "neutral" },
    { label: "Pagos por verificar", value: d.counts.payment_review, tone: "warning" },
    { label: "En producción", value: d.counts.in_production, tone: "info" },
    { label: "Listos para retirar", value: d.counts.ready_for_pickup, tone: "success" },
  ] as const;

  return (
    <>
      <section aria-label="Pedidos por estado" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-2xl p-4 ${toneClass[t.tone]}`}>
            <p className="text-3xl font-bold tabular-nums">{t.value}</p>
            <p className="mt-1 text-sm font-medium">{t.label}</p>
          </div>
        ))}
      </section>

      <section aria-label="Dinero" className="mt-3 grid gap-3 sm:grid-cols-3">
        <Money label="Ventas confirmadas" value={d.confirmedSalesCents} />
        <Money label="Recibido (verificado)" value={d.verifiedReceivedCents} />
        <Money label="Saldos pendientes de cobro" value={d.pendingBalanceCents} />
      </section>

      <section aria-labelledby="recientes" className="mt-6 rounded-2xl border border-border bg-background">
        <h2 id="recientes" className="border-b border-border px-4 py-3 font-semibold">Pedidos recientes</h2>
        {d.recent.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Todavía no hay pedidos.</p>
        ) : (
          <ul className="divide-y divide-border">
            {d.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                  <span className="font-mono text-sm font-semibold">{o.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{o.customerName}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[ORDER_STATUS_TONE[o.status]]}`}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{formatDOP(o.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{formatDOP(value)}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden className="mt-6 animate-pulse space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 rounded-2xl bg-background" />)}
      </div>
      <div className="h-24 rounded-2xl bg-background" />
      <div className="h-48 rounded-2xl bg-background" />
    </div>
  );
}
