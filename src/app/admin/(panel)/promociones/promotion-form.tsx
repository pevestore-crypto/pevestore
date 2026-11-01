"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PromoMessage } from "@/components/catalog/promo-message";
import { Card, Field, FormError, Toggle, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/admin/form-ui";
import { fieldErrors } from "@/lib/admin/catalog-schema";
import { type PromotionInput, promotionSchema } from "@/lib/admin/promo-schema";
import { centsToInput, formatDOP, parsePesos, percentOf } from "@/lib/domain/money";
import { MESSAGE_STYLES } from "@/lib/domain/promo-messages";
import { businessLocalToUtc } from "@/lib/domain/schedule";
import { deletePromotion, savePromotion } from "./actions";

interface Targets {
  products: { id: string; name: string; basePriceCents: number }[];
  categories: { id: string; name: string }[];
}

export function PromotionForm({ initial, targets }: { initial: PromotionInput; targets: Targets }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [fixedText, setFixedText] = useState(initial.fixedUnitPriceCents ? centsToInput(initial.fixedUnitPriceCents) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof PromotionInput>(k: K, v: PromotionInput[K]) => {
    setSaved(false);
    setP((prev) => ({ ...prev, [k]: v }));
  };

  const product = targets.products.find((x) => x.id === p.productId);
  const example =
    product && p.target === "product"
      ? p.discountKind === "percent"
        ? product.basePriceCents - percentOf(product.basePriceCents, Math.round(p.percent * 100))
        : parsePesos(fixedText)
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = { ...p, fixedUnitPriceCents: parsePesos(fixedText) ?? 0 };
    const local = promotionSchema.safeParse(value);
    if (!local.success) return setErrors(fieldErrors(local.error));
    start(async () => {
      const r = await savePromotion(value);
      if (!r.ok) return setErrors(r.errors);
      setErrors({});
      setSaved(true);
      if (!p.id) router.replace(`/admin/promociones/${r.id}`);
      router.refresh();
    });
  }

  const err = (k: string) => errors[k];
  let previewEnd = "";
  try {
    previewEnd = businessLocalToUtc(p.endsLocal).toISOString();
  } catch {
    previewEnd = "";
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormError message={err("_")} />
      <Card title="Oferta">
        <Field label="Nombre interno" htmlFor="name" error={err("name")} hint="Solo lo ves tú. Ej.: Navidad — tazas 15 %">
          <input id="name" className={inputClass} value={p.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="flex gap-2" role="radiogroup" aria-label="Aplica a">
          {(["product", "category"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={p.target === t} onClick={() => set("target", t)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${p.target === t ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
              {t === "product" ? "Un producto" : "Toda una categoría"}
            </button>
          ))}
        </div>
        {p.target === "product" ? (
          <Field label="Producto" htmlFor="productId" error={err("productId")}>
            <select id="productId" className={inputClass} value={p.productId} onChange={(e) => set("productId", e.target.value)}>
              <option value="">Elige…</option>
              {targets.products.map((x) => <option key={x.id} value={x.id}>{x.name} ({formatDOP(x.basePriceCents)})</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Categoría" htmlFor="categoryId" error={err("categoryId")}>
            <select id="categoryId" className={inputClass} value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Elige…</option>
              {targets.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de descuento" htmlFor="discountKind" error={err("discountKind")}>
            <select id="discountKind" className={inputClass} value={p.discountKind} onChange={(e) => set("discountKind", e.target.value as PromotionInput["discountKind"])}>
              <option value="percent">Porcentaje</option>
              <option value="fixed_unit_price" disabled={p.target !== "product"}>Precio fijo por unidad</option>
            </select>
          </Field>
          {p.discountKind === "percent" ? (
            <Field label="Descuento (%)" htmlFor="percent" error={err("percent")}>
              <input id="percent" type="number" min={1} max={90} step="0.5" inputMode="decimal" className={inputClass} value={p.percent} onChange={(e) => set("percent", Number(e.target.value))} />
            </Field>
          ) : (
            <Field label="Precio de oferta (RD$)" htmlFor="fixed" error={err("fixedUnitPriceCents")}>
              <input id="fixed" inputMode="decimal" className={inputClass} value={fixedText} onChange={(e) => { setSaved(false); setFixedText(e.target.value); }} />
            </Field>
          )}
        </div>
        {product && example !== null && (
          <p className="text-sm text-muted">
            Ejemplo: {product.name} pasa de <s>{formatDOP(product.basePriceCents)}</s> a <strong className="text-brand">{formatDOP(example)}</strong> por unidad.
            Los precios por cantidad siguen la regla de Configuración.
          </p>
        )}
      </Card>

      <Card title="Vigencia" description="Hora de República Dominicana. Al terminar, el precio vuelve solo al normal.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empieza" htmlFor="startsLocal" error={err("startsLocal")}>
            <input id="startsLocal" type="datetime-local" className={inputClass} value={p.startsLocal} onChange={(e) => set("startsLocal", e.target.value)} />
          </Field>
          <Field label="Termina" htmlFor="endsLocal" error={err("endsLocal")}>
            <input id="endsLocal" type="datetime-local" className={inputClass} value={p.endsLocal} onChange={(e) => set("endsLocal", e.target.value)} />
          </Field>
        </div>
        <Toggle id="isActive" label="Oferta activada" hint="Desactívala para pausarla sin borrarla" checked={p.isActive} onChange={(v) => set("isActive", v)} />
      </Card>

      <Card title="Mensaje en la tienda">
        <Field label="Estilo" htmlFor="messageStyle">
          <select id="messageStyle" className={inputClass} value={p.messageStyle} onChange={(e) => set("messageStyle", e.target.value as PromotionInput["messageStyle"])}>
            {Object.entries(MESSAGE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título (opcional)" htmlFor="headline" error={err("headline")} hint={`Por defecto: ${MESSAGE_STYLES[p.messageStyle].headline}`}>
            <input id="headline" className={inputClass} value={p.headline} onChange={(e) => set("headline", e.target.value)} />
          </Field>
          <Field label="Texto del botón (opcional)" htmlFor="ctaLabel" error={err("ctaLabel")} hint={`Por defecto: ${MESSAGE_STYLES[p.messageStyle].cta}`}>
            <input id="ctaLabel" className={inputClass} value={p.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
          </Field>
        </div>
        <Field label="Texto (opcional)" htmlFor="body" error={err("body")} hint="Puedes usar {fin} para la fecha de cierre.">
          <input id="body" className={inputClass} value={p.body} onChange={(e) => set("body", e.target.value)} placeholder={MESSAGE_STYLES[p.messageStyle].body} />
        </Field>
        <Toggle id="showCountdown" label="Mostrar contador regresivo" checked={p.showCountdown || p.messageStyle === "last_days"} onChange={(v) => set("showCountdown", v)} hint={p.messageStyle === "last_days" ? "Este estilo siempre lo muestra" : undefined} />
        {previewEnd && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Vista previa</p>
            <PromoMessage
              key={previewEnd + p.messageStyle + p.showCountdown}
              promo={{ messageStyle: p.messageStyle, headline: p.headline, body: p.body, ctaLabel: p.ctaLabel, showCountdown: p.showCountdown, endsAt: previewEnd }}
              href="#"
            />
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Guardando…" : "Guardar oferta"}</button>
        <Link href="/admin/promociones" className={secondaryButton}>Volver</Link>
        {saved && <span role="status" className="text-sm font-medium text-success">Guardado</span>}
        {p.id && (
          <button
            type="button"
            disabled={pending}
            className={`${dangerButton} ml-auto`}
            onClick={() => window.confirm("¿Eliminar esta oferta? Los pedidos ya hechos conservan su precio.") && start(async () => {
              const r = await deletePromotion(p.id);
              if (r.ok) { router.replace("/admin/promociones"); router.refresh(); } else setErrors(r.errors);
            })}
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
