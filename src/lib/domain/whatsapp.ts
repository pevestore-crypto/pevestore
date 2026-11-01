/**
 * Mensajes de WhatsApp con texto precargado (enlace oficial wa.me).
 * El pedido ya está guardado antes de generar el enlace: WhatsApp es solo un
 * canal de aviso, no el registro.
 */
import { formatDOP, type Cents } from "./money";

/** Deja solo dígitos con código de país. Números de 10 dígitos de RD reciben el 1. */
export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) return `1${digits}`;
  return digits;
}

export function isValidDominicanMobile(raw: string): boolean {
  return /^1(809|829|849)\d{7}$/.test(normalizeWhatsAppNumber(raw));
}

export function whatsappLink(businessNumber: string, text: string): string {
  const number = normalizeWhatsAppNumber(businessNumber);
  if (number.length < 10) throw new RangeError("El número de WhatsApp del negocio no está configurado.");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export interface OrderMessageData {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number; customization: string }[];
  requiredDate: string;
  totalCents: Cents;
  dueNowCents: Cents;
  balanceCents: Cents;
  bankName: string | null;
  statusLabel: string;
  receiptUploaded: boolean;
}

export function buildOrderMessage(d: OrderMessageData): string {
  const lines = [
    "*NUEVO PEDIDO — PEVESTORE*",
    "",
    `Pedido: ${d.orderNumber}`,
    `Cliente: ${d.customerName}`,
  ];
  for (const item of d.items) {
    lines.push(
      "",
      `Producto: ${item.name}`,
      `Cantidad: ${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`,
      `Personalización: ${item.customization}`,
    );
  }
  lines.push(
    "",
    `Fecha requerida: ${d.requiredDate}`,
    `Total: ${formatDOP(d.totalCents)}`,
    d.balanceCents > 0 ? `Anticipo: ${formatDOP(d.dueNowCents)}` : `Pago completo: ${formatDOP(d.dueNowCents)}`,
    `Saldo pendiente: ${formatDOP(d.balanceCents)}`,
  );
  if (d.bankName) lines.push(`Banco seleccionado: ${d.bankName}`);
  lines.push(
    `Estado: ${d.statusLabel}`,
    `Comprobante: ${d.receiptUploaded ? "Cargado en la plataforma" : "Pendiente de cargar"}`,
  );
  return lines.join("\n");
}

export interface QuoteMessageData {
  reference: string;
  customerName: string;
  serviceName: string;
  measurements?: string;
  quantity?: number;
  material?: string;
  requiredDate?: string;
  description: string;
  fileCount: number;
}

export function buildQuoteMessage(d: QuoteMessageData): string {
  const lines = ["*SOLICITUD DE COTIZACIÓN — PEVESTORE*", "", `Referencia: ${d.reference}`, `Cliente: ${d.customerName}`, `Servicio: ${d.serviceName}`];
  if (d.measurements) lines.push(`Medidas: ${d.measurements}`);
  if (d.quantity) lines.push(`Cantidad: ${d.quantity}`);
  if (d.material) lines.push(`Material: ${d.material}`);
  if (d.requiredDate) lines.push(`Fecha requerida: ${d.requiredDate}`);
  lines.push("", `Descripción: ${d.description}`);
  if (d.fileCount > 0) lines.push("", `Archivos de referencia: ${d.fileCount} cargado(s) en la plataforma`);
  return lines.join("\n");
}
