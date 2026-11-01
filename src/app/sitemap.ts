import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/catalog/public";
import { site } from "@/lib/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const url = (path: string) => `${site.url}${path}`;
  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/productos"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/servicios"), changeFrequency: "monthly", priority: 0.6 },
    ...categories.map((c) => ({ url: url(`/productos/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: url(`/producto/${p.slug}`), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
