import type { Metadata } from "next";
import { Suspense } from "react";
import { getCategory } from "@/lib/admin/catalog";
import type { CategoryInput } from "@/lib/admin/catalog-schema";
import { requireAdmin } from "@/lib/auth/dal";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Categoría" };

const empty: CategoryInput = {
  id: "",
  name: "",
  slug: "",
  description: "",
  sortOrder: 0,
  isActive: true,
  seoTitle: "",
  seoDescription: "",
};

export default function CategoryPage({ params }: PageProps<"/admin/categorias/[id]">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-background" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "nueva";
  const initial = isNew ? (await requireAdmin(), empty) : await getCategory(id);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{isNew ? "Nueva categoría" : initial.name}</h1>
      <CategoryForm key={initial.id || "nueva"} initial={initial} />
    </>
  );
}
