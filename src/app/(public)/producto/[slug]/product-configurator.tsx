"use client";

import { useMemo, useState } from "react";
import { IconWhatsApp } from "@/components/ui/icons";
import type { ProductDetail } from "@/lib/catalog/public";
import { formatDOP } from "@/lib/domain/money";
import { type PricingPolicy, PricingError, calculatePrice } from "@/lib/domain/pricing";
import { whatsappLink } from "@/lib/domain/whatsapp";

type Mode = "own_design" | "gallery" | "idea";

const MODE_LABEL: Record<Mode, { title: string; text: string }> = {
  own_design: { title: "Tengo mi diseño", text: "Subirás tu archivo (JPG, PNG o PDF)." },
  gallery: { title: "Quiero elegir un diseño", text: "Elegirás uno de nuestra galería." },
  idea: { title: "Tengo una idea", text: "Nos la describes y la preparamos." },
};

export function ProductConfigurator({
  product,
  policy,
  whatsappNumber,
  nowIso,
}: {
  product: ProductDetail;
  policy: PricingPolicy;
  whatsappNumber: string | null;
  nowIso: string;
}) {
  const modes = (["own_design", "gallery", "idea"] as Mode[]).filter(
    (m) => ({ own_design: product.allowsOwnDesign, gallery: product.allowsGallery, idea: product.allowsIdea })[m],
  );
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [qtyText, setQtyText] = useState(String(product.minQty));
  const [mode, setMode] = useState<Mode | null>(modes[0] ?? null);

  const qty = Number(qtyText);
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const surcharges = product.surcharges.filter((s) => s.customizationMode === null || s.customizationMode === mode);

  const quote = useMemo(() => {
    try {
      return calculatePrice({
        product: { id: product.id, name: product.name, basePriceCents: product.basePriceCents, tiers: product.tiers, minQty: product.minQty, maxQty: product.maxQty },
        quantity: qty,
        variant,
        surcharges,
        policy,
        now: new Date(nowIso),
      });
    } catch (e) {
      return e instanceof PricingError ? e.message : "No se pudo calcular el precio.";
    }
  }, [product, qty, variant, surcharges, policy, nowIso]);

  const step = (delta: number) => setQtyText(String(Math.min(product.maxQty, Math.max(product.minQty, (Number.isInteger(qty) ? qty : product.minQty) + delta))));
  const unavailable = product.availability === "unavailable";

  const waText =
    typeof quote === "string"
      ? ""
      : [
          `Hola PEVESTORE, me interesa: ${product.name}${variant ? ` (${variant.name})` : ""}`,
          `Cantidad: ${quote.quantity}`,
          mode ? `Personalización: ${MODE_LABEL[mode].title}` : null,
          `Total estimado: ${formatDOP(quote.totalCents)}`,
        ]
          .filter(Boolean)
          .join("\n");

  return (
    <div className="space-y-5">
      {product.variants.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Modelo</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <label key={v.id} className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${v.id === variantId ? "border-brand bg-brand-soft text-brand" : "border-border hover:border-foreground/40"}`}>
                <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} className="sr-only" />
                {v.name}
                {v.priceDeltaCents > 0 && <span className="ml-1 text-xs text-muted">+{formatDOP(v.priceDeltaCents)}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {modes.length > 0 && (
        <fieldset className="rounded-2xl bg-surface p-4">
          <legend className="sr-only">Personalización</legend>
          <p className="mb-3 text-sm font-semibold">Personalización</p>
          <div className="space-y-2">
            {modes.map((m) => (
              <label key={m} className="flex cursor-pointer items-start gap-3">
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1 size-4 accent-[var(--brand)]" />
                <span>
                  <span className="block text-sm font-medium">{MODE_LABEL[m].title}</span>
                  <span className="block text-xs text-muted">{MODE_LABEL[m].text}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">El diseño final lo revisa o prepara PEVESTORE antes de producir.</p>
        </fieldset>
      )}

      <div>
        <label htmlFor="qty" className="mb-2 block text-sm font-semibold">Cantidad</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label="Restar uno" className="grid size-11 place-items-center rounded-xl border border-border text-xl hover:bg-surface">−</button>
          <input
            id="qty"
            inputMode="numeric"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 w-20 rounded-xl border border-border bg-surface-raised text-center text-base font-semibold outline-none focus:border-brand"
          />
          <button type="button" onClick={() => step(1)} aria-label="Sumar uno" className="grid size-11 place-items-center rounded-xl border border-border text-xl hover:bg-surface">+</button>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-4" aria-live="polite">
        {typeof quote === "string" ? (
          <p className="text-sm font-medium text-danger">{quote}</p>
        ) : (
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Precio por unidad</dt><dd className="font-medium tabular-nums">{formatDOP(quote.unitCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Cantidad</dt><dd className="tabular-nums">{quote.quantity}</dd></div>
            {quote.surcharges.map((s) => (
              <div key={s.id} className="flex justify-between"><dt className="text-muted">{s.label}</dt><dd className="tabular-nums">{formatDOP(s.totalCents)}</dd></div>
            ))}
            {quote.discountCents > 0 && (
              <div className="flex justify-between text-success"><dt>Descuento por cantidad</dt><dd className="tabular-nums">−{formatDOP(quote.discountCents)}</dd></div>
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <dt className="font-semibold">Total</dt>
              <dd className="text-2xl font-bold text-brand tabular-nums">{formatDOP(quote.totalCents)}</dd>
            </div>
          </dl>
        )}
      </div>

      {unavailable ? (
        <p className="rounded-xl bg-surface px-4 py-3 text-center text-sm font-medium">Agotado por el momento</p>
      ) : (
        <div className="space-y-2">
          <button type="button" disabled className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-contrast opacity-60">
            Pedidos en línea muy pronto
          </button>
          {whatsappNumber && waText && (
            <a
              href={whatsappLink(whatsappNumber, waText)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold hover:bg-surface"
            >
              <IconWhatsApp className="size-5 text-[#25D366]" /> Consultar por WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
