"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { publicNav } from "@/lib/config/site";
import { IconClose, IconMenu } from "@/components/ui/icons";

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-controls="menu-movil"
        className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-surface"
      >
        <IconMenu className="size-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <nav id="menu-movil" aria-label="Menú" className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted">Menú</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-full hover:bg-surface">
                <IconClose className="size-6" />
              </button>
            </div>
            <MenuLinks onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </div>
  );
}

/** Solo se monta con el menú abierto, así la ruta no se lee al prerenderizar. */
function MenuLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {publicNav.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`block rounded-xl px-4 py-3 text-base font-medium ${active ? "bg-brand-soft text-brand" : "hover:bg-surface"}`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
