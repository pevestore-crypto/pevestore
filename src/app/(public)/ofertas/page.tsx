import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GridSkeleton } from "@/components/catalog/grid-skeleton";
import { ProductGrid } from "@/components/catalog/product-card";
import { PromoMessage } from "@/components/catalog/promo-message";
import { getActivePromotions, getProducts } from "@/lib/catalog/public";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Ofertas y precios especiales en productos personalizados de PEVESTORE por tiempo limitado.",
  alternates: { canonical: "/ofertas" },
};

export default function OffersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6 lg:pt-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Ofertas</h1>
      <Suspense fallback={<GridSkeleton />}>
        <Offers />
      </Suspense>
    </div>
  );
}

async function Offers() {
  const [promotions, products] = await Promise.all([getActivePromotions(), getProducts()]);
  // Solo las vigentes en este momento.
  await connection();
  const now = new Date();
  const running = promotions.filter((p) => new Date(p.startsAt) <= now && now < new Date(p.endsAt));
  const groups = running
    .map((p) => ({ promo: p, items: products.filter((x) => x.id === p.productId || (p.categoryId !== null && x.categoryId === p.categoryId)) }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface px-5 py-12 text-center">
        <p className="font-semibold">No hay ofertas activas en este momento</p>
        <p className="mt-1 text-sm text-muted">Vuelve pronto o mira todo el catálogo.</p>
        <Link href="/productos" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover">Ver productos</Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-10">
      {groups.map(({ promo, items }) => (
        <section key={promo.id} aria-label={promo.name} className="space-y-4">
          <PromoMessage promo={promo} />
          <ProductGrid products={items} promotions={running} />
        </section>
      ))}
    </div>
  );
}
