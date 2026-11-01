import Link from "next/link";
import type { PublicCategory } from "@/lib/catalog/public";

export function CategoryChips({ categories, active }: { categories: PublicCategory[]; active: string | null }) {
  const chip = (isActive: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-brand text-brand-contrast" : "bg-surface text-foreground hover:bg-border"
    }`;
  return (
    <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <Link href="/productos" className={chip(active === null)} aria-current={active === null ? "page" : undefined}>Todos</Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/productos/${c.slug}`} className={chip(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
