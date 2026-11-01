import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { inputClass } from "@/components/admin/form-ui";
import { listCustomers } from "@/lib/admin/customers";
import { formatDOP } from "@/lib/domain/money";
import { BUSINESS_TZ } from "@/lib/domain/schedule";

export const metadata: Metadata = { title: "Clientes" };
const day = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeZone: BUSINESS_TZ });

export default function CustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <p className="mt-1 text-sm text-muted">Se registran solos al hacer un pedido (sin cuenta), identificados por su WhatsApp.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const rows = await listCustomers(q);
  return (
    <>
      <form action="/admin/clientes" role="search" className="mt-4 flex gap-2">
        <label htmlFor="q" className="sr-only">Buscar cliente</label>
        <input id="q" name="q" defaultValue={q} placeholder="Nombre o teléfono" className={inputClass} />
        <button type="submit" className="h-11 rounded-xl bg-foreground px-4 font-semibold text-background">Buscar</button>
      </form>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">{q ? "Ningún cliente coincide." : "Todavía no hay clientes."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clientes/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-xs text-muted">+{c.whatsapp}{c.lastOrderAt && ` · último pedido ${day.format(new Date(c.lastOrderAt))}`}</span>
                </span>
                <span className="text-sm text-muted">{c.orderCount} {c.orderCount === 1 ? "pedido" : "pedidos"}</span>
                <span className="text-sm font-semibold tabular-nums">{formatDOP(c.paidCents)}</span>
                {c.owedCents > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">Debe {formatDOP(c.owedCents)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
