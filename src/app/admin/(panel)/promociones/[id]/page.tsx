import type { Metadata } from "next";
import { Suspense } from "react";
import type { PromotionInput } from "@/lib/admin/promo-schema";
import { getPromotion, nowLocalDefaults, promotionTargets } from "@/lib/admin/promotions";
import { PromotionForm } from "../promotion-form";

export const metadata: Metadata = { title: "Oferta" };

export default function PromotionPage({ params }: PageProps<"/admin/promociones/[id]">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-background" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const targets = await promotionTargets();
  const isNew = id === "nueva";
  let initial: PromotionInput;
  if (isNew) {
    const { start, end } = nowLocalDefaults();
    initial = {
      id: "", name: "", target: "product", productId: "", categoryId: "", discountKind: "percent", percent: 15, fixedUnitPriceCents: 0,
      startsLocal: start, endsLocal: end, messageStyle: "fire", headline: "", body: "", ctaLabel: "", showCountdown: true, isActive: true,
    };
  } else {
    initial = await getPromotion(id);
  }
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{isNew ? "Nueva oferta" : initial.name}</h1>
      <PromotionForm key={initial.id || "nueva"} initial={initial} targets={targets} />
    </>
  );
}
