import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { primaryButton } from "@/components/admin/form-ui";
import { listBanners } from "@/lib/admin/banners";
import { catalogImageUrl } from "@/lib/admin/catalog";

export const metadata: Metadata = { title: "Banners" };

const TONE: Record<string, string> = {
  Visible: "bg-success-soft text-success",
  Programado: "bg-info-soft text-info",
  Terminado: "bg-surface text-muted",
  Pausado: "bg-warning-soft text-warning",
};

export default function BannersPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Banners</h1>
        <Link href="/admin/banners/nuevo" className={primaryButton}>Nuevo banner</Link>
      </div>
      <p className="mt-1 text-sm text-muted">Se muestran en el inicio, en orden. Solo promocionan productos y campañas de PEVESTORE.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const rows = await listBanners();
  if (!rows.length) return <p className="mt-6 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted">Sin banners. El inicio muestra el mensaje general de la tienda.</p>;
  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {rows.map((b) => (
        <li key={b.id}>
          <Link href={`/admin/banners/${b.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-surface sm:px-4">
            <span className="w-6 text-right text-xs tabular-nums text-muted">{b.sortOrder}</span>
            <span className="relative h-12 w-28 shrink-0 overflow-hidden rounded-lg bg-surface">
              <Image src={catalogImageUrl(b.imagePath)} alt="" fill sizes="112px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{b.title}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[b.phase]}`}>{b.phase}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
