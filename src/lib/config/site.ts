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
  url: siteUrl(),
} as const;

/**
 * Dirección pública del sitio. Prioridad: NEXT_PUBLIC_SITE_URL; si no está,
 * el dominio de producción que informa Vercel (cambia solo al conectar un
 * dominio propio); en local, localhost.
 */
function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

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
