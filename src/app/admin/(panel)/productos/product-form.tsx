"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Card, Field, FormError, Toggle, dangerButton, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/admin/form-ui";
import { type ProductInput, fieldErrors, productSchema } from "@/lib/admin/catalog-schema";
import { centsToInput, formatDOP, parsePesos } from "@/lib/domain/money";
import { PricingError, calculatePrice } from "@/lib/domain/pricing";
import { slugify } from "@/lib/domain/slug";
import { deleteProduct, saveProduct } from "./actions";

/** Estado del formulario: los importes se editan como texto ("1,500.50"). */
interface Draft extends Omit<ProductInput, "basePriceCents" | "tiers" | "variants" | "surcharges" | "productionDays"> {
  basePrice: string;
  productionDays: string;
  tiers: { minQty: string; maxQty: string; price: string }[];
  variants: { id: string; name: string; sku: string; delta: string; isActive: boolean }[];
  surcharges: { label: string; amount: string; per: "unit" | "order"; customizationMode: ProductInput["surcharges"][number]["customizationMode"]; isActive: boolean }[];
}

function toDraft(p: ProductInput): Draft {
  return {
    ...p,
    basePrice: p.basePriceCents ? centsToInput(p.basePriceCents) : "",
    productionDays: p.productionDays === "" ? "" : String(p.productionDays),
    tiers: p.tiers.map((t) => ({ minQty: String(t.minQty), maxQty: t.maxQty === null ? "" : String(t.maxQty), price: centsToInput(t.unitPriceCents) })),
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, delta: centsToInput(v.priceDeltaCents), isActive: v.isActive })),
    surcharges: p.surcharges.map((s) => ({ label: s.label, amount: centsToInput(s.amountCents), per: s.per, customizationMode: s.customizationMode, isActive: s.isActive })),
  };
}

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Convierte el borrador al formato validado; los textos inválidos se vuelven errores por campo. */
function fromDraft(d: Draft): { value: ProductInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const money = (s: string, key: string, allowZero = false) => {
    const c = parsePesos(s || (allowZero ? "0" : ""));
    if (c === null) errors[key] = "Importe inválido. Ejemplo: 350 o 1,500.50";
    return c ?? 0;
  };
  const value: ProductInput = {
    ...d,
    basePriceCents: money(d.basePrice, "basePriceCents"),
    productionDays: d.productionDays.trim() === "" ? "" : int(d.productionDays),
    tiers: d.tiers.map((t, i) => ({
      minQty: int(t.minQty),
      maxQty: t.maxQty.trim() === "" ? null : int(t.maxQty),
      unitPriceCents: money(t.price, `tiers.${i}.unitPriceCents`),
    })),
    variants: d.variants.map((v, i) => ({ id: v.id, name: v.name, sku: v.sku, priceDeltaCents: money(v.delta, `variants.${i}.priceDeltaCents`, true), isActive: v.isActive, sortOrder: i })),
    surcharges: d.surcharges.map((s, i) => ({ label: s.label, amountCents: money(s.amount, `surcharges.${i}.amountCents`), per: s.per, customizationMode: s.customizationMode, isActive: s.isActive })),
  };
  return { value, errors };
}

