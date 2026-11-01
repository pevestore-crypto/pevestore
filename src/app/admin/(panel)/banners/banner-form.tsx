"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field, FormError, Toggle, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/admin/form-ui";
import type { BannerInput } from "@/lib/admin/banner-schema";
import { resizeToWebp } from "@/lib/images/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createBannerUpload, deleteBanner, saveBanner } from "./actions";

const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path}`;

function ImagePick({ id, label, hint, path, onPath, error, maxSide }: { id: string; label: string; hint: string; path: string; onPath: (p: string) => void; error?: string; maxSide: number }) {
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    try {
      setStatus("Optimizando…");
      const blob = await resizeToWebp(file, maxSide, 0.82);
      const ticket = await createBannerUpload();
      if (!ticket.ok) throw new Error(ticket.error);
      setStatus("Subiendo…");
      const { error: up } = await createSupabaseBrowserClient().storage.from("catalog").uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: "image/webp" });
      if (up) throw new Error("No se pudo subir la imagen.");
      onPath(ticket.path);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setStatus(null);
    }
  }
  return (
    <Field label={label} htmlFor={id} hint={hint} error={err ?? error}>
      {path && (
        <div className="relative mb-2 aspect-[16/7] overflow-hidden rounded-xl bg-surface">
          <Image src={publicUrl(path)} alt="" fill sizes="600px" className="object-cover" />
        </div>
      )}
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      <label htmlFor={id} className={`${secondaryButton} cursor-pointer ${status ? "pointer-events-none opacity-60" : ""}`}>{status ?? (path ? "Cambiar imagen" : "Subir imagen")}</label>
    </Field>
  );
}

export function BannerForm({ initial }: { initial: BannerInput }) {
  const router = useRouter();
  const [b, setB] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof BannerInput>(k: K, v: BannerInput[K]) => {
    setSaved(false);
    setB((p) => ({ ...p, [k]: v }));
  };

  const err = (k: string) => errors[k];
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBanner(b);
          if (!r.ok) return setErrors(r.errors);
          setErrors({});
          setSaved(true);
          if (!b.id) router.replace(`/admin/banners/${r.id}`);
          router.refresh();
        });
      }}
    >
      <FormError message={err("_")} />
      <Card title="Imágenes" description="Fotos de productos o campañas de PEVESTORE. Se optimizan automáticamente.">
        <ImagePick id="imgDesktop" label="Computadora (obligatoria)" hint="Horizontal, ideal 2000 × 875 px" path={b.imageDesktopPath} onPath={(p) => set("imageDesktopPath", p)} error={err("imageDesktopPath")} maxSide={2000} />
        <ImagePick id="imgMobile" label="Celular (opcional)" hint="Más vertical, ideal 1080 × 1080 px. Si no hay, se usa la de computadora." path={b.imageMobilePath} onPath={(p) => set("imageMobilePath", p)} error={err("imageMobilePath")} maxSide={1200} />
        <Field label="Descripción de la imagen" htmlFor="alt" hint="Para accesibilidad y buscadores." error={err("alt")}>
          <input id="alt" className={inputClass} value={b.alt} onChange={(e) => set("alt", e.target.value)} />
        </Field>
      </Card>

      <Card title="Textos y botón">
        <Field label="Título" htmlFor="title" error={err("title")}>
          <input id="title" className={inputClass} value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="¡Navidad en PEVESTORE!" />
        </Field>
        <Field label="Subtítulo" htmlFor="subtitle" error={err("subtitle")}>
          <input id="subtitle" className={inputClass} value={b.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Regalos personalizados para sorprender a quienes más quieres." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Texto del botón" htmlFor="ctaLabel" error={err("ctaLabel")}>
            <input id="ctaLabel" className={inputClass} value={b.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="¡Ver ofertas!" />
          </Field>
          <Field label="Enlace del botón" htmlFor="ctaHref" error={err("ctaHref")} hint="Solo páginas de esta tienda">
            <input id="ctaHref" className={inputClass} value={b.ctaHref} onChange={(e) => set("ctaHref", e.target.value)} placeholder="/ofertas" />
          </Field>
        </div>
      </Card>

      <Card title="Publicación">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Desde (opcional)" htmlFor="startsLocal" error={err("startsLocal")}>
            <input id="startsLocal" type="datetime-local" className={inputClass} value={b.startsLocal} onChange={(e) => set("startsLocal", e.target.value)} />
          </Field>
          <Field label="Hasta (opcional)" htmlFor="endsLocal" error={err("endsLocal")}>
            <input id="endsLocal" type="datetime-local" className={inputClass} value={b.endsLocal} onChange={(e) => set("endsLocal", e.target.value)} />
          </Field>
          <Field label="Orden" htmlFor="sortOrder" hint="Menor = aparece primero">
            <input id="sortOrder" type="number" min={0} className={inputClass} value={b.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
          </Field>
        </div>
        <Toggle id="isActive" label="Banner activo" checked={b.isActive} onChange={(v) => set("isActive", v)} />
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Guardando…" : "Guardar banner"}</button>
        <Link href="/admin/banners" className={secondaryButton}>Volver</Link>
        {saved && <span role="status" className="text-sm font-medium text-success">Guardado</span>}
        {b.id && (
          <button
            type="button"
            className={`${dangerButton} ml-auto`}
            onClick={() => window.confirm("¿Eliminar este banner y sus imágenes?") && start(async () => {
              const r = await deleteBanner(b.id);
              if (r.ok) { router.replace("/admin/banners"); router.refresh(); } else setErrors(r.errors);
            })}
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
