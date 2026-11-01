import type { Metadata } from "next";
import { LegalPage, LegalText, NotPublished } from "@/components/layout/legal-page";
import { getLegalTexts } from "@/lib/catalog/public";
import { BUSINESS_TZ } from "@/lib/domain/schedule";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo PEVESTORE trata los datos personales de sus clientes.",
  alternates: { canonical: "/privacidad" },
};

const day = new Intl.DateTimeFormat("es-DO", { dateStyle: "long", timeZone: BUSINESS_TZ });

export default async function PrivacyPage() {
  const { privacy } = await getLegalTexts();
  return (
    <LegalPage title="Política de privacidad" updated={privacy?.updatedAt ? `Actualizada el ${day.format(new Date(privacy.updatedAt))}` : null}>
      {privacy ? <LegalText body={privacy.body} /> : <NotPublished what="La política de privacidad y sus detalles" />}
    </LegalPage>
  );
}
