/**
 * Calendario de producción en America/Santo_Domingo.
 * Las fechas de calendario se manejan como texto "YYYY-MM-DD" para no
 * depender de la zona horaria del servidor ni del navegador.
 */
export const BUSINESS_TZ = "America/Santo_Domingo";

export type IsoDate = string; // "YYYY-MM-DD"

export interface WorkCalendar {
  /** Días de la semana sin producción: 0 = domingo … 6 = sábado. */
  nonWorkingWeekdays: number[];
  /** Feriados y fechas no disponibles. */
  blockedDates: IsoDate[];
  /** Hora local (0-23) a partir de la cual un pedido cuenta desde el día siguiente. */
  cutoffHour?: number;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Fecha de calendario local del negocio para un instante. */
export function businessDate(instant: Date): IsoDate {
  const p = zonedParts(instant, BUSINESS_TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function businessHour(instant: Date): number {
  return zonedParts(instant, BUSINESS_TZ).hour;
}

/**
 * Convierte una fecha y hora locales del negocio a un instante UTC.
 * Se usa cuando el administrador programa "hasta el 20/12 a las 23:59".
 */
export function businessDateTimeToUtc(date: IsoDate, time = "00:00"): Date {
  if (!isIsoDate(date) || !/^\d{2}:\d{2}$/.test(time)) throw new RangeError(`Fecha u hora inválida: ${date} ${time}`);
  const guess = new Date(`${date}T${time}:00Z`);
  const p = zonedParts(guess, BUSINESS_TZ);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

/** Instante UTC → "YYYY-MM-DDTHH:mm" en hora del negocio (para <input type="datetime-local">). */
export function utcToBusinessLocal(instant: string | Date): string {
  const p = zonedParts(new Date(instant), BUSINESS_TZ);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" en hora del negocio → instante UTC. */
export function businessLocalToUtc(local: string): Date {
  const [date, time] = local.split("T");
  return businessDateTimeToUtc(date, (time ?? "00:00").slice(0, 5));
}

const longDateTime = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TZ });
const longDay = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", timeZone: BUSINESS_TZ });

/** "20 de diciembre" (o con hora si no termina a medianoche/23:59). */
export function formatPromoEnd(instant: string | Date): string {
  const local = utcToBusinessLocal(instant);
  const time = local.slice(11);
  return time === "23:59" || time === "00:00" ? longDay.format(new Date(instant)) : longDateTime.format(new Date(instant));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: IsoDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isWorkingDay(date: IsoDate, cal: WorkCalendar): boolean {
  return !cal.nonWorkingWeekdays.includes(weekday(date)) && !cal.blockedDates.includes(date);
}

/**
 * Primera fecha de entrega posible: se necesitan `productionDays` días
 * laborables completos después del día en que entra el pedido, y la entrega
 * misma debe caer en día laborable.
 */
export function earliestDeliveryDate(now: Date, productionDays: number, cal: WorkCalendar): IsoDate {
  if (!Number.isInteger(productionDays) || productionDays < 0) throw new RangeError("Días de producción inválidos");
  if (cal.nonWorkingWeekdays.length >= 7) throw new RangeError("El calendario no tiene días laborables");

  let day = businessDate(now);
  if (cal.cutoffHour !== undefined && businessHour(now) >= cal.cutoffHour) day = addDays(day, 1);

  let remaining = productionDays;
  let guard = 0;
  while (remaining > 0 || !isWorkingDay(day, cal)) {
    day = addDays(day, 1);
    if (isWorkingDay(day, cal)) remaining--;
    if (++guard > 730) throw new RangeError("No hay fechas disponibles en los próximos dos años");
  }
  return day;
}

export type DateCheck = { ok: true } | { ok: false; reason: string; earliest: IsoDate };

export function checkRequestedDate(requested: string, now: Date, productionDays: number, cal: WorkCalendar): DateCheck {
  const earliest = earliestDeliveryDate(now, productionDays, cal);
  if (!isIsoDate(requested)) return { ok: false, reason: "La fecha no es válida.", earliest };
  if (requested < earliest) return { ok: false, reason: "No alcanzamos a producirlo para esa fecha.", earliest };
  if (!isWorkingDay(requested, cal)) return { ok: false, reason: "Ese día no hay entregas.", earliest };
  return { ok: true };
}

const longDate = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-12-18" → "18 de diciembre de 2026". */
export function formatIsoDateLong(date: IsoDate): string {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}
