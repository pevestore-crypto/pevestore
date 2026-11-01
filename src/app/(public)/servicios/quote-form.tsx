"use client";

import { useState, useTransition } from "react";
import { TurnstileWidget, turnstileEnabled } from "@/components/security/turnstile-widget";
import { IconUpload, IconWhatsApp } from "@/components/ui/icons";
import type { PublicService } from "@/lib/catalog/public";
import { formatIsoDateLong } from "@/lib/domain/schedule";
import { buildQuoteMessage, whatsappLink } from "@/lib/domain/whatsapp";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { attachQuoteFile, submitQuote } from "./actions";

const input = "h-12 w-full rounded-xl border border-border bg-surface-raised px-4 text-base outline-none focus:border-brand aria-[invalid=true]:border-danger";
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

interface Sent {
  code: string;
  message: string;
  failedFiles: number;
}

export function QuoteForm({ services, whatsappNumber, initialService }: { services: PublicService[]; whatsappNumber: string | null; initialService: string | null }) {
  const [f, setF] = useState({
    serviceId: services.find((s) => s.slug === initialService)?.id ?? "",
    customerName: "",
    whatsapp: "",
    measurements: "",
    quantity: "",
    material: "",
    requiredDate: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [pending, start] = useTransition();
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const service = services.find((s) => s.id === f.serviceId);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setErrors({});
      setProgress("Enviando solicitud…");
      const qty = f.quantity.trim() === "" ? "" : Number(f.quantity);
      const result = await submitQuote(
        {
          ...f,
          quantity: qty === "" || Number.isNaN(qty) ? "" : qty,
          measurements: service?.asksMeasurements ? f.measurements : "",
          material: service?.asksMaterial ? f.material : "",
          files: files.map((x) => ({ mime: x.type as "image/jpeg", size: x.size, name: x.name })),
        },
        captcha,
      );
      setCaptcha(null);
      setCaptchaKey((k) => k + 1);
      if (!result.ok) {
        setProgress(null);
        setErrors(result.errors);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      let failed = 0;
      for (const [n, t] of result.uploads.entries()) {
        setProgress(`Subiendo archivos (${n + 1} de ${result.uploads.length})…`);
        const file = files[t.index];
        const up = await supabase.storage.from("customer-files").uploadToSignedUrl(t.path, t.token, file, { contentType: file.type });
        if (up.error || !(await attachQuoteFile(result.quoteId, t.path, file.name)).ok) failed++;
      }
      setProgress(null);
      setSent({
        code: result.code,
        failedFiles: failed,
        message: buildQuoteMessage({
          reference: result.code,
          customerName: f.customerName,
          serviceName: result.serviceName,
          measurements: service?.asksMeasurements ? f.measurements : undefined,
          quantity: typeof qty === "number" && qty > 0 ? qty : undefined,
          material: service?.asksMaterial ? f.material : undefined,
          requiredDate: f.requiredDate ? formatIsoDateLong(f.requiredDate) : undefined,
          description: f.description,
          fileCount: files.length - failed,
        }),
      });
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 rounded-2xl border border-border p-5">
        <p className="text-sm font-semibold text-success">¡Solicitud registrada!</p>
        <h2 className="text-2xl font-bold">Referencia {sent.code}</h2>
        {sent.failedFiles > 0 && (
          <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            No pudimos recibir {sent.failedFiles === 1 ? "un archivo" : `${sent.failedFiles} archivos`}. Envíalos por WhatsApp.
          </p>
        )}
        {whatsappNumber ? (
          <>
            <p className="text-sm text-muted">Revisa el mensaje y envíalo para recibir tu cotización más rápido. Tus archivos ya están guardados de forma segura en nuestra plataforma.</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs">{sent.message}</pre>
            <a
              href={whatsappLink(whatsappNumber, sent.message)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white hover:brightness-95"
            >
              <IconWhatsApp className="size-5" /> Solicitar cotización por WhatsApp
            </a>
          </>
        ) : (
          <p className="text-sm text-muted">Te contactaremos por WhatsApp con tu cotización.</p>
        )}
      </div>
    );
  }

  const err = (k: string) => errors[k];
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
      {errors._ && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">{errors._}</p>}

      <Labeled id="serviceId" label="Tipo de trabajo" error={err("serviceId")}>
        <select id="serviceId" className={input} value={f.serviceId} onChange={(e) => set("serviceId", e.target.value)} aria-invalid={!!err("serviceId")}>
          <option value="">Elige un servicio…</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Labeled>

      <div className="grid gap-4 sm:grid-cols-2">
        {service?.asksMeasurements && (
          <Labeled id="measurements" label="Medidas" hint="Ejemplo: 2 m × 1 m, o 60 × 40 pulgadas" error={err("measurements")}>
            <input id="measurements" className={input} value={f.measurements} onChange={(e) => set("measurements", e.target.value)} />
          </Labeled>
        )}
        <Labeled id="quantity" label="Cantidad (opcional)" error={err("quantity")}>
          <input id="quantity" inputMode="numeric" className={input} value={f.quantity} onChange={(e) => set("quantity", e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Labeled>
        {service?.asksMaterial && (
          <Labeled id="material" label="Material (si lo sabes)" hint="Ejemplo: lona, vinil adhesivo, PVC, acrílico" error={err("material")}>
            <input id="material" className={input} value={f.material} onChange={(e) => set("material", e.target.value)} />
          </Labeled>
        )}
        <Labeled id="requiredDate" label="¿Para cuándo? (opcional)" error={err("requiredDate")}>
          <input id="requiredDate" type="date" className={input} value={f.requiredDate} onChange={(e) => set("requiredDate", e.target.value)} />
        </Labeled>
      </div>

      <Labeled id="description" label="Describe el trabajo" hint="Dónde se instalará, colores, textos, si necesitas diseño…" error={err("description")}>
        <textarea id="description" rows={4} className={`${input} h-auto py-3`} value={f.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!err("description")} />
      </Labeled>

      <div>
        <p className="mb-1 text-sm font-medium">Archivos de referencia (opcional)</p>
        <input id="quote-files" type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
        <label htmlFor="quote-files" className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface-raised px-3 py-3 text-sm hover:border-brand">
          <IconUpload className="size-5 text-brand" />
          <span className="min-w-0 flex-1 truncate">{files.length ? files.map((x) => x.name).join(", ") : "Logo, foto del lugar, boceto…"}</span>
        </label>
        <p className="mt-1 text-xs text-muted">{err("files") ?? "Hasta 5 · JPG, PNG, WebP o PDF · máximo 10 MB c/u. Se guardan de forma privada."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled id="q-name" label="Nombre completo" error={err("customerName")}>
          <input id="q-name" autoComplete="name" className={input} value={f.customerName} onChange={(e) => set("customerName", e.target.value)} aria-invalid={!!err("customerName")} />
        </Labeled>
        <Labeled id="q-wa" label="Tu WhatsApp" error={err("whatsapp")}>
          <input id="q-wa" type="tel" inputMode="tel" autoComplete="tel" placeholder="809-555-1234" className={input} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} aria-invalid={!!err("whatsapp")} />
        </Labeled>
      </div>

      <TurnstileWidget key={captchaKey} onToken={setCaptcha} />
      <button type="submit" disabled={pending || (turnstileEnabled && !captcha)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-contrast hover:bg-brand-hover disabled:opacity-60">
        {pending ? progress ?? "Enviando…" : "Continuar"}
      </button>
      <p className="text-center text-xs text-muted">Guardamos tu solicitud y luego te preparamos el mensaje de WhatsApp.</p>
    </form>
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
