import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryChips } from "@/components/catalog/category-chips";
import { ProductGrid } from "@/components/catalog/product-card";
import { GridSkeleton } from "@/components/catalog/grid-skeleton";
import { getCategories, getProducts } from "@/lib/catalog/public";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ categoria: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/productos/[categoria]">): Promise<Metadata> {
  const { categoria } = await params;
  const category = (await getCategories()).find((c) => c.slug === categoria);
  if (!category) return {};
  return {
    title: category.seoTitle || category.name,
    description: category.seoDescription || category.description || `${category.name} personalizados en PEVESTORE.`,
    alternates: { canonical: `/productos/${category.slug}` },
  };
}

export default function CategoryPage({ params }: PageProps<"/productos/[categoria]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-6 lg:pt-10">
      <Suspense fallback={<GridSkeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const category = categories.find((c) => c.slug === categoria);
  if (!category) notFound();
  const items = products.filter((p) => p.categorySlug === category.slug);

  return (
    <>
      <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>
      {category.description && <p className="mt-1 max-w-2xl text-muted">{category.description}</p>}
      <div className="mt-4">
        <CategoryChips categories={categories} active={category.slug} />
      </div>
      <div className="mt-5">
        {items.length ? (
          <ProductGrid products={items} priorityCount={4} />
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-12 text-center text-sm text-muted">
            Pronto tendremos productos en esta categoría.
          </p>
        )}
      </div>
    </>
  );
}
