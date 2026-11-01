"use client";

/**
 * Reduce una foto en el navegador antes de subirla: máximo 1600 px por lado,
 * formato WebP. Una foto de celular de 6 MB queda en ~200-400 KB, lo que hace
 * que la tienda cargue rápido con datos móviles.
 */
export async function resizeToWebp(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Usa fotos JPG, PNG o WebP.");
  if (file.size > 25 * 1024 * 1024) throw new Error("La foto supera 25 MB.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo procesar la foto.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") throw new Error("El navegador no pudo convertir la foto a WebP.");
  return blob;
}
