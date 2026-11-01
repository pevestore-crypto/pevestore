import { BANKS } from "@/lib/admin/settings-schema";

/**
 * Distintivo del banco con su nombre y color institucional.
 * Cuando PEVESTORE entregue los logotipos oficiales autorizados se colocan aquí.
 */
export function BankBadge({ code, size = "md" }: { code: keyof typeof BANKS; size?: "sm" | "md" }) {
  const bank = BANKS[code];
  const initial = bank.name.replace(/^Banco\s+/i, "").charAt(0);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-lg font-black text-white ${size === "sm" ? "size-7 text-xs" : "size-9 text-sm"}`}
        style={{ background: bank.color }}
      >
        {initial}
      </span>
      <span className="font-semibold">{bank.name}</span>
    </span>
  );
}
