import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusPill, primaryButton } from "@/components/admin/form-ui";
import { listCategories } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Categorías" };

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Categorías</h1>
        <Link href="/admin/categorias/nueva" className={primaryButton}>Nueva categoría</Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <CategoryList />
      </Suspense>
    </div>
  );
}

async function CategoryList() {
  const categories = await listCategories();
  if (categories.length === 0) {
    return <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">Todavía no hay categorías.</p>;
  }
  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {categories.map((c) => (
        <li key={c.id}>
          <Link href={`/admin/categorias/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
            <span className="w-8 text-right text-xs tabular-nums text-muted">{c.sortOrder}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block truncate text-xs text-muted">/{c.slug} · {c.productCount} {c.productCount === 1 ? "producto" : "productos"}</span>
            </span>
            <StatusPill active={c.isActive} on="Visible" off="Oculta" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
