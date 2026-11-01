"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Card, inputClass, secondaryButton } from "@/components/admin/form-ui";
import { resizeToWebp } from "@/lib/images/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createImageUpload, deleteImage, registerImage, saveImageOrder } from "./actions";

export interface ImageItem {
  id: string;
  url: string;
  alt: string;
}

export function ProductImages({ productId, productName, initial }: { productId: string; productName: string; initial: ImageItem[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const list = Array.from(files).slice(0, 10);
    for (const [i, file] of list.entries()) {
      try {
        setStatus(`Procesando foto ${i + 1} de ${list.length}…`);
        const blob = await resizeToWebp(file);
        const ticket = await createImageUpload(productId);
        if (!ticket.ok) throw new Error(ticket.error);
        setStatus(`Subiendo foto ${i + 1} de ${list.length}…`);
        const { error: upErr } = await supabase.storage.from("catalog").uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: "image/webp" });
        if (upErr) throw new Error("No se pudo subir la foto.");
        const reg = await registerImage(productId, ticket.path, productName);
        if (!reg.ok) throw new Error(Object.values(reg.errors)[0]);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "error inesperado"}`);
        break;
      }
    }
    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    setDirty(true);
  }

  function remove(img: ImageItem) {
    if (!window.confirm("¿Eliminar esta foto?")) return;
    startTransition(async () => {
      const r = await deleteImage(img.id);
      if (!r.ok) return setError(Object.values(r.errors)[0]);
      setImages((prev) => prev.filter((x) => x.id !== img.id));
      router.refresh();
    });
  }

  function saveOrder() {
    startTransition(async () => {
      const r = await saveImageOrder(productId, images.map((i) => ({ id: i.id, alt: i.alt })));
      if (!r.ok) return setError(Object.values(r.errors)[0]);
      setDirty(false);
      router.refresh();
    });
  }

  // Al recibir datos nuevos del servidor (tras subir), sincroniza si no hay cambios locales.
  if (!dirty && initial.map((i) => i.id).join() !== images.map((i) => i.id).join()) setImages(initial);

  return (
    <Card title="Fotos" description="La primera es la principal. Se optimizan automáticamente (WebP, máx. 1600 px).">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="relative aspect-square">
                <Image src={img.url} alt={img.alt} fill sizes="(min-width: 640px) 200px, 45vw" className="object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-contrast">Principal</span>}
              </div>
              <div className="space-y-2 p-2">
                <label className="sr-only" htmlFor={`alt-${img.id}`}>Descripción de la foto</label>
                <input
                  id={`alt-${img.id}`}
                  className={`${inputClass} h-9 text-xs`}
                  placeholder="Descripción (accesibilidad)"
                  value={img.alt}
                  onChange={(e) => {
                    setImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)));
                    setDirty(true);
                  }}
                />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover antes" className="h-8 flex-1 rounded-lg hover:bg-background disabled:opacity-30">←</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Mover después" className="h-8 flex-1 rounded-lg hover:bg-background disabled:opacity-30">→</button>
                  <button type="button" onClick={() => remove(img)} disabled={pending} aria-label="Eliminar foto" className="h-8 flex-1 rounded-lg text-danger hover:bg-brand-soft">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      {status && <p role="status" className="text-sm text-muted">{status}</p>}

      <div className="flex flex-wrap gap-3">
        <input ref={inputRef} id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        <label htmlFor="photos" className={`${secondaryButton} cursor-pointer ${status ? "pointer-events-none opacity-60" : ""}`}>+ Subir fotos</label>
        {dirty && (
          <button type="button" onClick={saveOrder} disabled={pending} className={secondaryButton}>
            {pending ? "Guardando…" : "Guardar orden y descripciones"}
          </button>
        )}
      </div>
    </Card>
  );
}
