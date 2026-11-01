import Image from "next/image";
import Link from "next/link";
import { type ProductSummary, publicImageUrl } from "@/lib/catalog/public";
import { formatDOP } from "@/lib/domain/money";

export function ProductCard({ product, priority = false }: { product: ProductSummary; priority?: boolean }) {
  const hasVolumePrice = product.fromPriceCents < product.basePriceCents;
  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised transition-shadow hover:shadow-lg focus-visible:shadow-lg"
    >
      <div className="relative aspect-square bg-surface">
        {product.imagePath ? (
          <Image
            src={publicImageUrl(product.imagePath)}
            alt={product.imageAlt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 30vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid size-full place-items-center text-sm text-muted">Foto próximamente</span>
        )}
        {product.availability !== "available" && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
            {product.availability === "on_request" ? "Bajo pedido" : "Agotado"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold sm:text-base">{product.name}</h3>
        {product.shortDescription && <p className="line-clamp-2 text-xs text-muted sm:text-sm">{product.shortDescription}</p>}
        <p className="mt-auto pt-1 text-base font-bold text-brand sm:text-lg">
          {hasVolumePrice && <span className="mr-1 text-xs font-medium text-muted">Desde</span>}
          {formatDOP(product.fromPriceCents)}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductSummary[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id} className="flex">
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
