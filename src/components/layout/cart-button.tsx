"use client";

import Link from "next/link";
import { IconCart } from "@/components/ui/icons";
import { useCart } from "@/lib/cart/cart";

export function CartButton() {
  const count = useCart().length;
  return (
    <Link
      href="/pedido"
      aria-label={count ? `Ver mi pedido (${count} ${count === 1 ? "producto" : "productos"})` : "Ver mi pedido"}
      className="relative grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-surface"
    >
      <IconCart className="size-6" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold leading-5 text-brand-contrast">
          {count}
        </span>
      )}
    </Link>
  );
}
