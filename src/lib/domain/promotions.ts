/**
 * Vigencia de promociones. Las fechas son instantes absolutos (timestamptz en
 * la base de datos); la zona America/Santo_Domingo solo se usa al capturarlas
 * y mostrarlas. Así el contador no se reinicia al recargar la página.
 */
export interface PromotionWindow {
  isActive: boolean;
  startsAt: string | Date;
  endsAt: string | Date;
}

export function isPromotionActive(promo: PromotionWindow, now: Date): boolean {
  if (!promo.isActive) return false;
  const start = new Date(promo.startsAt).getTime();
  const end = new Date(promo.endsAt).getTime();
  const t = now.getTime();
  return t >= start && t < end;
}

export type PromotionPhase = "disabled" | "scheduled" | "running" | "ended";

export function promotionPhase(promo: PromotionWindow, now: Date): PromotionPhase {
  if (!promo.isActive) return "disabled";
  const t = now.getTime();
  if (t < new Date(promo.startsAt).getTime()) return "scheduled";
  if (t >= new Date(promo.endsAt).getTime()) return "ended";
  return "running";
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function countdownTo(end: string | Date, now: Date): Countdown {
  const totalMs = Math.max(0, new Date(end).getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}
