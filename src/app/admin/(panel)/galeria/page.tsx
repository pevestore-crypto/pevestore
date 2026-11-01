import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DesignEditor, NewDesign } from "./design-editor";

export const metadata: Metadata = { title: "Galería de diseños" };

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Galería de diseños</h1>
      <p className="mt-1 text-sm text-muted">Diseños listos que el cliente puede elegir con la opción “Quiero elegir un diseño”. Solo se ofrece en los productos que marques y que tengan esa opción activada.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <Gallery />
      </Suspense>
    </div>
  );
}

async function Gallery() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [designs, products] = await Promise.all([
    supabase.from("designs").select("id, title, storage_path, is_active, sort_order, design_products(product_id)").order("sort_order").order("title"),
    supabase.from("products").select("id, name").order("name"),
  ]);
  const productList = products.data ?? [];
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl border border-border bg-background p-4">
        <h2 className="mb-3 font-semibold">Nuevo diseño</h2>
        <NewDesign products={productList} />
      </section>
      <ul className="grid gap-4 sm:grid-cols-2">
        {(designs.data ?? []).map((d) => (
          <li key={d.id} className="rounded-2xl border border-border bg-background p-4">
            <DesignEditor
              initial={{
                id: d.id,
                path: d.storage_path,
                title: d.title,
                isActive: d.is_active,
                sortOrder: d.sort_order,
                productIds: (d.design_products as { product_id: string }[]).map((x) => x.product_id),
              }}
              products={productList}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
