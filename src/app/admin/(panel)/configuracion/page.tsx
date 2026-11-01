import type { Metadata } from "next";
import { Suspense } from "react";
import { getAdminSettings } from "@/lib/admin/settings";
import { BankAccounts, BlockedDates, BusinessForm, OrderRulesForm, TermsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-background" />}>
        <Forms />
      </Suspense>
    </div>
  );
}

async function Forms() {
  const s = await getAdminSettings();
  const missing = [
    !s.business.whatsappNumber && "el WhatsApp del negocio",
    !s.banks.some((b) => b.isActive) && "al menos una cuenta bancaria",
    !s.terms && "las condiciones comerciales",
  ].filter(Boolean);

  return (
    <div className="mt-6 space-y-4">
      {missing.length > 0 && (
        <p role="status" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Para recibir pedidos en línea falta configurar: <strong>{missing.join(", ")}</strong>.
        </p>
      )}
      <BusinessForm initial={s.business} />
      <BankAccounts initial={s.banks} isOwner={s.isOwner} />
      <TermsForm initial={s.terms} isOwner={s.isOwner} />
      <OrderRulesForm initial={s.rules} isOwner={s.isOwner} />
      <BlockedDates initial={s.blockedDates} />
    </div>
  );
}
