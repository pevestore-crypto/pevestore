"use client";

import { useEffect, useState } from "react";
import { formatDOP } from "@/lib/domain/money";

export interface PromoPrice {
  cents: number;
  startsAt: string;
  endsAt: string;
}

/**
 * Precio de la tarjeta. La oferta se muestra solo mientras esté vigente según
 * el reloj real: una página guardada en caché nunca muestra una oferta vencida.
 */
export function PriceTag({ fromCents, baseCents, showFrom, promo }: { fromCents: number; baseCents: number; showFrom: boolean; promo: PromoPrice | null }) {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!promo) return;
    const check = () => {
      const t = Date.now();
      setRunning(t >= new Date(promo.startsAt).getTime() && t < new Date(promo.endsAt).getTime());
    };
    const first = setTimeout(check, 0);
    const id = setInterval(check, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [promo]);

  if (promo && running) {
    const off = Math.round((1 - promo.cents / baseCents) * 100);
    return (
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-bold text-brand sm:text-lg">{formatDOP(promo.cents)}</span>
        <s className="text-xs text-muted">{formatDOP(baseCents)}</s>
        {off > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-contrast">−{off}%</span>}
      </span>
    );
  }
  return (
    <span className="text-base font-bold text-brand sm:text-lg">
      {showFrom && <span className="mr-1 text-xs font-medium text-muted">Desde</span>}
      {formatDOP(fromCents)}
    </span>
  );
}
