"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { type MessageStyle, promoText } from "@/lib/domain/promo-messages";
import { formatPromoEnd } from "@/lib/domain/schedule";
import { Countdown } from "./countdown";

export interface PromoMessageData {
  messageStyle: MessageStyle;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  showCountdown: boolean;
  endsAt: string;
}

/** Mensaje promocional con los tres estilos del encargo. Se oculta solo al vencer. */
export function PromoMessage({ promo, href, onEnded }: { promo: PromoMessageData; href?: string; onEnded?: () => void }) {
  const [ended, setEnded] = useState(false);
  const onEnd = useCallback(() => {
    setEnded(true);
    onEnded?.();
  }, [onEnded]);
  if (ended) return null;

  const t = promoText(promo.messageStyle, { headline: promo.headline, body: promo.body, cta: promo.ctaLabel }, formatPromoEnd(promo.endsAt));
  const withCountdown = promo.showCountdown || promo.messageStyle === "last_days";

  return (
    <div className="space-y-3 rounded-2xl bg-gradient-to-br from-brand to-[#9e0410] p-4 text-white">
      <p className="text-lg font-bold">
        <span aria-hidden>{t.emoji} </span>
        {t.headline}
      </p>
      {promo.messageStyle === "last_days" && <p className="text-sm text-white/90">Esta promoción termina en:</p>}
      {withCountdown && <Countdown endsAt={promo.endsAt} onEnd={onEnd} />}
      <p className="text-sm text-white/90">{t.body}</p>
      {href && (
        <Link href={href} className="inline-block rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-contrast hover:brightness-95">
          {t.cta}
        </Link>
      )}
    </div>
  );
}
