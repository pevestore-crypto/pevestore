import Link from "next/link";
import { Logo } from "@/components/layout/logo";

/** Direcciones que no existen en ninguna sección del sitio. */
export default function GlobalNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Logo className="text-3xl" />
        <h1 className="mt-6 text-3xl font-bold">No encontramos esta página</h1>
        <p className="mt-3 text-muted">Revisa la dirección o vuelve al inicio.</p>
        <Link href="/" className="mt-8 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover">Ir al inicio</Link>
      </div>
    </main>
  );
}
