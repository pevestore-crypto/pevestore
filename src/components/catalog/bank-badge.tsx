import Image from "next/image";
import { BANKS } from "@/lib/admin/settings-schema";

/**
 * Distintivo del banco: su logo (si el dueño lo subió en Configuración) o, si no,
 * una inicial con el color institucional. El nombre siempre se muestra en texto.
 * El logo va sobre fondo blanco para que se vea igual en modo claro y oscuro.
 */
export function BankBadge({ code, logoUrl, size = "md" }: { code: keyof typeof BANKS; logoUrl?: string | null; size?: "sm" | "md" }) {
  const bank = BANKS[code];
  const initial = bank.name.replace(/^Banco\s+/i, "").charAt(0);
  const box = size === "sm" ? "h-8 w-12" : "h-10 w-16";
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {logoUrl ? (
        <span className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1 ${box}`}>
          <Image src={logoUrl} alt="" width={128} height={80} className="h-full w-full object-contain" />
        </span>
      ) : (
        <span
          aria-hidden
          className={`grid shrink-0 place-items-center rounded-lg font-black text-white ${size === "sm" ? "size-8 text-xs" : "size-10 text-sm"}`}
          style={{ background: bank.color }}
        >
          {initial}
        </span>
      )}
      <span className="min-w-0 font-semibold">{bank.name}</span>
    </span>
  );
}
