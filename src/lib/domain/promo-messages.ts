/**
 * Estilos de mensaje promocional del encargo. El administrador elige el estilo
 * y puede reemplazar el título, el texto o el botón.
 */
export type MessageStyle = "fire" | "last_days" | "gift";

export const MESSAGE_STYLES: Record<MessageStyle, { label: string; headline: string; body: string; cta: string; emoji: string }> = {
  fire: {
    label: "🔥 ¡Aprovecha esta oferta!",
    emoji: "🔥",
    headline: "¡Aprovecha esta oferta!",
    body: "Promoción válida hasta el {fin}. ¡Haz tu pedido ahora!",
    cta: "¡Haz tu pedido!",
  },
  last_days: {
    label: "⏰ ¡Últimos días! (con contador)",
    emoji: "⏰",
    headline: "¡Últimos días!",
    body: "¡Aprovecha antes de que termine!",
    cta: "¡Aprovechar oferta!",
  },
  gift: {
    label: "🎁 Precios especiales por tiempo limitado",
    emoji: "🎁",
    headline: "¡Precios especiales por tiempo limitado!",
    body: "Personaliza tus regalos y asegura tu pedido hoy.",
    cta: "¡Aprovechar oferta!",
  },
};

export function promoText(style: MessageStyle, custom: { headline?: string | null; body?: string | null; cta?: string | null }, endLabel: string) {
  const s = MESSAGE_STYLES[style];
  return {
    emoji: s.emoji,
    headline: custom.headline || s.headline,
    body: (custom.body || s.body).replaceAll("{fin}", endLabel),
    cta: custom.cta || s.cta,
  };
}
