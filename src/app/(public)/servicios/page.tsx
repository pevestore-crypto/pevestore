import type { Metadata } from "next";
import { Suspense } from "react";
import { IconTools } from "@/components/ui/icons";
import { type PublicService, getPublicSettings, getServices } from "@/lib/catalog/public";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = {
  title: "Servicios de impresión y rotulación",
  description: "Impresión de banners y vinilos, letreros, rotulación vehicular, señalética y trabajos especiales. Solicita tu cotización por WhatsApp.",
  alternates: { canonical: "/servicios" },
};

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6 lg:pt-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Servicios por cotización</h1>
      <p className="mt-2 max-w-2xl text-muted">Cada trabajo es distinto. Cuéntanos qué necesitas y te enviamos el precio por WhatsApp.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_28rem] lg:items-start">
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} id={s.slug} className="rounded-2xl border border-border bg-surface-raised p-4">
              <span className="mb-2 grid size-10 place-items-center rounded-full bg-brand-soft text-brand"><IconTools className="size-5" /></span>
              <h2 className="font-semibold">{s.name}</h2>
              {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
            </li>
          ))}
        </ul>

        <section aria-labelledby="h-cotizar" className="lg:sticky lg:top-24">
          <h2 id="h-cotizar" className="mb-3 text-lg font-bold">Solicitar cotización</h2>
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
            <Form services={services} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

async function Form({ services }: { services: PublicService[] }) {
  const settings = await getPublicSettings();
  return <QuoteForm services={services} whatsappNumber={settings.whatsappNumber} initialService={null} />;
}
