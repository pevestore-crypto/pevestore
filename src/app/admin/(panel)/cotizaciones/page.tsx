import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QUOTE_STATUS, listQuotes } from "@/lib/admin/quotes";
import { BUSINESS_TZ } from "@/lib/domain/schedule";

export const metadata: Metadata = { title: "Cotizaciones" };
const when = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ });

export default function QuotesPage({ searchParams }: PageProps<"/admin/cotizaciones">) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Cotizaciones</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-background" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = typeof sp.estado === "string" ? sp.estado : "";
  const rows = await listQuotes(status);
  const tab = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-brand text-brand-contrast" : "bg-background hover:bg-border"}`;
  return (
    <>
      <nav aria-label="Filtrar" className="-mx-4 mt-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2 pb-1">
          <li><Link href="/admin/cotizaciones" className={tab(!status)}>Todas</Link></li>
          {Object.entries(QUOTE_STATUS).map(([k, v]) => (
            <li key={k}><Link href={`/admin/cotizaciones?estado=${k}`} className={tab(status === k)}>{v.label}</Link></li>
          ))}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">No hay solicitudes de cotización.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/cotizaciones/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                <span className="font-mono text-sm font-semibold">{r.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{r.serviceName} · {r.customerName}</span>
                {r.fileCount > 0 && <span className="text-xs text-muted">{r.fileCount} {r.fileCount === 1 ? "archivo" : "archivos"}</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${QUOTE_STATUS[r.status].tone}`}>{QUOTE_STATUS[r.status].label}</span>
                <span className="w-full text-xs text-muted sm:w-auto">{when.format(new Date(r.createdAt))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
