"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BankBadge } from "@/components/catalog/bank-badge";
import { IconUpload } from "@/components/ui/icons";
import { type CartItem, cart, useCart } from "@/lib/cart/cart";
import { formatDOP } from "@/lib/domain/money";
import { splitPayment } from "@/lib/domain/pricing";
import { formatIsoDateLong } from "@/lib/domain/schedule";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { type CartQuote, attachOrderFile, placeOrder, quoteCart } from "./actions";

const MODE_LABEL = { own_design: "Tengo mi diseño", gallery: "Elegir de la galería", idea: "Tengo una idea" } as const;
const ACCEPT_DESIGN = "image/jpeg,image/png,application/pdf";
const ACCEPT_REFERENCE = "image/jpeg,image/png,image/webp,application/pdf";
const input = "h-12 w-full rounded-xl border border-border bg-surface-raised px-4 text-base outline-none focus:border-brand aria-[invalid=true]:border-danger";

interface ItemExtras {
  ideaText: string;
  design: File | null;
  references: File[];
}

function publicUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path}`;
}

export function Checkout() {
  const items = useCart();
  const router = useRouter();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, ItemExtras>>({});
  const [form, setForm] = useState({ customerName: "", customerWhatsapp: "", requiredDate: "", notes: "", paymentPlan: "deposit_50" as "deposit_50" | "full", bankAccountId: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const itemsKey = JSON.stringify(items.map((i) => [i.productId, i.variantId, i.quantity, i.mode]));
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await quoteCart(items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, mode: i.mode })));
      if (cancelled) return;
      if ("error" in r) setQuoteError(r.error);
      else {
        setQuoteError(null);
        setQuote(r);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // itemsKey resume los cambios que afectan el precio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const extra = (key: string): ItemExtras => extras[key] ?? { ideaText: "", design: null, references: [] };
  const setExtra = (key: string, patch: Partial<ItemExtras>) => setExtras((p) => ({ ...p, [key]: { ...extra(key), ...patch } }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const rounding = quote?.rounding ?? 1;
  const split = useMemo(() => (quote?.ok && quote.totalCents > 0 ? splitPayment(quote.totalCents, form.paymentPlan, rounding) : null), [quote, form.paymentPlan, rounding]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-14 text-center">
        <p className="text-lg font-semibold">Tu pedido está vacío</p>
        <p className="mt-1 text-sm text-muted">Elige un producto y pulsa “Agregar al pedido”.</p>
        <Link href="/productos" className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover">Ver productos</Link>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    startTransition(async () => {
      setErrors({});
      setProgress("Registrando tu pedido…");
      const payloadItems = items.map((i) => {
        const x = extra(i.key);
        const files = [
          ...(i.mode === "own_design" && x.design ? [{ purpose: "design" as const, file: x.design }] : []),
          ...(i.mode === "idea" ? x.references.map((f) => ({ purpose: "reference" as const, file: f })) : []),
        ];
        return {
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          mode: i.mode,
          ideaText: i.mode === "idea" ? x.ideaText : "",
          files: files.map((f) => ({ purpose: f.purpose, mime: f.file.type as "image/jpeg", size: f.file.size, name: f.file.name })),
          _files: files.map((f) => f.file),
        };
      });

      const result = await placeOrder({
        ...form,
        acceptTerms: form.acceptTerms as true,
        termsVersion: quote.terms?.version ?? 0,
        items: payloadItems.map((p) => ({ productId: p.productId, variantId: p.variantId, quantity: p.quantity, mode: p.mode, ideaText: p.ideaText, files: p.files })),
      });
      if (!result.ok) {
        setProgress(null);
        setErrors(result.errors);
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      // Subir archivos directo al almacenamiento privado.
      const supabase = createSupabaseBrowserClient();
      let failed = 0;
      for (const [n, ticket] of result.uploads.entries()) {
        setProgress(`Subiendo archivos (${n + 1} de ${result.uploads.length})…`);
        const file = payloadItems[ticket.itemIndex]._files[ticket.fileIndex];
        const up = await supabase.storage.from("customer-files").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
        const ok = !up.error && (await attachOrderFile(result.code, result.token, { path: ticket.path, itemIndex: ticket.itemIndex, purpose: ticket.purpose, name: file.name })).ok;
        if (!ok) failed++;
      }
      cart.clear();
      router.push(`/pedido/${result.code}/${result.token}${failed ? `?archivos=${failed}` : ""}`);
    });
  }

  const err = (k: string) => errors[k];
  const errorList = Object.entries(errors).filter(([k]) => k !== "_");

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div ref={topRef} className="space-y-6">
        {(errors._ || quoteError) && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">{errors._ ?? quoteError}</p>}
        {errorList.length > 0 && !errors._ && (
          <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">Revisa {errorList.length === 1 ? "el dato marcado" : `los ${errorList.length} datos marcados`} en rojo.</p>
        )}

        <section aria-labelledby="h-items" className="rounded-2xl border border-border p-4 sm:p-5">
          <h2 id="h-items" className="text-lg font-bold">1. Tu pedido</h2>
          <ul className="mt-4 space-y-5">
            {items.map((item, index) => (
              <CartLine
                key={item.key}
                item={item}
                line={quote?.lines[index]}
                extra={extra(item.key)}
                onExtra={(patch) => setExtra(item.key, patch)}
                errors={{ line: err(`items.${index}`), files: err(`items.${index}.files`), idea: err(`items.${index}.ideaText`) }}
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="h-datos" className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
          <h2 id="h-datos" className="text-lg font-bold">2. Tus datos</h2>
          <Labeled id="customerName" label="Nombre completo" error={err("customerName")}>
            <input id="customerName" autoComplete="name" className={input} value={form.customerName} onChange={(e) => set("customerName", e.target.value)} aria-invalid={!!err("customerName")} />
          </Labeled>
          <Labeled id="customerWhatsapp" label="Tu número de WhatsApp" hint="Te escribiremos aquí sobre tu pedido." error={err("customerWhatsapp")}>
            <input id="customerWhatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="809-555-1234" className={input} value={form.customerWhatsapp} onChange={(e) => set("customerWhatsapp", e.target.value)} aria-invalid={!!err("customerWhatsapp")} />
          </Labeled>
          <Labeled
            id="requiredDate"
            label="¿Para cuándo lo necesitas?"
            hint={quote ? `La primera fecha disponible es el ${formatIsoDateLong(quote.earliestDate)}.` : undefined}
            error={err("requiredDate")}
          >
            <input id="requiredDate" type="date" min={quote?.earliestDate} className={input} value={form.requiredDate} onChange={(e) => set("requiredDate", e.target.value)} aria-invalid={!!err("requiredDate")} />
          </Labeled>
          <Labeled id="notes" label="Observaciones (opcional)" error={err("notes")}>
            <textarea id="notes" rows={3} className={`${input} h-auto py-3`} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Labeled>
        </section>

        <section aria-labelledby="h-pago" className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
          <h2 id="h-pago" className="text-lg font-bold">3. Pago por transferencia</h2>
          {quote && !quote.ready ? (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Los pagos en línea aún no están habilitados. Escríbenos por WhatsApp para completar tu pedido.</p>
          ) : (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">¿Cuánto pagas ahora?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["deposit_50", "full"] as const).map((plan) => {
                    const s = quote?.ok ? splitPayment(quote.totalCents, plan, rounding) : null;
                    return (
                      <label key={plan} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${form.paymentPlan === plan ? "border-brand bg-brand-soft" : "border-border"}`}>
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <input type="radio" name="plan" checked={form.paymentPlan === plan} onChange={() => set("paymentPlan", plan)} className="size-4 accent-[var(--brand)]" />
                          {plan === "deposit_50" ? "50 % de anticipo" : "100 % del total"}
                        </span>
                        {s && <span className="text-sm font-bold tabular-nums">{formatDOP(s.dueNowCents)}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Banco al que transferirás</legend>
                {err("bankAccountId") && <p className="mb-2 text-xs font-medium text-danger">{err("bankAccountId")}</p>}
                <div className="grid gap-2 sm:grid-cols-3">
                  {quote?.banks.map((b) => (
                    <label key={b.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${form.bankAccountId === b.id ? "border-brand bg-brand-soft" : "border-border"}`}>
                      <input type="radio" name="bank" className="sr-only" checked={form.bankAccountId === b.id} onChange={() => set("bankAccountId", b.id)} />
                      <BankBadge code={b.bankCode} size="sm" />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Verás el número de cuenta al confirmar el pedido.</p>
              </fieldset>
              <p className="flex gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
                <span aria-hidden>📸</span> Recuerda guardar una captura de tu transferencia. La necesitarás para completar tu pedido.
              </p>
            </>
          )}
        </section>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Resumen</h2>
        {!quote ? (
          <div aria-hidden className="h-24 animate-pulse rounded-xl bg-background" />
        ) : (
          <dl className="space-y-1.5 text-sm" aria-live="polite">
            {quote.lines.map((l) => (
              <div key={l.index} className="flex justify-between gap-3">
                <dt className="min-w-0 truncate text-muted">{l.quantity} × {l.name}</dt>
                <dd className="tabular-nums">{l.quote ? formatDOP(l.quote.totalCents) : "—"}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{quote.ok ? formatDOP(quote.totalCents) : "—"}</dd>
            </div>
            {split && (
              <>
                <div className="flex justify-between text-brand"><dt className="font-semibold">A transferir ahora</dt><dd className="font-bold tabular-nums">{formatDOP(split.dueNowCents)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Saldo pendiente</dt><dd className="tabular-nums">{formatDOP(split.balanceCents)}</dd></div>
              </>
            )}
          </dl>
        )}

        {quote?.terms && (
          <div>
            <details className="rounded-xl border border-border bg-background p-3 text-sm">
              <summary className="cursor-pointer font-medium">Condiciones comerciales</summary>
              <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-line text-xs text-muted">{quote.terms.body}</p>
            </details>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" aria-invalid={!!err("acceptTerms")} />
              <span>Leí y acepto las condiciones comerciales.</span>
            </label>
            {err("acceptTerms") && <p className="mt-1 text-xs font-medium text-danger">{err("acceptTerms")}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !quote?.ok || !quote.ready}
          className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-contrast transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? progress ?? "Enviando…" : "Confirmar pedido"}
        </button>
        <p className="text-center text-xs text-muted">No se confirma ningún pago automáticamente: lo verificamos al recibir tu transferencia.</p>
      </aside>
    </form>
  );
}

function CartLine({
  item,
  line,
  extra,
  onExtra,
  errors,
}: {
  item: CartItem;
  line?: CartQuote["lines"][number];
  extra: ItemExtras;
  onExtra: (patch: Partial<ItemExtras>) => void;
  errors: { line?: string; files?: string; idea?: string };
}) {
  const [qty, setQty] = useState(String(item.quantity));
  const commitQty = () => {
    const n = Number(qty);
    if (Number.isInteger(n) && n > 0) cart.update(item.key, { quantity: n });
    else setQty(String(item.quantity));
  };
  const modes = line?.allowedModes ?? [];

  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <Link href={`/producto/${item.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface sm:size-20">
          {item.imagePath && <Image src={publicUrl(item.imagePath)} alt="" fill sizes="80px" className="object-cover" />}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.name}</p>
          {item.variantName && <p className="text-sm text-muted">{item.variantName}</p>}
          {line?.quote && (
            <p className="text-sm text-muted">
              {formatDOP(line.quote.unitCents)} c/u · <span className="font-semibold text-foreground">{formatDOP(line.quote.totalCents)}</span>
            </p>
          )}
          {(errors.line || line?.error) && <p className="text-sm font-medium text-danger">{errors.line ?? line?.error}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="sr-only" htmlFor={`qty-${item.key}`}>Cantidad</label>
          <input
            id={`qty-${item.key}`}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onBlur={commitQty}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitQty())}
            className="h-10 w-16 rounded-lg border border-border bg-surface-raised text-center font-semibold outline-none focus:border-brand"
          />
          <button type="button" onClick={() => cart.remove(item.key)} className="text-xs text-muted underline hover:text-danger">Quitar</button>
        </div>
      </div>

      {modes.length > 0 && (
        <div className="space-y-3 rounded-xl bg-surface p-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Personalización de ${item.name}`}>
            {modes.map((m) => (
              <button
                type="button"
                key={m}
                role="radio"
                aria-checked={item.mode === m}
                onClick={() => cart.update(item.key, { mode: m })}
                className={`rounded-full border px-3 py-1.5 text-sm ${item.mode === m ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-background"}`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {item.mode === "own_design" && (
            <FilePick
              id={`design-${item.key}`}
              label="Archivo de tu diseño"
              hint="JPG, PNG o PDF · máximo 15 MB"
              accept={ACCEPT_DESIGN}
              files={extra.design ? [extra.design] : []}
              onFiles={(f) => onExtra({ design: f[0] ?? null })}
              error={errors.files}
            />
          )}
          {item.mode === "idea" && (
            <>
              <div>
                <label htmlFor={`idea-${item.key}`} className="mb-1 block text-sm font-medium">Cuéntanos tu idea</label>
                <textarea
                  id={`idea-${item.key}`}
                  rows={3}
                  value={extra.ideaText}
                  onChange={(e) => onExtra({ ideaText: e.target.value })}
                  placeholder="Ejemplo: nombre “Familia Pérez” con letras doradas y un árbol de Navidad."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-brand aria-[invalid=true]:border-danger"
                  aria-invalid={!!errors.idea}
                />
                {errors.idea && <p className="text-xs font-medium text-danger">{errors.idea}</p>}
              </div>
              <FilePick
                id={`refs-${item.key}`}
                label="Imágenes de referencia (opcional)"
                hint="Hasta 5 · JPG, PNG, WebP o PDF · máximo 10 MB c/u"
                accept={ACCEPT_REFERENCE}
                multiple
                files={extra.references}
                onFiles={(f) => onExtra({ references: f.slice(0, 5) })}
                error={errors.files}
              />
            </>
          )}
          <p className="text-xs text-muted">El diseño final lo revisa o prepara PEVESTORE antes de producir.</p>
        </div>
      )}
    </li>
  );
}

function FilePick({ id, label, hint, accept, multiple = false, files, onFiles, error }: { id: string; label: string; hint: string; accept: string; multiple?: boolean; files: File[]; onFiles: (f: File[]) => void; error?: string }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <input id={id} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-3 text-sm hover:border-brand">
        <IconUpload className="size-5 text-brand" />
        <span className="min-w-0 flex-1 truncate">{files.length ? files.map((f) => f.name).join(", ") : "Elegir archivo"}</span>
      </label>
      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Labeled({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
