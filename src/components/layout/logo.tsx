import Link from "next/link";

/**
 * Logotipo provisional en texto. Se reemplaza por el archivo oficial
 * (SVG) cuando el cliente lo entregue, sin tocar el resto del sitio.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="PEVESTORE, ir al inicio" className={`inline-flex items-baseline font-black italic tracking-tight ${className}`}>
      <span className="text-brand">PEVE</span>
      <span className="text-foreground">STORE</span>
    </Link>
  );
}
