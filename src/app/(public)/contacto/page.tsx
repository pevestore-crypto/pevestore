import type { Metadata } from "next";
import Link from "next/link";
import { IconWhatsApp } from "@/components/ui/icons";
import { getPublicSettings } from "@/lib/catalog/public";
import { whatsappLink } from "@/lib/domain/whatsapp";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos por WhatsApp para pedidos, cotizaciones y dudas. PEVESTORE, República Dominicana.",
  alternates: { canonical: "/contacto" },
};

function formatPhone(n: string) {
  const d = n.replace(/^1/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : n;
}

export default async function ContactPage() {
  const s = await getPublicSettings();
  const items = [
    s.address && { label: "Dirección", value: s.address },
    s.businessHours && { label: "Horario", value: s.businessHours },
    s.contactEmail && { label: "Correo", value: s.contactEmail, href: `mailto:${s.contactEmail}` },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 lg:pt-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Contacto</h1>
      <p className="mt-2 text-muted">La forma más rápida de hablar con nosotros es por WhatsApp.</p>

      {s.whatsappNumber ? (
        <a
          href={whatsappLink(s.whatsappNumber, "Hola PEVESTORE, tengo una consulta.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-semibold text-white hover:brightness-95"
        >
          <IconWhatsApp className="size-6" /> Escribir al {formatPhone(s.whatsappNumber)}
        </a>
      ) : (
        <p className="mt-6 rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted">Pronto publicaremos nuestros datos de contacto.</p>
      )}

      {items.length > 0 && (
        <dl className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {items.map((i) => (
            <div key={i.label} className="px-4 py-3">
              <dt className="text-xs font-medium text-muted">{i.label}</dt>
              <dd className="mt-0.5 whitespace-pre-line">{i.href ? <a href={i.href} className="text-brand hover:underline">{i.value}</a> : i.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/servicios" className="rounded-2xl border border-border p-4 hover:bg-surface">
          <p className="font-semibold">Cotizar un servicio</p>
          <p className="text-sm text-muted">Banners, letreros, rotulación y más.</p>
        </Link>
        <Link href="/consultar-pedido" className="rounded-2xl border border-border p-4 hover:bg-surface">
          <p className="font-semibold">Consultar mi pedido</p>
          <p className="text-sm text-muted">Con tu número de pedido y WhatsApp.</p>
        </Link>
      </div>
    </div>
  );
}
