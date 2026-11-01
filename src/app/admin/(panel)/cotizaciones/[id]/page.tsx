import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconWhatsApp } from "@/components/ui/icons";
import { QUOTE_STATUS, getQuote } from "@/lib/admin/quotes";
import { BUSINESS_TZ, formatIsoDateLong } from "@/lib/domain/schedule";
import { whatsappLink } from "@/lib/domain/whatsapp";
import { QuoteEditor } from "../quote-editor";

export const metadata: Metadata = { title: "Cotización" };
const when = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ });

export default function QuoteDetailPage({ params }: PageProps<"/admin/cotizaciones/[id]">) {
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
  const q = await getQuote(id);
  const rows: [string, string | null][] = [
    ["Servicio", q.serviceName],
    ["Medidas", q.measurements],
    ["Cantidad", q.quantity ? String(q.quantity) : null],
    ["Material", q.material],
    ["Fecha requerida", q.requiredDate ? formatIsoDateLong(q.requiredDate) : null],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/cotizaciones" className="text-sm text-muted hover:text-foreground">← Cotizaciones</Link>
        <h1 className="font-mono text-2xl font-bold">{q.code}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${QUOTE_STATUS[q.status].tone}`}>{QUOTE_STATUS[q.status].label}</span>
        <span className="text-sm text-muted">{when.format(new Date(q.createdAt))}</span>
      </div>

      <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-4 whitespace-pre-line rounded-xl bg-surface px-3 py-2 text-sm">{q.description}</p>
        {q.files.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {q.files.map((f) => (
              <li key={f.id}>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
                    <span className="max-w-48 truncate">{f.name}</span>
                    <span className="text-muted">({Math.max(1, Math.round(f.sizeBytes / 1024))} KB)</span>
                  </a>
                ) : (
                  <span className="text-xs text-danger">Sin enlace: {f.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Los enlaces de archivos caducan en 10 minutos; recarga la página para generar nuevos.</p>
      </section>

      <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
        <h2 className="font-semibold">{q.customerName}</h2>
        <p className="text-sm text-muted">+{q.whatsapp}</p>
        <a
          href={whatsappLink(q.whatsapp, `Hola ${q.customerName.split(" ")[0]}, te escribimos de PEVESTORE sobre tu solicitud ${q.code} (${q.serviceName}).`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-95"
        >
          <IconWhatsApp className="size-4" /> Responder por WhatsApp
        </a>
      </section>

      <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Seguimiento</h2>
        <QuoteEditor id={q.id} status={q.status} adminNote={q.adminNote} />
      </section>
    </div>
  );
}
