/**
 * Períodos para reportes, en días de calendario de República Dominicana.
 * `to` es exclusivo: el período incluye hasta el final del día anterior a `to`.
 */
import { type IsoDate, addDays, businessDate, businessDateTimeToUtc, isIsoDate } from "./schedule";

export type PeriodPreset = "mes" | "mes-anterior" | "30d" | "anio";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  "30d": "Últimos 30 días",
  anio: "Este año",
};

export interface Period {
  fromDate: IsoDate;
  toDate: IsoDate; // exclusivo
  fromUtc: Date;
  toUtc: Date;
}

function make(fromDate: IsoDate, toDate: IsoDate): Period {
  return { fromDate, toDate, fromUtc: businessDateTimeToUtc(fromDate), toUtc: businessDateTimeToUtc(toDate) };
}

export function presetPeriod(preset: PeriodPreset, now: Date): Period {
  const today = businessDate(now);
  const [y, m] = today.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const tomorrow = addDays(today, 1);
  switch (preset) {
    case "mes":
      return make(firstOfMonth, tomorrow);
    case "mes-anterior": {
      const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
      return make(prev, firstOfMonth);
    }
    case "30d":
      return make(addDays(today, -29), tomorrow);
    case "anio":
      return make(`${y}-01-01`, tomorrow);
  }
}

/** Rango propio "desde"–"hasta" (ambos inclusive). Devuelve null si es inválido o demasiado largo. */
export function customPeriod(from: string, to: string): Period | null {
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) return null;
  const end = addDays(to, 1);
  const p = make(from, end);
  return p.toUtc.getTime() - p.fromUtc.getTime() > 1000 * 86400 * 800 ? null : p;
}
