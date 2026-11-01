"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field, FormError, Toggle, dangerButton, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/admin/form-ui";
import { type CategoryInput, categorySchema, fieldErrors } from "@/lib/admin/catalog-schema";
import { slugify } from "@/lib/domain/slug";
import { deleteCategory, saveCategory } from "./actions";

export function CategoryForm({ initial }: { initial: CategoryInput }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) => {
    setSaved(false);
    setC((prev) => ({ ...prev, [key]: value, ...(key === "name" && !slugTouched ? { slug: slugify(String(value)) } : {}) }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = categorySchema.safeParse(c);
    if (!local.success) return setErrors(fieldErrors(local.error));
    startTransition(async () => {
      const result = await saveCategory(c);
      if (!result.ok) return setErrors(result.errors);
      setErrors({});
      setSaved(true);
      if (!c.id) router.replace(`/admin/categorias/${result.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!c.id || !window.confirm(`¿Eliminar la categoría "${c.name}"? Sus productos quedarán sin categoría.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(c.id);
      if (!result.ok) return setErrors(result.errors);
      router.replace("/admin/categorias");
      router.refresh();
    });
  }

  const err = (k: string) => errors[k];

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={err("_")} />
      <Card title="Datos de la categoría">
        <Field label="Nombre" htmlFor="name" error={err("name")}>
          <input id="name" className={inputClass} value={c.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!err("name")} />
        </Field>
        <Field label="Dirección (slug)" htmlFor="slug" error={err("slug")} hint={`Aparecerá como /productos/${c.slug || "…"}`}>
          <input
            id="slug"
            className={inputClass}
            value={c.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
            aria-invalid={!!err("slug")}
          />
        </Field>
        <Field label="Descripción" htmlFor="description" error={err("description")}>
          <textarea id="description" className={textareaClass} value={c.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Orden" htmlFor="sortOrder" hint="Las de número menor aparecen primero." error={err("sortOrder")}>
          <input id="sortOrder" type="number" min={0} inputMode="numeric" className={`${inputClass} max-w-32`} value={c.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
        </Field>
        <Toggle id="isActive" label="Visible en la tienda" checked={c.isActive} onChange={(v) => set("isActive", v)} />
      </Card>

      <Card title="Buscadores (SEO)" description="Opcional. Si lo dejas vacío se usan el nombre y la descripción.">
        <Field label="Título" htmlFor="seoTitle" error={err("seoTitle")} hint={`${c.seoTitle.length}/70`}>
          <input id="seoTitle" className={inputClass} value={c.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
        </Field>
        <Field label="Descripción" htmlFor="seoDescription" error={err("seoDescription")} hint={`${c.seoDescription.length}/160`}>
          <textarea id="seoDescription" className={textareaClass} value={c.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
        </Field>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Guardando…" : "Guardar"}</button>
        <Link href="/admin/categorias" className={secondaryButton}>Volver</Link>
        {saved && <span role="status" className="text-sm font-medium text-success">Guardado</span>}
        {c.id && <button type="button" onClick={remove} disabled={pending} className={`${dangerButton} ml-auto`}>Eliminar</button>}
      </div>
    </form>
  );
}
