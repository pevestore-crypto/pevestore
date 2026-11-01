import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-sm font-semibold text-brand">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold">No encontramos esta página</h1>
      <p className="mt-3 text-muted">Puede que el producto ya no esté disponible o que la dirección esté mal escrita.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/productos" className="rounded-full bg-brand px-6 py-3 font-semibold text-brand-contrast hover:bg-brand-hover">Ver productos</Link>
        <Link href="/" className="rounded-full border border-border px-6 py-3 font-semibold hover:bg-surface">Ir al inicio</Link>
      </div>
    </div>
  );
}
