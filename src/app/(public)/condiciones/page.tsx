import type { Metadata } from "next";
import { LegalPage, LegalText, NotPublished } from "@/components/layout/legal-page";
import { getLegalTexts } from "@/lib/catalog/public";
import { BUSINESS_TZ } from "@/lib/domain/schedule";

export const metadata: Metadata = {
  title: "Condiciones comerciales",
  description: "Condiciones de compra de PEVESTORE: anticipo, producción, cambios y retiro de pedidos.",
  alternates: { canonical: "/condiciones" },
};

const day = new Intl.DateTimeFormat("es-DO", { dateStyle: "long", timeZone: BUSINESS_TZ });

export default async function TermsPage() {
  const { terms } = await getLegalTexts();
  return (
    <LegalPage title="Condiciones comerciales" updated={terms ? `Versión ${terms.version} · vigente desde el ${day.format(new Date(terms.createdAt))}` : null}>
      {terms ? <LegalText body={terms.body} /> : <NotPublished what="Las condiciones comerciales" />}
    </LegalPage>
  );
}
