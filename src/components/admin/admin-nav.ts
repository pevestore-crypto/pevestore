/** Secciones del panel. `ready: false` se muestra como "pronto" y no enlaza. */
export const adminNav = [
  { href: "/admin", label: "Inicio", ready: true },
  { href: "/admin/pedidos", label: "Pedidos", ready: false },
  { href: "/admin/productos", label: "Productos", ready: true },
  { href: "/admin/categorias", label: "Categorías", ready: true },
  { href: "/admin/promociones", label: "Promociones", ready: false },
  { href: "/admin/banners", label: "Banners", ready: false },
  { href: "/admin/clientes", label: "Clientes", ready: false },
  { href: "/admin/finanzas", label: "Finanzas", ready: false },
  { href: "/admin/configuracion", label: "Configuración", ready: false },
] as const;
