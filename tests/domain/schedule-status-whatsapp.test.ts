import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, canTransition } from "@/lib/domain/order-status";
import { formatOrderNumber, parseOrderNumber } from "@/lib/domain/order-number";
import { countdownTo, promotionPhase } from "@/lib/domain/promotions";
import {
  businessDate,
  businessDateTimeToUtc,
  checkRequestedDate,
  earliestDeliveryDate,
  formatIsoDateLong,
} from "@/lib/domain/schedule";
import { checkUpload } from "@/lib/domain/uploads";
import { buildOrderMessage, isValidDominicanMobile, normalizeWhatsAppNumber, whatsappLink } from "@/lib/domain/whatsapp";

const cal = { nonWorkingWeekdays: [0], blockedDates: ["2026-12-25"] };

describe("calendario de producción (America/Santo_Domingo)", () => {
  it("usa la fecha local, no la UTC", () => {
    // 2 de dic. 02:00 UTC = 1 de dic. 22:00 en RD
    expect(businessDate(new Date("2026-12-02T02:00:00Z"))).toBe("2026-12-01");
  });

  it("convierte hora local del negocio a UTC (RD = UTC−4)", () => {
    expect(businessDateTimeToUtc("2026-12-20", "23:59").toISOString()).toBe("2026-12-21T03:59:00.000Z");
  });

  it("salta domingos y feriados", () => {
    // Martes 22 dic. + 3 días laborables: 23, 24, (25 feriado), 26 → sábado 26
    expect(earliestDeliveryDate(new Date("2026-12-22T14:00:00Z"), 3, cal)).toBe("2026-12-26");
    // Viernes 25 dic. no laborable, 0 días → siguiente laborable
    expect(earliestDeliveryDate(new Date("2026-12-25T14:00:00Z"), 0, cal)).toBe("2026-12-26");
    // Sábado + 1 → domingo no, lunes sí
    expect(earliestDeliveryDate(new Date("2026-12-26T14:00:00Z"), 1, cal)).toBe("2026-12-28");
  });

  it("respeta la hora de corte", () => {
    const late = new Date("2026-12-22T23:30:00Z"); // 19:30 en RD
    expect(earliestDeliveryDate(late, 1, { ...cal, cutoffHour: 18 })).toBe("2026-12-24");
    expect(earliestDeliveryDate(late, 1, cal)).toBe("2026-12-23");
  });

  it("rechaza fechas imposibles", () => {
    const now = new Date("2026-12-22T14:00:00Z");
    expect(checkRequestedDate("2026-12-23", now, 3, cal).ok).toBe(false);
    expect(checkRequestedDate("2026-12-27", now, 3, cal).ok).toBe(false); // domingo
    expect(checkRequestedDate("2026-02-30", now, 3, cal).ok).toBe(false);
    expect(checkRequestedDate("2026-12-28", now, 3, cal).ok).toBe(true);
  });

  it("formatea fechas en español", () => {
    expect(formatIsoDateLong("2026-12-18")).toBe("18 de diciembre de 2026");
  });
});

describe("promociones", () => {
  const p = { isActive: true, startsAt: "2026-12-01T04:00:00Z", endsAt: "2026-12-21T04:00:00Z" };
  it("fases y contador con fechas reales", () => {
    expect(promotionPhase(p, new Date("2026-11-30T00:00:00Z"))).toBe("scheduled");
    expect(promotionPhase(p, new Date("2026-12-10T00:00:00Z"))).toBe("running");
    expect(promotionPhase(p, new Date("2026-12-21T04:00:00Z"))).toBe("ended");
    expect(promotionPhase({ ...p, isActive: false }, new Date("2026-12-10T00:00:00Z"))).toBe("disabled");
    expect(countdownTo(p.endsAt, new Date("2026-12-18T22:30:00Z"))).toMatchObject({ days: 2, hours: 5, minutes: 30, seconds: 0 });
    expect(countdownTo(p.endsAt, new Date("2027-01-01T00:00:00Z")).totalMs).toBe(0);
  });
});

describe("estados del pedido", () => {
  it("solo permite transiciones definidas", () => {
    expect(canTransition("payment_review", "confirmed")).toBe(true);
    expect(canTransition("pending_payment", "confirmed")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(ORDER_STATUSES.every((s) => !canTransition(s, s))).toBe(true);
  });
});

describe("número de pedido", () => {
  it("formato PEV-000125", () => {
    expect(formatOrderNumber(125)).toBe("PEV-000125");
    expect(parseOrderNumber(" pev-000125 ")).toBe(125);
    expect(parseOrderNumber("PEV125")).toBe(125);
    expect(parseOrderNumber("125; drop table")).toBeNull();
  });
});

describe("WhatsApp", () => {
  it("normaliza números dominicanos", () => {
    expect(normalizeWhatsAppNumber("(809) 123-4567")).toBe("18091234567");
    expect(isValidDominicanMobile("829-555-0000")).toBe(true);
    expect(isValidDominicanMobile("305-555-0000")).toBe(false);
  });

  it("no genera enlace sin número configurado", () => {
    expect(() => whatsappLink("", "hola")).toThrow();
  });

  it("arma el mensaje del pedido con el formato acordado", () => {
    const text = buildOrderMessage({
      orderNumber: "PEV-000125",
      customerName: "Cliente de prueba",
      items: [{ name: "Taza personalizada", quantity: 12, customization: "Diseño suministrado" }],
      requiredDate: "18 de diciembre",
      totalCents: 330000,
      dueNowCents: 165000,
      balanceCents: 165000,
      bankName: "Banreservas",
      statusLabel: "Pago pendiente de verificación",
      receiptUploaded: true,
    });
    expect(text).toContain("Pedido: PEV-000125");
    expect(text).toContain("Cantidad: 12 unidades");
    expect(text).toContain("Total: RD$3,300");
    expect(text).toContain("Anticipo: RD$1,650");
    expect(text).toContain("Comprobante: Cargado en la plataforma");
    const link = whatsappLink("8091234567", text);
    expect(link.startsWith("https://wa.me/18091234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(text);
  });
});

describe("archivos subidos", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const pdf = new TextEncoder().encode("%PDF-1.7 xxxxxx");
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  it("acepta por contenido real y rechaza lo demás", () => {
    expect(checkUpload("design", 1000, png)).toMatchObject({ ok: true, kind: "png" });
    expect(checkUpload("receipt", 1000, pdf)).toMatchObject({ ok: true, mime: "application/pdf" });
    expect(checkUpload("design", 1000, exe).ok).toBe(false);
    expect(checkUpload("receipt", 20 * 1024 * 1024, png).ok).toBe(false);
    expect(checkUpload("design", 0, png).ok).toBe(false);
  });
});
