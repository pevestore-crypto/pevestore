import { describe, expect, it } from "vitest";
import { bankLogoUrls, parseBankLogoPaths } from "@/lib/domain/bank-logos";

describe("logos de bancos", () => {
  it("ignora bancos desconocidos y valores que no son texto", () => {
    expect(parseBankLogoPaths({ popular: "banks/p.webp", otro: "x.webp", bhd: 5, banreservas: "" })).toEqual({ popular: "banks/p.webp" });
    expect(parseBankLogoPaths(null)).toEqual({});
    expect(parseBankLogoPaths("texto")).toEqual({});
  });

  it("arma la URL pública del bucket catalog", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    expect(bankLogoUrls({ bhd: "banks/bhd-1.webp" })).toEqual({ bhd: "https://ejemplo.supabase.co/storage/v1/object/public/catalog/banks/bhd-1.webp" });
  });
});
