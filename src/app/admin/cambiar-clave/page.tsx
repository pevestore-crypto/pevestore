import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { requireAdminForPasswordChange } from "@/lib/auth/dal";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default function ChangePasswordPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center"><Logo className="text-3xl" /></div>
        <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
          <Suspense fallback={<div className="h-80" aria-hidden />}>
            <Content />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Content() {
  const admin = await requireAdminForPasswordChange();
  return (
    <>
      <h1 className="text-xl font-bold">Cambiar contraseña</h1>
      {admin.mustChangePassword ? (
        <p className="mb-5 mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          Hola {admin.fullName.split(" ")[0]}: entraste con una contraseña temporal. Elige una propia para continuar.
        </p>
      ) : (
        <p className="mb-5 mt-1 text-sm text-muted">{admin.email}</p>
      )}
      <PasswordForm />
      {!admin.mustChangePassword && (
        <Link href="/admin" className="mt-4 block text-center text-sm text-muted hover:text-foreground">Volver al panel</Link>
      )}
    </>
  );
}
