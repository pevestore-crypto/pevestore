"use client";

import { useEffect, useState } from "react";
import { countdownTo } from "@/lib/domain/promotions";

/**
 * Contador hasta una fecha real (la de la base de datos): recargar la página
 * no lo reinicia. Mientras no hay reloj del navegador muestra guiones.
 */
export function Countdown({ endsAt, onEnd, compact = false }: { endsAt: string; onEnd?: () => void; compact?: boolean }) {
  const [left, setLeft] = useState<ReturnType<typeof countdownTo> | null>(null);

  useEffect(() => {
    const tick = () => {
      const c = countdownTo(endsAt, new Date());
      setLeft(c);
      if (c.totalMs === 0) {
        clearInterval(id);
        onEnd?.();
      }
    };
    const id = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [endsAt, onEnd]);

  const pad = (n: number | undefined) => (n === undefined ? "--" : String(n).padStart(2, "0"));
  const parts = [
    { v: left?.days, l: "días" },
    { v: left?.hours, l: "horas" },
    { v: left?.minutes, l: "min" },
    { v: left?.seconds, l: "seg" },
  ];
  const label = left ? `Termina en ${left.days} días, ${left.hours} horas y ${left.minutes} minutos` : "Calculando tiempo restante";

  if (compact) {
    return (
      <span className="font-mono tabular-nums" aria-label={label}>
        {pad(left?.days)}d : {pad(left?.hours)}h : {pad(left?.minutes)}m : {pad(left?.seconds)}s
      </span>
    );
  }
  return (
    <div className="flex gap-2" role="timer" aria-label={label}>
      {parts.map((p) => (
        <div key={p.l} className="min-w-14 rounded-xl bg-background/90 px-2 py-1.5 text-center text-foreground">
          <div className="text-xl font-bold tabular-nums">{pad(p.v)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">{p.l}</div>
        </div>
      ))}
    </div>
  );
}
