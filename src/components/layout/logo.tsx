import Image from "next/image";
import Link from "next/link";

/**
 * Logotipo oficial (vector extraído del PDF del cliente, sin fondo).
 * El contorno blanco se funde con fondos claros y enmarca las letras en
 * modo oscuro, así que el mismo archivo sirve para ambos temas.
 * El tamaño se controla con la altura (h-*); el ancho sigue la proporción.
 */
export function Logo({ className = "h-10" }: { className?: string }) {
  return (
    <Link href="/" aria-label="PEVESTORE, ir al inicio" className="inline-flex shrink-0">
      <Image
        src="/brand/pevestore-wordmark.svg"
        alt="PEVESTORE"
        width={328}
        height={100}
        unoptimized
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
