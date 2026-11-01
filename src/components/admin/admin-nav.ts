/** Secciones del panel. `ready: false` se muestra como "pronto" y no enlaza. */
export const adminNav = [
  { href: "/admin", label: "Inicio", ready: true },
  { href: "/admin/pedidos", label: "Pedidos", ready: true },
  { href: "/admin/cotizaciones", label: "Cotizaciones", ready: true },
  { href: "/admin/productos", label: "Productos", ready: true },
  { href: "/admin/categorias", label: "Categorías", ready: true },
  { href: "/admin/galeria", label: "Galería de diseños", ready: true },
  { href: "/admin/promociones", label: "Promociones", ready: true },
  { href: "/admin/banners", label: "Banners", ready: true },
  { href: "/admin/clientes", label: "Clientes", ready: true },
  { href: "/admin/finanzas", label: "Finanzas", ready: true },
  { href: "/admin/configuracion", label: "Configuración", ready: true },
] as const;
