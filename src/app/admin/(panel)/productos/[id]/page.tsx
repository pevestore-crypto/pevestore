import type { Metadata } from "next";
import { Suspense } from "react";
import { catalogImageUrl, categoryOptions, getProduct } from "@/lib/admin/catalog";
import type { ProductInput } from "@/lib/admin/catalog-schema";
import { ProductForm } from "../product-form";
import { ProductImages } from "../product-images";

export const metadata: Metadata = { title: "Producto" };

const empty: ProductInput = {
  id: "",
  name: "",
  slug: "",
  categoryId: "",
  shortDescription: "",
  description: "",
  basePriceCents: 0,
  minQty: 1,
  maxQty: 1000,
  productionDays: "",
  allowsOwnDesign: true,
  allowsGallery: false,
  allowsIdea: true,
  availability: "available",
  isActive: false,
  isFeatured: false,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
  tiers: [],
  variants: [],
  surcharges: [],
};

export default function ProductPage({ params }: PageProps<"/admin/productos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-background" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "nuevo";
  const categories = await categoryOptions();
  const { product, images } = isNew ? { product: empty, images: [] } : await getProduct(id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{isNew ? "Nuevo producto" : product.name}</h1>
      {isNew ? (
        <p className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info">Podrás subir fotos después de crear el producto. Se guarda como borrador hasta que lo publiques.</p>
      ) : (
        <ProductImages
          productId={product.id}
          productName={product.name}
          initial={images.map((i) => ({ id: i.id, url: catalogImageUrl(i.path), alt: i.alt }))}
        />
      )}
      <ProductForm key={product.id || "nuevo"} initial={product} categories={categories} />
    </div>
  );
}
