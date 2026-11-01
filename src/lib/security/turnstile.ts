import "server-only";

/**
 * Verificación anti-bots de Cloudflare Turnstile en el servidor.
 * Sin TURNSTILE_SECRET_KEY configurada se omite (desarrollo); en producción
 * debe configurarse siempre.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") console.warn("[turnstile] TURNSTILE_SECRET_KEY no configurada: formularios sin protección anti-bots.");
    return true;
  }
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "local") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Si Cloudflare no responde no se bloquean ventas; el límite por IP sigue activo.
    return true;
  }
}

export const TURNSTILE_ERROR = "No pudimos verificar que no eres un robot. Vuelve a intentarlo.";
