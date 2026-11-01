import type { Metadata } from "next";
import { Suspense } from "react";
import type { BannerInput } from "@/lib/admin/banner-schema";
import { getBanner } from "@/lib/admin/banners";
import { requireAdmin } from "@/lib/auth/dal";
import { BannerForm } from "../banner-form";

export const metadata: Metadata = { title: "Banner" };

const empty: BannerInput = {
  id: "", title: "", subtitle: "", ctaLabel: "", ctaHref: "", imageDesktopPath: "", imageMobilePath: "", alt: "",
  startsLocal: "", endsLocal: "", isActive: true, sortOrder: 0,
};

export default function BannerPage({ params }: PageProps<"/admin/banners/[id]">) {
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
  const isNew = id === "nuevo";
  const initial = isNew ? (await requireAdmin(), empty) : await getBanner(id);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{isNew ? "Nuevo banner" : initial.title}</h1>
      <BannerForm key={initial.id || "nuevo"} initial={initial} />
    </>
  );
}
