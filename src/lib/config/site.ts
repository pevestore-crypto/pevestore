/**
 * Datos fijos de la marca y del sitio.
 * Los datos de negocio que cambian (WhatsApp, bancos, horarios, tiempos de
 * producción) NO van aquí: se guardan en la tabla `settings` y se editan desde
 * el panel administrativo.
 */
export const site = {
  name: "PEVESTORE",
  tagline: "Impresión, personalización, rotulación y publicidad",
  description:
    "Productos personalizados, impresión, rotulación y publicidad en República Dominicana. Tazas, termos, camisetas, mesas de dominó y más.",
  locale: "es-DO",
  currency: "DOP",
  timeZone: "America/Santo_Domingo",
  orderPrefix: "PEV",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/** Firma del desarrollador (pie de página y metadatos). */
export const developer = {
  name: "Sebastián González Rodríguez",
  url: "https://portafoliosgr.com",
} as const;

export const publicNav = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/servicios", label: "Servicios" },
  { href: "/consultar-pedido", label: "Consultar pedido" },
  { href: "/contacto", label: "Contacto" },
] as const;
