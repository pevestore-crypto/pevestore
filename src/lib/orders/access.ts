import "server-only";
import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { parseOrderNumber } from "@/lib/domain/order-number";
import { checkUpload, type UploadPurpose } from "@/lib/domain/uploads";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashToken } from "./checkout";

/**
 * Acceso del cliente a SU pedido: número + token secreto del enlace privado.
 * Solo se guarda el hash del token; la comparación es en tiempo constante.
 */
export async function findOrderByToken(code: string, token: string) {
  const number = parseOrderNumber(code);
  if (!number || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = createSupabaseServiceClient();
  const { data } = await db.from("orders").select("*").eq("number", number).maybeSingle();
  if (!data) return null;
  const a = Buffer.from(data.tracking_token_hash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return data;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** true = permitido. Si la BD falla, se permite (no bloquear ventas por un contador). */
export async function allowRequest(kind: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = createSupabaseServiceClient();
  const { data, error } = await db.rpc("rate_limit_hit", { p_key: `${kind}:${await clientIp()}`, p_limit: limit, p_window_seconds: windowSeconds });
  return error ? true : Boolean(data);
}

/**
 * Comprueba el archivo ya subido leyendo sus primeros bytes (firma real),
 * no lo que declaró el navegador. Si no es válido, lo elimina.
 */
export async function verifyStoredFile(bucket: "customer-files" | "receipts", path: string, purpose: UploadPurpose) {
  const db = createSupabaseServiceClient();
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data: list } = await db.storage.from(bucket).list(folder, { search: name, limit: 1 });
  const obj = list?.find((o) => o.name === name);
  if (!obj) return { ok: false as const, reason: "El archivo no llegó. Inténtalo de nuevo." };

  const { data: signed } = await db.storage.from(bucket).createSignedUrl(path, 60);
  const res = signed ? await fetch(signed.signedUrl, { headers: { Range: "bytes=0-31" } }) : null;
  const head = res?.ok ? new Uint8Array(await res.arrayBuffer()).slice(0, 32) : new Uint8Array();
  const size = Number(obj.metadata?.size ?? 0);
  const check = checkUpload(purpose, size, head);
  if (!check.ok) {
    await db.storage.from(bucket).remove([path]);
    return { ok: false as const, reason: check.reason };
  }
  return { ok: true as const, mime: check.mime, size };
}
