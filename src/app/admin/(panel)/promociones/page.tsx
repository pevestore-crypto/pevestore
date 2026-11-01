import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { primaryButton } from "@/components/admin/form-ui";
import { listPromotions } from "@/lib/admin/promotions";
import { BUSINESS_TZ } from "@/lib/domain/schedule";

export const metadata: Metadata = { title: "Promociones" };

const PHASE = {
  running: { label: "En curso", tone: "bg-success-soft text-success" },
  scheduled: { label: "Programada", tone: "bg-info-soft text-info" },
  ended: { label: "Terminada", tone: "bg-surface text-muted" },
  disabled: { label: "Pausada", tone: "bg-warning-soft text-warning" },
} as const;
const fmt = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TZ });

export default function PromotionsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Promociones</h1>
        <Link href="/admin/promociones/nueva" className={primaryButton}>Nueva oferta</Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const rows = await listPromotions();
  if (!rows.length) return <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">Todavía no hay ofertas.</p>;
  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/admin/promociones/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-xs text-muted">{r.targetName} · {r.discountLabel}</span>
            </span>
            <span className="text-xs text-muted">{fmt.format(new Date(r.startsAt))} → {fmt.format(new Date(r.endsAt))}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PHASE[r.phase].tone}`}>{PHASE[r.phase].label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
