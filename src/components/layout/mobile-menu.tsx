"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { IconArrowRight, IconClose, IconGrid, IconHeadset, IconHome, IconMenu, IconPackage, IconTag, IconTools } from "@/components/ui/icons";
import { Logo } from "./logo";

const MAIN = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/productos", label: "Productos", Icon: IconGrid },
  { href: "/ofertas", label: "Ofertas", Icon: IconTag },
  { href: "/servicios", label: "Servicios", Icon: IconTools },
  { href: "/consultar-pedido", label: "Consultar pedido", Icon: IconPackage },
  { href: "/contacto", label: "Contacto", Icon: IconHeadset },
];

const SECONDARY = [
  { href: "/como-comprar", label: "Cómo comprar" },
  { href: "/condiciones", label: "Condiciones comerciales" },
  { href: "/privacidad", label: "Privacidad" },
];

const noop = () => () => {};

/**
 * Menú lateral en teléfonos. Se dibuja con un portal en <body>: el encabezado
 * usa backdrop-blur, que atraparía un elemento `fixed` dentro de su altura.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const trigger = openRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={openRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-controls="menu-movil"
        className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-surface"
      >
        <IconMenu className="size-6" />
      </button>

      {mounted && open && createPortal(<Drawer onClose={() => setOpen(false)} closeRef={closeRef} />, document.body)}
    </div>
  );
}

function Drawer({ onClose, closeRef }: { onClose: () => void; closeRef: React.RefObject<HTMLButtonElement | null> }) {
  // Solo se monta con el menú abierto, así la ruta no se lee al prerenderizar.
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
      <button type="button" aria-label="Cerrar menú" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-black/50 backdrop-blur-[2px]" />

      <nav
        id="menu-movil"
        className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm animate-[slide-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col overflow-y-auto bg-background shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <span onClick={onClose}><Logo className="h-10" /></span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-full hover:bg-surface">
            <IconClose className="size-6" />
          </button>
        </div>

        <ul className="space-y-1 p-3">
          {MAIN.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-medium transition-colors ${
                    active ? "bg-brand-soft text-brand" : "text-foreground hover:bg-surface"
                  }`}
                >
                  <span className={`grid size-9 place-items-center rounded-xl ${active ? "bg-brand text-brand-contrast" : "bg-surface text-muted"}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">{label}</span>
                  {active && <span className="size-2 rounded-full bg-brand" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-3 rounded-2xl border border-white/10 bg-[#111111] p-4 text-white">
          <p className="font-semibold">¿Tienes un trabajo especial?</p>
          <p className="mt-1 text-sm text-white/70">Banners, letreros, rotulación y más.</p>
          <Link href="/servicios" onClick={onClose} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast">
            Cotizar <IconArrowRight className="size-4" />
          </Link>
        </div>

        <ul className="mt-4 space-y-0.5 px-3">
          {SECONDARY.map((s) => (
            <li key={s.href}>
              <Link href={s.href} onClick={onClose} className="block rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-sm text-muted">Modo claro / oscuro</span>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}
