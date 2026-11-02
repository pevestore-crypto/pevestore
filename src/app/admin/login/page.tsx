import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso al panel" };

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="h-14" />
          <p className="mt-2 text-sm text-muted">Panel administrativo</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
          <h1 className="mb-5 text-xl font-bold">Iniciar sesión</h1>
          <Suspense fallback={<div className="h-64" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
