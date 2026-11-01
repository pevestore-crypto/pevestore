import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { inputClass } from "@/components/admin/form-ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { listOrders } from "@/lib/admin/orders";
import { formatDOP } from "@/lib/domain/money";
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from "@/lib/domain/order-status";
import { formatIsoDateLong } from "@/lib/domain/schedule";

export const metadata: Metadata = { title: "Pedidos" };

export default function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-background" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = typeof sp.estado === "string" ? sp.estado : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const { rows, counts } = await listOrders({ status, q });
  const href = (s: string) => `/admin/pedidos?${new URLSearchParams({ ...(s ? { estado: s } : {}), ...(q ? { q } : {}) })}`;
  const tab = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-brand text-brand-contrast" : "bg-background hover:bg-border"}`;

  return (
    <>
      <form action="/admin/pedidos" className="mt-4 flex gap-2" role="search">
        {status && <input type="hidden" name="estado" value={status} />}
        <label htmlFor="q" className="sr-only">Buscar pedido</label>
        <input id="q" name="q" defaultValue={q} placeholder="PEV-000125, nombre o teléfono" className={inputClass} />
        <button type="submit" className="h-11 rounded-xl bg-foreground px-4 font-semibold text-background">Buscar</button>
      </form>

      <nav aria-label="Filtrar por estado" className="-mx-4 mt-3 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2 pb-1">
          <li><Link href={href("")} className={tab(!status)}>Todos</Link></li>
          {ORDER_STATUSES.map((s) => (
            <li key={s}>
              <Link href={href(s)} className={tab(status === s)}>
                {ORDER_STATUS_LABEL[s]} {counts[s] ? <span className="opacity-70">({counts[s]})</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">
          {q || status ? "No hay pedidos con ese filtro." : "Todavía no hay pedidos."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                <span className="font-mono text-sm font-semibold">{o.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{o.customerName}</span>
                {o.pendingPayments > 0 && (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                    {o.pendingPayments} {o.pendingPayments === 1 ? "pago" : "pagos"} por revisar
                  </span>
                )}
                <StatusBadge status={o.status} />
                <span className="w-full text-xs text-muted sm:w-auto">Para el {formatIsoDateLong(o.requiredDate)}</span>
                <span className="text-sm font-semibold tabular-nums">{formatDOP(o.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
