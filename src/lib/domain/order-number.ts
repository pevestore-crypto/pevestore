/**
 * Números visibles de pedido (PEV-000125) y de cotización (COT-000031).
 * El consecutivo lo entrega una secuencia de la base de datos; aquí solo se
 * formatea y valida. El número NO sirve para consultar datos privados.
 */
export function formatOrderNumber(sequence: number, prefix = "PEV"): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError(`Consecutivo inválido: ${sequence}`);
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

export function parseOrderNumber(input: string, prefix = "PEV"): number | null {
  const match = new RegExp(`^${prefix}-?(\\d{1,9})$`, "i").exec(input.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 ? n : null;
}
