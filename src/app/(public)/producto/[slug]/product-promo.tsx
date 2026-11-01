"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { PromoMessage, type PromoMessageData } from "@/components/catalog/promo-message";

/** Al terminar la oferta recarga los datos: el precio vuelve solo al normal. */
export function ProductPromo({ promo }: { promo: PromoMessageData }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return <PromoMessage promo={promo} onEnded={refresh} />;
}
