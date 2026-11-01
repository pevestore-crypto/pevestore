import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getProductBySlug, getPublicSettings, publicImageUrl } from "@/lib/catalog/public";
import { site } from "@/lib/config/site";
import { formatDOP } from "@/lib/domain/money";
import { ProductConfigurator } from "./product-configurator";
import { ProductGallery } from "./product-gallery";

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };
  const description = product.seoDescription || product.shortDescription || `${product.name} personalizado en PEVESTORE. Desde ${formatDOP(product.fromPriceCents)}.`;
  const image = product.images[0] ? publicImageUrl(product.images[0].path) : undefined;
  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: { title: product.name, description, type: "website", images: image ? [{ url: image }] : undefined },
  };
}

export default function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 lg:px-6 lg:pt-8">
      <Suspense fallback={<ProductSkeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getPublicSettings()]);
  if (!product) notFound();
  // La vigencia de ofertas depende de la hora actual: se calcula en cada visita.
  await connection();
  const nowIso = new Date().toISOString();

  const images = product.images.map((i) => ({ url: publicImageUrl(i.path), alt: i.alt }));
  const productionDays = product.productionDays ?? settings.defaultProductionDays;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.shortDescription || undefined,
    image: images.map((i) => i.url),
    category: product.categoryName ?? undefined,
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "DOP",
      lowPrice: (product.fromPriceCents / 100).toFixed(2),
      highPrice: (product.basePriceCents / 100).toFixed(2),
      availability: product.availability === "unavailable" ? "https://schema.org/OutOfStock" : product.availability === "on_request" ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
      url: `${site.url}/producto/${product.slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Ruta" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/productos" className="hover:text-foreground">Productos</Link></li>
          {product.categorySlug && (
            <>
              <li aria-hidden>/</li>
              <li><Link href={`/productos/${product.categorySlug}`} className="hover:text-foreground">{product.categoryName}</Link></li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={images} name={product.name} />

        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{product.name}</h1>
          {product.shortDescription && <p className="mt-2 text-muted">{product.shortDescription}</p>}

          {product.tiers.length > 1 && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <caption className="bg-surface px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Precio por cantidad</caption>
                <tbody className="divide-y divide-border">
                  {product.tiers.map((t) => (
                    <tr key={t.minQty}>
                      <th scope="row" className="px-4 py-2 text-left font-normal">
                        {t.maxQty === null ? `${t.minQty} o más` : t.minQty === t.maxQty ? `${t.minQty}` : `${t.minQty} a ${t.maxQty}`}
                      </th>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatDOP(t.unitPriceCents)} c/u</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <ProductConfigurator product={product} policy={settings.policy} whatsappNumber={settings.whatsappNumber} nowIso={nowIso} />
          </div>

          <p className="mt-4 text-xs text-muted">
            Tiempo de producción: {productionDays === 0 ? "el mismo día hábil" : `${productionDays} ${productionDays === 1 ? "día hábil" : "días hábiles"}`} después de confirmar el pago.
          </p>

          {product.description && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Descripción</h2>
              <p className="mt-2 whitespace-pre-line text-muted">{product.description}</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-8 lg:grid-cols-2">
      <div className="aspect-square rounded-3xl bg-surface" />
      <div className="space-y-4">
        <div className="h-8 w-2/3 rounded-lg bg-surface" />
        <div className="h-4 w-1/2 rounded bg-surface" />
        <div className="h-48 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}