export function ProductForm({ initial, categories }: { initial: ProductInput; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [previewQty, setPreviewQty] = useState("12");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setD((prev) => ({ ...prev, [key]: value, ...(key === "name" && !slugTouched ? { slug: slugify(String(value)) } : {}) }));
  };
  const setRow = <K extends "tiers" | "variants" | "surcharges">(key: K, index: number, patch: Partial<Draft[K][number]>) =>
    set(key, d[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) as Draft[K]);
  const removeRow = <K extends "tiers" | "variants" | "surcharges">(key: K, index: number) =>
    set(key, d[key].filter((_, i) => i !== index) as Draft[K]);

  const preview = useMemo(() => {
    const { value, errors: e } = fromDraft(d);
    const qty = int(previewQty);
    if (Object.keys(e).length || !value.basePriceCents || !Number.isInteger(qty)) return null;
    try {
      return calculatePrice({
        product: { id: "x", name: value.name, basePriceCents: value.basePriceCents, tiers: value.tiers, minQty: value.minQty, maxQty: value.maxQty },
        quantity: qty,
        policy: { stacking: "best_price", rounding: 1 },
        now: new Date(),
      });
    } catch (err) {
      return err instanceof PricingError ? err.message : null;
    }
  }, [d, previewQty]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { value, errors: moneyErrors } = fromDraft(d);
    const local = productSchema.safeParse(value);
    const all = { ...moneyErrors, ...(local.success ? {} : fieldErrors(local.error)) };
    if (Object.keys(all).length) {
      setErrors(all);
      document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      const result = await saveProduct(value);
      if (!result.ok) return setErrors(result.errors);
      setErrors({});
      setSaved(true);
      if (!d.id) router.replace(`/admin/productos/${result.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!d.id || !window.confirm(`¿Eliminar "${d.name}" y sus fotos? Si solo quieres ocultarlo, desactívalo.`)) return;
    startTransition(async () => {
      const result = await deleteProduct(d.id);
      if (!result.ok) return setErrors(result.errors);
      router.replace("/admin/productos");
      router.refresh();
    });
  }

  const err = (k: string) => errors[k];
  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div id="form-top" />
      {errorCount > 0 && <FormError message={errors._ ?? `Revisa ${errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`}.`} />}

      <Card title="Información">
        <Field label="Nombre" htmlFor="name" error={err("name")}>
          <input id="name" className={inputClass} value={d.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!err("name")} />
        </Field>
        <Field label="Dirección (slug)" htmlFor="slug" error={err("slug")} hint={`Aparecerá como /producto/${d.slug || "…"}`}>
          <input id="slug" className={inputClass} value={d.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} aria-invalid={!!err("slug")} />
        </Field>
        <Field label="Categoría" htmlFor="categoryId" error={err("categoryId")}>
          <select id="categoryId" className={inputClass} value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Resumen" htmlFor="shortDescription" hint="Una línea para las tarjetas del catálogo." error={err("shortDescription")}>
          <input id="shortDescription" className={inputClass} value={d.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
        </Field>
        <Field label="Descripción" htmlFor="description" error={err("description")}>
          <textarea id="description" className={`${textareaClass} min-h-32`} value={d.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </Card>

      <Card title="Precio y cantidades">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Precio normal (RD$)" htmlFor="basePrice" error={err("basePriceCents")} hint="Por unidad">
            <input id="basePrice" inputMode="decimal" className={inputClass} value={d.basePrice} onChange={(e) => set("basePrice", e.target.value)} aria-invalid={!!err("basePriceCents")} />
          </Field>
          <Field label="Cantidad mínima" htmlFor="minQty" error={err("minQty")}>
            <input id="minQty" type="number" min={1} inputMode="numeric" className={inputClass} value={d.minQty} onChange={(e) => set("minQty", Number(e.target.value))} />
          </Field>
          <Field label="Cantidad máxima" htmlFor="maxQty" error={err("maxQty")}>
            <input id="maxQty" type="number" min={1} inputMode="numeric" className={inputClass} value={d.maxQty} onChange={(e) => set("maxQty", Number(e.target.value))} aria-invalid={!!err("maxQty")} />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium">Precios por cantidad</p>
          <p className="text-xs text-muted">Opcional. Ejemplo: 1 a 5 → RD$350, 6 a 11 → RD$300, 12 o más → RD$275. Deja el máximo vacío en el último rango.</p>
          {err("tiers") && <p className="mt-1 text-xs font-medium text-danger">{err("tiers")}</p>}
          <div className="mt-3 space-y-2">
            {d.tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1.3fr_auto] items-end gap-2">
                <Field label="Desde" htmlFor={`tmin${i}`}>
                  <input id={`tmin${i}`} inputMode="numeric" className={inputClass} value={t.minQty} onChange={(e) => setRow("tiers", i, { minQty: e.target.value })} />
                </Field>
                <Field label="Hasta" htmlFor={`tmax${i}`}>
                  <input id={`tmax${i}`} inputMode="numeric" placeholder="o más" className={inputClass} value={t.maxQty} onChange={(e) => setRow("tiers", i, { maxQty: e.target.value })} />
                </Field>
                <Field label="RD$ c/u" htmlFor={`tprice${i}`} error={err(`tiers.${i}.unitPriceCents`)}>
                  <input id={`tprice${i}`} inputMode="decimal" className={inputClass} value={t.price} onChange={(e) => setRow("tiers", i, { price: e.target.value })} />
                </Field>
                <button type="button" onClick={() => removeRow("tiers", i)} aria-label={`Quitar rango ${i + 1}`} className="mb-0.5 h-11 rounded-xl px-3 text-muted hover:bg-surface hover:text-danger">✕</button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${secondaryButton} mt-3 h-10 text-sm`}
            onClick={() => {
              const last = d.tiers.at(-1);
              const nextMin = last ? (int(last.maxQty) || int(last.minQty)) + 1 : 1;
              set("tiers", [...d.tiers, { minQty: String(nextMin || 1), maxQty: "", price: "" }]);
            }}
          >
            + Agregar rango
          </button>
        </div>

        <div className="rounded-xl bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="previewQty" className="font-medium">Vista previa: si piden</label>
            <input id="previewQty" inputMode="numeric" className={`${inputClass} h-9 w-20`} value={previewQty} onChange={(e) => setPreviewQty(e.target.value)} />
            <span>unidades</span>
          </div>
          <p className="mt-2 text-sm" aria-live="polite">
            {preview === null ? (
              <span className="text-muted">Completa el precio para ver el cálculo.</span>
            ) : typeof preview === "string" ? (
              <span className="text-danger">{preview}</span>
            ) : (
              <>
                {formatDOP(preview.unitCents)} c/u · Total <strong>{formatDOP(preview.totalCents)}</strong>
                {preview.discountCents > 0 && <span className="text-success"> · Ahorra {formatDOP(preview.discountCents)}</span>}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">Sin ofertas ni recargos. Es el mismo cálculo que verá el cliente.</p>
        </div>
      </Card>

      <Card title="Variantes" description="Opcional: tamaños, colores o modelos. El precio extra se suma por unidad (0 si cuesta igual).">
        {err("variants") && <p className="text-xs font-medium text-danger">{err("variants")}</p>}
        {d.variants.map((v, i) => (
          <div key={v.id || `new-${i}`} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
            <Field label="Nombre" htmlFor={`vname${i}`} error={err(`variants.${i}.name`)} className="col-span-2 sm:col-span-1">
              <input id={`vname${i}`} className={inputClass} value={v.name} onChange={(e) => setRow("variants", i, { name: e.target.value })} />
            </Field>
            <Field label="Extra RD$" htmlFor={`vdelta${i}`} error={err(`variants.${i}.priceDeltaCents`)}>
              <input id={`vdelta${i}`} inputMode="decimal" className={inputClass} value={v.delta} onChange={(e) => setRow("variants", i, { delta: e.target.value })} />
            </Field>
            <Field label="SKU" htmlFor={`vsku${i}`}>
              <input id={`vsku${i}`} className={inputClass} value={v.sku} onChange={(e) => setRow("variants", i, { sku: e.target.value })} />
            </Field>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={v.isActive} onChange={(e) => setRow("variants", i, { isActive: e.target.checked })} className="size-5 accent-[var(--brand)]" />
              Activa
            </label>
            <button type="button" onClick={() => removeRow("variants", i)} aria-label={`Quitar variante ${v.name || i + 1}`} className="h-11 rounded-xl px-3 text-muted hover:bg-surface hover:text-danger">✕</button>
          </div>
        ))}
        <button type="button" className={`${secondaryButton} h-10 text-sm`} onClick={() => set("variants", [...d.variants, { id: "", name: "", sku: "", delta: "0", isActive: true }])}>
          + Agregar variante
        </button>
      </Card>

      <Card title="Personalización" description="Qué opciones verá el cliente al pedir este producto.">
        <div className="grid gap-2 sm:grid-cols-3">
          <Toggle id="allowsOwnDesign" label="Tengo mi diseño" hint="Sube JPG, PNG o PDF" checked={d.allowsOwnDesign} onChange={(v) => set("allowsOwnDesign", v)} />
          <Toggle id="allowsGallery" label="Elegir de la galería" hint="Diseños de PEVESTORE" checked={d.allowsGallery} onChange={(v) => set("allowsGallery", v)} />
          <Toggle id="allowsIdea" label="Tengo una idea" hint="Describe y adjunta referencias" checked={d.allowsIdea} onChange={(v) => set("allowsIdea", v)} />
        </div>

        <div>
          <p className="text-sm font-medium">Recargos</p>
          <p className="text-xs text-muted">Opcional. Ejemplo: impresión a dos caras +RD$50 por unidad, o diseño desde cero +RD$500 por pedido.</p>
          <div className="mt-3 space-y-3">
            {d.surcharges.map((s, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-border p-3 sm:grid-cols-[2fr_1fr_1fr_1.4fr_auto]">
                <Field label="Descripción" htmlFor={`slabel${i}`} error={err(`surcharges.${i}.label`)} className="col-span-2 sm:col-span-1">
                  <input id={`slabel${i}`} className={inputClass} value={s.label} onChange={(e) => setRow("surcharges", i, { label: e.target.value })} />
                </Field>
                <Field label="RD$" htmlFor={`samount${i}`} error={err(`surcharges.${i}.amountCents`)}>
                  <input id={`samount${i}`} inputMode="decimal" className={inputClass} value={s.amount} onChange={(e) => setRow("surcharges", i, { amount: e.target.value })} />
                </Field>
                <Field label="Se cobra" htmlFor={`sper${i}`}>
                  <select id={`sper${i}`} className={inputClass} value={s.per} onChange={(e) => setRow("surcharges", i, { per: e.target.value as "unit" | "order" })}>
                    <option value="unit">Por unidad</option>
                    <option value="order">Una vez</option>
                  </select>
                </Field>
                <Field label="Cuándo" htmlFor={`smode${i}`}>
                  <select id={`smode${i}`} className={inputClass} value={s.customizationMode} onChange={(e) => setRow("surcharges", i, { customizationMode: e.target.value as Draft["surcharges"][number]["customizationMode"] })}>
                    <option value="">Siempre</option>
                    <option value="own_design">Si sube su diseño</option>
                    <option value="gallery">Si elige de la galería</option>
                    <option value="idea">Si envía una idea</option>
                  </select>
                </Field>
                <button type="button" onClick={() => removeRow("surcharges", i)} aria-label={`Quitar recargo ${s.label || i + 1}`} className="h-11 rounded-xl px-3 text-muted hover:bg-surface hover:text-danger">✕</button>
              </div>
            ))}
          </div>
          <button type="button" className={`${secondaryButton} mt-3 h-10 text-sm`} onClick={() => set("surcharges", [...d.surcharges, { label: "", amount: "", per: "unit", customizationMode: "", isActive: true }])}>
            + Agregar recargo
          </button>
        </div>
      </Card>

      <Card title="Disponibilidad y publicación">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Disponibilidad" htmlFor="availability">
            <select id="availability" className={inputClass} value={d.availability} onChange={(e) => set("availability", e.target.value as Draft["availability"])}>
              <option value="available">Disponible</option>
              <option value="on_request">Bajo pedido (consultar)</option>
              <option value="unavailable">Agotado</option>
            </select>
          </Field>
          <Field label="Días de producción" htmlFor="productionDays" hint="Vacío = usa el tiempo general del negocio" error={err("productionDays")}>
            <input id="productionDays" inputMode="numeric" className={inputClass} value={d.productionDays} onChange={(e) => set("productionDays", e.target.value)} />
          </Field>
          <Field label="Orden" htmlFor="sortOrder" hint="Número menor aparece primero" error={err("sortOrder")}>
            <input id="sortOrder" type="number" min={0} inputMode="numeric" className={inputClass} value={d.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle id="isActive" label="Publicado en la tienda" hint="Desactívalo para guardarlo como borrador" checked={d.isActive} onChange={(v) => set("isActive", v)} />
          <Toggle id="isFeatured" label="Destacado" hint="Aparece en Productos populares" checked={d.isFeatured} onChange={(v) => set("isFeatured", v)} />
        </div>
      </Card>

      <Card title="Buscadores (SEO)" description="Opcional. Si lo dejas vacío se usan el nombre y el resumen.">
        <Field label="Título" htmlFor="seoTitle" error={err("seoTitle")} hint={`${d.seoTitle.length}/70`}>
          <input id="seoTitle" className={inputClass} value={d.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
        </Field>
        <Field label="Descripción" htmlFor="seoDescription" error={err("seoDescription")} hint={`${d.seoDescription.length}/160`}>
          <textarea id="seoDescription" className={textareaClass} value={d.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
        </Field>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Guardando…" : d.id ? "Guardar cambios" : "Crear producto"}</button>
        <Link href="/admin/productos" className={secondaryButton}>Volver</Link>
        {saved && <span role="status" className="text-sm font-medium text-success">Guardado</span>}
        {d.id && <button type="button" onClick={remove} disabled={pending} className={`${dangerButton} ml-auto`}>Eliminar</button>}
      </div>
    </form>
  );
}
