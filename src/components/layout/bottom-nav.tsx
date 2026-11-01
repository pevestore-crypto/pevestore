"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconGrid, IconHeadset, IconHome, IconTag, IconTools } from "@/components/ui/icons";

const items = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/productos", label: "Productos", Icon: IconGrid },
  { href: "/ofertas", label: "Ofertas", Icon: IconTag },
  { href: "/servicios", label: "Servicios", Icon: IconTools },
  { href: "/contacto", label: "Contacto", Icon: IconHeadset },
];

/** Barra inferior en teléfonos: la navegación queda al alcance del pulgar. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand" : "text-muted"}`}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
