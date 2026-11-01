"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/admin/form-ui";
import { resizeToWebp } from "@/lib/images/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { type DesignInput, createDesignUpload, deleteDesign, saveDesign } from "./actions";

const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/${path}`;

export function DesignEditor({ initial, products, onDone }: { initial: DesignInput; products: { id: string; name: string }[]; onDone?: () => void }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setStatus("Optimizando…");
      const blob = await resizeToWebp(file, 1200, 0.85);
      const ticket = await createDesignUpload();
      if (!ticket.ok) throw new Error(ticket.error);
      setStatus("Subiendo…");
      const { error } = await createSupabaseBrowserClient().storage.from("catalog").uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: "image/webp" });
      if (error) throw new Error("No se pudo subir la imagen.");
      setD((p) => ({ ...p, path: ticket.path }));
    } catch (e) {
      setErrors({ path: e instanceof Error ? e.message : "Error inesperado." });
    } finally {
      setStatus(null);
    }
  }

  const toggleProduct = (id: string) =>
    setD((p) => ({ ...p, productIds: p.productIds.includes(id) ? p.productIds.filter((x) => x !== id) : [...p.productIds, id] }));

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveDesign(d);
          if (!r.ok) return setErrors(r.errors);
          setErrors({});
          onDone?.();
          router.refresh();
        });
      }}
    >
      <FormError message={errors._} />
      <div className="flex gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface">
          {d.path && <Image src={publicUrl(d.path)} alt="" fill sizes="96px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input id={`file-${d.id || "new"}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <label htmlFor={`file-${d.id || "new"}`} className={`${secondaryButton} h-9 cursor-pointer text-sm ${status ? "pointer-events-none opacity-60" : ""}`}>
            {status ?? (d.path ? "Cambiar imagen" : "Subir imagen")}
          </label>
          {errors.path && <p className="text-xs font-medium text-danger">{errors.path}</p>}
          <label className="sr-only" htmlFor={`title-${d.id || "new"}`}>Nombre del diseño</label>
          <input id={`title-${d.id || "new"}`} className={inputClass} placeholder="Nombre (ej.: Navidad dorada)" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          {errors.title && <p className="text-xs font-medium text-danger">{errors.title}</p>}
        </div>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-muted">Disponible en estos productos</legend>
        {products.length === 0 ? (
          <p className="text-xs text-muted">Primero crea productos.</p>
        ) : (
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {products.map((p) => (
              <label key={p.id} className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${d.productIds.includes(p.id) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
                <input type="checkbox" className="sr-only" checked={d.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} className="size-4 accent-[var(--brand)]" /> Visible
        </label>
        <button type="submit" disabled={pending || !!status} className={`${primaryButton} ml-auto h-9 text-sm`}>{pending ? "Guardando…" : d.id ? "Guardar" : "Agregar diseño"}</button>
        {d.id && (
          <button
            type="button"
            className={`${dangerButton} h-9 text-sm`}
            onClick={() => window.confirm("¿Eliminar este diseño?") && start(async () => {
              const r = await deleteDesign(d.id);
              if (r.ok) router.refresh();
              else setErrors(r.errors);
            })}
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}

export function NewDesign({ products }: { products: { id: string; name: string }[] }) {
  const [key, setKey] = useState(0);
  return (
    <DesignEditor
      key={key}
      initial={{ id: "", path: "", title: "", isActive: true, sortOrder: 0, productIds: [] }}
      products={products}
      onDone={() => setKey((k) => k + 1)}
    />
  );
}
