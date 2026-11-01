import type { Metadata } from "next";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = {
  title: "Consultar mi pedido",
  description: "Consulta el estado de tu pedido en PEVESTORE con tu número de pedido y tu WhatsApp.",
  robots: { index: false, follow: true },
};

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-6 lg:pt-10">
      <h1 className="text-2xl font-bold">Consultar mi pedido</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Si guardaste el enlace que te dimos al hacer el pedido, ábrelo para ver todos los detalles.</p>
      <LookupForm />
    </div>
  );
}
