import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cómo comprar",
  description: "Compra en PEVESTORE sin crear cuenta: elige, personaliza, paga por transferencia y confirma por WhatsApp.",
  alternates: { canonical: "/como-comprar" },
};

const steps = [
  {
    title: "Elige tu producto",
    text: "Selecciona el modelo y la cantidad. El precio se calcula al instante e incluye los descuentos por cantidad y las ofertas vigentes.",
  },
  {
    title: "Personalízalo",
    text: "Sube tu diseño (JPG, PNG o PDF), elige uno de nuestra galería cuando esté disponible, o cuéntanos tu idea y adjunta imágenes de referencia. Antes de producir, PEVESTORE revisa o prepara el diseño final.",
  },
  {
    title: "Completa tus datos",
    text: "Solo necesitamos tu nombre, tu WhatsApp y la fecha en que lo necesitas. El sistema te muestra la primera fecha posible según el tiempo de producción. No tienes que crear cuenta.",
  },
  {
    title: "Paga por transferencia",
    text: "Elige pagar el 50 % como anticipo o el 100 %, y el banco: Banreservas, Banco Popular o Banco BHD. Verás el número de cuenta y el monto exacto. Guarda una captura de tu transferencia.",
  },
  {
    title: "Sube tu comprobante y confirma por WhatsApp",
    text: "Sube la captura en la página de tu pedido y pulsa “Continuar por WhatsApp” para enviarnos el resumen. Tu pedido queda “Pago por verificar”: lo confirmamos cuando el dinero llegue a la cuenta.",
  },
  {
    title: "Sigue tu pedido",
    text: "Guarda el enlace de tu pedido o consúltalo en “Consultar pedido” con tu número de pedido y tu WhatsApp. Verás si está en producción, listo para retirar y el saldo pendiente.",
  },
];

export default function HowToBuyPage() {
  return (
    <LegalPage title="Cómo comprar">
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-surface-raised p-4 sm:p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-bold text-brand-contrast">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/productos" className="rounded-full bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover">Ver productos</Link>
        <Link href="/condiciones" className="rounded-full border border-border px-6 py-3 font-semibold hover:bg-surface">Condiciones comerciales</Link>
      </div>
    </LegalPage>
  );
}
