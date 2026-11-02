"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { PublicCategory } from "@/lib/catalog/public";

/**
 * Pestañas de categorías. En el celular se deslizan en horizontal sin barra,
 * con un difuminado en el borde que indica que hay más; la activa se centra.
 */
export function CategoryChips({ categories, active }: { categories: Pick<PublicCategory, "id" | "slug" | "name">[]; active: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[aria-current=page]");
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  const chip = (isActive: boolean) =>
    `inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
      isActive ? "border-brand bg-brand text-brand-contrast" : "border-border bg-surface-raised text-foreground hover:border-foreground/30"
    }`;

  return (
    <nav aria-label="Categorías" className="-mx-4 lg:mx-0">
      <ul
        ref={listRef}
        className="no-scrollbar flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-32px),transparent)] lg:flex-wrap lg:overflow-visible lg:px-0 lg:[mask-image:none]"
      >
        <li className="snap-start">
          <Link href="/productos" className={chip(active === null)} aria-current={active === null ? "page" : undefined}>Todos</Link>
        </li>
        {categories.map((c) => (
          <li key={c.id} className="snap-start">
            <Link href={`/productos/${c.slug}`} className={chip(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
