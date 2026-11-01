/**
 * Dinero en centavos enteros (DOP). Nunca se opera con decimales flotantes:
 * RD$1,524.90 se representa como 152490.
 */
export type Cents = number;

/** Porcentajes en puntos básicos: 15 % = 1500. */
export type BasisPoints = number;

/**
 * Unidad a la que se redondean los importes cobrados.
 * 1 = al centavo, 100 = al peso entero. Es una decisión comercial (configurable).
 */
export type RoundingUnit = 1 | 100;

export function assertCents(value: number, label = "importe"): Cents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} inválido: ${value}`);
  }
  return value;
}

/** Redondeo "mitad hacia arriba" de una fracción entera numerador/denominador. */
function roundHalfUpDiv(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function roundTo(value: Cents, unit: RoundingUnit): Cents {
  return unit === 1 ? value : roundHalfUpDiv(value, unit) * unit;
}

/** Porción de un importe: percentOf(152490, 5000) = 76245 (50 %). */
export function percentOf(amount: Cents, bps: BasisPoints, unit: RoundingUnit = 1): Cents {
  assertCents(amount);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
    throw new RangeError(`Porcentaje inválido: ${bps}`);
  }
  const raw = roundHalfUpDiv(amount * bps, 10000);
  return roundTo(raw, unit);
}

export function pesosToCents(pesos: number): Cents {
  return assertCents(Math.round(pesos * 100));
}

const formatterWhole = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 });
const formatterCents = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** formatDOP(152490) → "RD$1,524.90"; formatDOP(150000) → "RD$1,500". */
export function formatDOP(value: Cents): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  const body = abs % 100 === 0 ? formatterWhole.format(abs / 100) : formatterCents.format(abs / 100);
  return `${negative ? "-" : ""}RD$${body}`;
}
