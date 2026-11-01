import { describe, expect, it } from "vitest";
import { customPeriod, presetPeriod } from "@/lib/domain/periods";

// 1 de nov. 2026, 1:00 a. m. en RD (05:00 UTC)
const now = new Date("2026-11-01T05:00:00Z");

describe("períodos de reportes (hora de RD)", () => {
  it("este mes y mes anterior", () => {
    expect(presetPeriod("mes", now)).toMatchObject({ fromDate: "2026-11-01", toDate: "2026-11-02" });
    expect(presetPeriod("mes-anterior", now)).toMatchObject({ fromDate: "2026-10-01", toDate: "2026-11-01" });
    expect(presetPeriod("mes", now).fromUtc.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
  it("enero → mes anterior es diciembre del año previo", () => {
    expect(presetPeriod("mes-anterior", new Date("2027-01-15T15:00:00Z"))).toMatchObject({ fromDate: "2026-12-01", toDate: "2027-01-01" });
  });
  it("últimos 30 días y año", () => {
    expect(presetPeriod("30d", now)).toMatchObject({ fromDate: "2026-10-03", toDate: "2026-11-02" });
    expect(presetPeriod("anio", now)).toMatchObject({ fromDate: "2026-01-01", toDate: "2026-11-02" });
  });
  it("rango propio inclusivo y validado", () => {
    expect(customPeriod("2026-10-01", "2026-10-31")).toMatchObject({ fromDate: "2026-10-01", toDate: "2026-11-01" });
    expect(customPeriod("2026-10-31", "2026-10-01")).toBeNull();
    expect(customPeriod("2026-02-30", "2026-03-01")).toBeNull();
  });
});
