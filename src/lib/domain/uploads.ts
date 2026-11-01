/**
 * Validación de archivos de clientes (diseños, referencias, comprobantes).
 * Se comprueba el contenido real (firma de bytes), no el nombre ni el tipo que
 * declara el navegador, que el cliente puede falsificar.
 */
export type AllowedFileKind = "jpg" | "png" | "pdf" | "webp";

export const UPLOAD_LIMITS = {
  design: { maxBytes: 15 * 1024 * 1024, kinds: ["jpg", "png", "pdf"] as AllowedFileKind[] },
  reference: { maxBytes: 10 * 1024 * 1024, kinds: ["jpg", "png", "webp", "pdf"] as AllowedFileKind[] },
  receipt: { maxBytes: 8 * 1024 * 1024, kinds: ["jpg", "png", "webp", "pdf"] as AllowedFileKind[] },
} as const;

export type UploadPurpose = keyof typeof UPLOAD_LIMITS;

export const MIME_BY_KIND: Record<AllowedFileKind, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  webp: "image/webp",
};

export function detectFileKind(head: Uint8Array): AllowedFileKind | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => head[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "jpg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export type UploadCheck = { ok: true; kind: AllowedFileKind; mime: string } | { ok: false; reason: string };

export function checkUpload(purpose: UploadPurpose, sizeBytes: number, head: Uint8Array): UploadCheck {
  const rule = UPLOAD_LIMITS[purpose];
  if (sizeBytes <= 0) return { ok: false, reason: "El archivo está vacío." };
  if (sizeBytes > rule.maxBytes) {
    return { ok: false, reason: `El archivo supera ${Math.round(rule.maxBytes / 1024 / 1024)} MB.` };
  }
  const kind = detectFileKind(head);
  if (!kind || !rule.kinds.includes(kind)) {
    return { ok: false, reason: `Formato no permitido. Usa ${rule.kinds.map((k) => k.toUpperCase()).join(", ")}.` };
  }
  return { ok: true, kind, mime: MIME_BY_KIND[kind] };
}

/** Nombre de almacenamiento aleatorio: nunca se usa el nombre que envía el cliente. */
export function storageObjectName(kind: AllowedFileKind, randomId: string): string {
  if (!/^[a-zA-Z0-9-]{16,}$/.test(randomId)) throw new RangeError("Identificador inválido");
  return `${randomId}.${kind}`;
}
