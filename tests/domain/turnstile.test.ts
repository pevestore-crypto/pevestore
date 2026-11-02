import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyTurnstile } = await import("@/lib/security/turnstile");

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("verifyTurnstile", () => {
  it("falla cerrado: clave pública sin secreta rechaza y no llama a Cloudflare", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0xPUBLICA";
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verifyTurnstile("token", "1.2.3.4")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sin ninguna clave (desarrollo) deja pasar", async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstile(null, "local")).toBe(true);
  });

  it("con secreta: sin token rechaza; con token llama a siteverify y respeta la respuesta", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0xSECRETA";
    expect(await verifyTurnstile(null, "1.2.3.4")).toBe(false);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const sent = init?.body as URLSearchParams;
    expect(sent.get("secret")).toBe("0xSECRETA");
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("1.2.3.4");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] })));
    expect(await verifyTurnstile("malo", "1.2.3.4")).toBe(false);
  });
});
