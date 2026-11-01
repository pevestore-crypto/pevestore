import Link from "next/link";
import { IconArrowRight, IconBank, IconChat, IconHeadset, IconPackage, IconShield, IconTruck, IconUpload } from "@/components/ui/icons";

const benefits = [
  { title: "Producción con calidad", Icon: IconTruck },
  { title: "Personalización a tu gusto", Icon: IconShield },
  { title: "Atención por WhatsApp", Icon: IconHeadset },
];

const steps = [
  { title: "Elige tu producto", text: "Selecciona cantidad y variante. Ves el precio al instante.", Icon: IconPackage },
  { title: "Personalízalo", text: "Sube tu diseño, elige uno de la galería o cuéntanos tu idea.", Icon: IconUpload },
  { title: "Paga por transferencia", text: "Anticipo del 50 % o pago completo. Sube tu comprobante.", Icon: IconBank },
  { title: "Confirma por WhatsApp", text: "Te avisamos cuando verifiquemos el pago y tu pedido entre a producción.", Icon: IconChat },
];

export default function HomePage() {
  return (
    <>
      {/* Banner principal: lo reemplaza el carrusel administrable cuando haya banners activos. */}
      <section aria-label="Promoción principal" className="mx-auto max-w-7xl px-4 pt-4 lg:px-6 lg:pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#111111] px-6 py-10 text-white sm:px-10 sm:py-14 lg:py-20">
          <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-brand/40 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 right-1/4 size-72 rounded-full bg-brand/25 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Impresión y personalización
            </p>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
              Lo que imaginas, <span className="text-brand">impreso</span> con calidad.
            </h1>
            <p className="mt-4 text-base text-white/80 sm:text-lg">
              Tazas, termos, camisetas, mesas de dominó, rotulación y publicidad para ti y tu empresa.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/productos" className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-brand-contrast transition-colors hover:bg-brand-hover">
                Ver productos <IconArrowRight className="size-5" />
              </Link>
              <Link href="/servicios" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 font-semibold transition-colors hover:bg-white/10">
                Cotizar un servicio
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Por qué PEVESTORE" className="mx-auto max-w-7xl px-4 pt-4 lg:px-6">
        <ul className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface-raised">
          {benefits.map(({ title, Icon }) => (
            <li key={title} className="flex flex-col items-center gap-2 px-2 py-4 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
              <Icon className="size-7 shrink-0 text-brand" />
              <span className="text-xs font-semibold sm:text-sm">{title}</span>
            </li>
          ))}
        </ul>
      </section>

      <Section title="Categorías" href="/productos" linkLabel="Ver todas">
        <EmptyState text="Las categorías aparecerán aquí cuando se carguen desde el panel." />
      </Section>

      <Section title="Ofertas especiales" href="/ofertas" linkLabel="Ver ofertas">
        <EmptyState text="No hay ofertas activas en este momento." />
      </Section>

      <Section title="Productos populares" href="/productos" linkLabel="Ver catálogo">
        <EmptyState text="Los productos destacados aparecerán aquí." />
      </Section>

      <Section title="Servicios por cotización" href="/servicios" linkLabel="Ver servicios">
        <EmptyState text="Banners, vinilos, letreros, rotulación vehicular y más: cotiza por WhatsApp." />
      </Section>

      <section aria-labelledby="como-comprar" className="mx-auto max-w-7xl px-4 pt-14 lg:px-6">
        <h2 id="como-comprar" className="text-2xl font-bold">Cómo comprar</h2>
        <p className="mt-1 text-muted">Sin crear cuenta. Rápido y desde tu celular.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, text, Icon }, i) => (
            <li key={title} className="rounded-2xl border border-border bg-surface-raised p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold text-muted">Paso {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Section({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={id} className="mx-auto max-w-7xl px-4 pt-12 lg:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id={id} className="text-2xl font-bold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          {linkLabel} <IconArrowRight className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted">{text}</p>;
}
