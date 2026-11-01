import { getFinance } from "@/lib/admin/finance";
import { customPeriod } from "@/lib/domain/periods";
import { BUSINESS_TZ } from "@/lib/domain/schedule";

const when = new Intl.DateTimeFormat("es-DO", { dateStyle: "short", timeStyle: "short", timeZone: BUSINESS_TZ });

/** Celda CSV segura: comillas escapadas y sin fórmulas que Excel ejecute. */
function cell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Pagos verificados del rango en CSV (abre directo en Excel). getFinance exige sesión de administrador. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = customPeriod(url.searchParams.get("desde") ?? "", url.searchParams.get("hasta") ?? "");
  if (!period) return new Response("Rango de fechas inválido.", { status: 400 });

  const f = await getFinance(period);
  const rows = [
    ["Fecha verificación", "Pedido", "Cliente", "Banco", "Monto (RD$)", "Nota"],
    ...f.payments.map((p) => [when.format(new Date(p.verifiedAt)), p.orderCode, p.customerName, p.bankName, (p.verifiedCents / 100).toFixed(2), p.note ?? ""]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const last = url.searchParams.get("hasta");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pevestore-pagos-${period.fromDate}_${last}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
