import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { StatusPill, primaryButton } from "@/components/admin/form-ui";
import { catalogImageUrl, listProducts } from "@/lib/admin/catalog";
import { formatDOP } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Productos" };

const availabilityLabel: Record<string, string> = {
  available: "Disponible",
  on_request: "Bajo pedido",
  unavailable: "Agotado",
};

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Link href="/admin/productos/nuevo" className={primaryButton}>Nuevo producto</Link>
      </div>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <ProductList />
      </Suspense>
    </div>
  );
}

async function ProductList() {
  const products = await listProducts();
  if (products.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">
        Todavía no hay productos. Crea el primero con <strong>Nuevo producto</strong>.
      </p>
    );
  }
  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-surface sm:px-4">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
              {p.imagePath ? (
                <Image src={catalogImageUrl(p.imagePath)} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-[10px] text-muted">Sin foto</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="block truncate text-xs text-muted">
                {p.categoryName ?? "Sin categoría"} · {availabilityLabel[p.availability]}
                {p.isFeatured && " · Destacado"}
              </span>
            </span>
            <span className="hidden text-sm font-semibold tabular-nums sm:block">{formatDOP(p.basePriceCents)}</span>
            <StatusPill active={p.isActive} on="Publicado" off="Borrador" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
