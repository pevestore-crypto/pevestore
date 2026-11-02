import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getFinance } from "@/lib/admin/finance";
import { formatDOP } from "@/lib/domain/money";
import { PERIOD_LABEL, type PeriodPreset, customPeriod, presetPeriod } from "@/lib/domain/periods";
import { BUSINESS_TZ, addDays, formatIsoDateLong } from "@/lib/domain/schedule";

export const metadata: Metadata = { title: "Finanzas" };
const when = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ });

export default function FinancePage({ searchParams }: PageProps<"/admin/finanzas">) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Finanzas</h1>
      <p className="mt-1 text-sm text-muted">Solo se cuenta como recibido el dinero que un administrador verificó en la cuenta del banco.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-background" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Report({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await connection();
  const desde = typeof sp.desde === "string" ? sp.desde : "";
  const hasta = typeof sp.hasta === "string" ? sp.hasta : "";
  const preset = (typeof sp.periodo === "string" && sp.periodo in PERIOD_LABEL ? sp.periodo : "mes") as PeriodPreset;
  const custom = desde && hasta ? customPeriod(desde, hasta) : null;
  const period = custom ?? presetPeriod(preset, new Date());
  const f = await getFinance(period);
  const lastDay = addDays(period.toDate, -1);
  const exportHref = `/admin/finanzas/exportar?desde=${period.fromDate}&hasta=${lastDay}`;
  const chip = (active: boolean) => `inline-block shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-brand text-brand-contrast" : "bg-background hover:bg-border"}`;

  return (
    <div className="mt-4 space-y-4">
      <nav aria-label="Período" className="-mx-4 no-scrollbar overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2 pb-1">
          {(Object.keys(PERIOD_LABEL) as PeriodPreset[]).map((p) => (
            <li key={p}><Link href={`/admin/finanzas?periodo=${p}`} className={chip(!custom && preset === p)}>{PERIOD_LABEL[p]}</Link></li>
          ))}
        </ul>
      </nav>
      <form action="/admin/finanzas" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1"><span className="block text-xs text-muted">Desde</span><input type="date" name="desde" defaultValue={custom ? desde : ""} className="h-10 rounded-xl border border-border bg-surface-raised px-3" /></label>
        <label className="space-y-1"><span className="block text-xs text-muted">Hasta</span><input type="date" name="hasta" defaultValue={custom ? hasta : ""} className="h-10 rounded-xl border border-border bg-surface-raised px-3" /></label>
        <button type="submit" className="h-10 rounded-xl border border-border bg-background px-4 font-medium hover:bg-surface">Ver rango</button>
        <a href={exportHref} className="ml-auto h-10 content-center rounded-xl bg-foreground px-4 font-semibold text-background">Exportar CSV</a>
      </form>
      <p className="text-sm text-muted">Del {formatIsoDateLong(period.fromDate)} al {formatIsoDateLong(lastDay)}</p>

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Recibido (verificado)" value={formatDOP(f.receivedCents)} tone="bg-success-soft text-success" hint={plural(f.payments.length, "pago", "pagos") + " en el período"} />
        <Tile label="Ventas confirmadas" value={formatDOP(f.confirmedSalesCents)} tone="bg-info-soft text-info" hint={plural(f.confirmedCount, "pedido confirmado", "pedidos confirmados")} />
        <Tile label="Por verificar (hoy)" value={formatDOP(f.pendingVerificationCents)} tone="bg-warning-soft text-warning" hint={plural(f.pendingVerificationCount, "comprobante sin revisar", "comprobantes sin revisar")} />
        <Tile label="Saldos por cobrar (hoy)" value={formatDOP(f.receivableCents)} tone="bg-surface text-foreground" hint="Pedidos confirmados con saldo" />
      </section>

      {f.byBank.length > 0 && (
        <section className="rounded-2xl border border-border bg-background p-4">
          <h2 className="mb-2 font-semibold">Recibido por banco</h2>
          <ul className="space-y-1 text-sm">
            {f.byBank.map((b) => (
              <li key={b.bank} className="flex justify-between"><span>{b.bank}</span><span className="font-semibold tabular-nums">{formatDOP(b.cents)}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-background">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Pagos verificados</h2>
        {f.payments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No hay pagos verificados en este período.</p>
        ) : (
          <ul className="divide-y divide-border">
            {f.payments.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pedidos/${p.orderId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-surface">
                  <span className="font-mono font-semibold">{p.orderCode}</span>
                  <span className="min-w-0 flex-1 truncate">{p.customerName}</span>
                  <span className="text-xs text-muted">{p.bankName} · {when.format(new Date(p.verifiedAt))}</span>
                  <span className="font-semibold tabular-nums text-success">{formatDOP(p.verifiedCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Tile({ label, value, tone, hint }: { label: string; value: string; tone: string; hint: string }) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs opacity-80">{hint}</p>
    </div>
  );
}
