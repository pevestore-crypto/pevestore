import "server-only";

/**
 * Verificación anti-bots de Cloudflare Turnstile en el servidor (siteverify).
 *
 * - Sin ninguna clave configurada (desarrollo): se omite.
 * - Con clave pública pero sin la secreta: se RECHAZA (falla cerrado), para
 *   que un error de configuración nunca deje los formularios abiertos.
 * - Si Cloudflare no responde: se permite; el límite por IP sigue activo.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!secret) {
    if (siteKey) {
      console.error("[turnstile] Falta TURNSTILE_SECRET_KEY: se rechazan los envíos hasta configurarla.");
      return false;
    }
    if (process.env.NODE_ENV === "production") console.warn("[turnstile] Sin claves configuradas: formularios sin protección anti-bots.");
    return true;
  }
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "local") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("[turnstile] verificación rechazada:", data["error-codes"]?.join(",") ?? "sin código");
    return data.success === true;
  } catch {
    return true;
  }
}

export const TURNSTILE_ERROR = "No pudimos verificar que no eres un robot. Vuelve a intentarlo.";
