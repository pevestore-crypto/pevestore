import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/admin/status-badge";
import { IconWhatsApp } from "@/components/ui/icons";
import { getCustomer } from "@/lib/admin/customers";
import { formatDOP } from "@/lib/domain/money";
import { BUSINESS_TZ } from "@/lib/domain/schedule";
import { whatsappLink } from "@/lib/domain/whatsapp";

export const metadata: Metadata = { title: "Cliente" };
const day = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeZone: BUSINESS_TZ });

export default function CustomerPage({ params }: PageProps<"/admin/clientes/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-background" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCustomer(id);
  return (
    <div className="space-y-4">
      <Link href="/admin/clientes" className="text-sm text-muted hover:text-foreground">← Clientes</Link>
      <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <p className="text-sm text-muted">+{c.whatsapp} · cliente desde {day.format(new Date(c.since))}</p>
        <a
          href={whatsappLink(c.whatsapp, `Hola ${c.name.split(" ")[0]}, te escribimos de PEVESTORE.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-95"
        >
          <IconWhatsApp className="size-4" /> Escribir por WhatsApp
        </a>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-surface p-3"><dt className="text-xs text-muted">Pedidos</dt><dd className="text-lg font-bold">{c.orderCount}</dd></div>
          <div className="rounded-xl bg-surface p-3"><dt className="text-xs text-muted">Pagado (verificado)</dt><dd className="text-lg font-bold tabular-nums">{formatDOP(c.paidCents)}</dd></div>
          <div className="rounded-xl bg-surface p-3"><dt className="text-xs text-muted">Debe</dt><dd className="text-lg font-bold tabular-nums">{formatDOP(c.owedCents)}</dd></div>
        </dl>
      </section>
      <section className="rounded-2xl border border-border bg-background">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Pedidos</h2>
        <ul className="divide-y divide-border">
          {c.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                <span className="font-mono text-sm font-semibold">{o.code}</span>
                <span className="flex-1 text-xs text-muted">{day.format(new Date(o.createdAt))}</span>
                <StatusBadge status={o.status} />
                <span className="text-sm font-semibold tabular-nums">{formatDOP(o.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
