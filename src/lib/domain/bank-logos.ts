import { BANKS } from "@/lib/admin/settings-schema";

export type BankCode = keyof typeof BANKS;
/** Código del banco → URL pública de su logo (solo los que tienen uno subido). */
export type BankLogos = Partial<Record<BankCode, string>>;

/** Rutas guardadas en settings.bank_logos, solo con claves y valores válidos. */
export function parseBankLogoPaths(raw: unknown): Partial<Record<BankCode, string>> {
  const out: Partial<Record<BankCode, string>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [code, path] of Object.entries(raw)) {
    if (code in BANKS && typeof path === "string" && path) out[code as BankCode] = path;
  }
  return out;
}

/** Convierte settings.bank_logos en URLs públicas del bucket "catalog". */
export function bankLogoUrls(raw: unknown): BankLogos {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog/`;
  return Object.fromEntries(Object.entries(parseBankLogoPaths(raw)).map(([code, path]) => [code, base + path])) as BankLogos;
}
