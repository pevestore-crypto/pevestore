import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryChips } from "@/components/catalog/category-chips";
import { GridSkeleton } from "@/components/catalog/grid-skeleton";
import { ProductGrid } from "@/components/catalog/product-card";
import { getCategories, getProducts, normalizeSearch } from "@/lib/catalog/public";

export const metadata: Metadata = {
  title: "Productos personalizados",
  description: "Tazas, termos, vasos, camisetas, mesas de dominó y regalos personalizados. Precios por cantidad y diseño a tu gusto.",
  alternates: { canonical: "/productos" },
};

export default function ProductsPage({ searchParams }: PageProps<"/productos">) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6 lg:pt-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Productos</h1>
      <Suspense fallback={<GridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const term = normalizeSearch(q);
  const results = term
    ? products.filter((p) => normalizeSearch(`${p.name} ${p.shortDescription ?? ""} ${p.categoryName ?? ""}`).includes(term))
    : products;

  return (
    <>
      <div className="mt-4">
        <CategoryChips categories={categories} active={null} />
      </div>
      {q && (
        <p className="mt-4 text-sm text-muted" role="status">
          {results.length} {results.length === 1 ? "resultado" : "resultados"} para “{q}”
        </p>
      )}
      <div className="mt-5">
        {results.length ? (
          <ProductGrid products={results} priorityCount={4} />
        ) : (
          <EmptyResults query={q} />
        )}
      </div>
    </>
  );
}

function EmptyResults({ query }: { query: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-12 text-center text-sm text-muted">
      {query ? "No encontramos productos con esa búsqueda. Prueba con otra palabra o revisa las categorías." : "Estamos preparando el catálogo. Vuelve pronto."}
    </p>
  );
}
