"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconUpload } from "@/components/ui/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { confirmReceipt, createReceiptUpload } from "../../actions";

export function ReceiptUpload({ code, token, hasReceipt }: { code: string; token: string; hasReceipt: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) return setError("El archivo supera 8 MB. Envía una captura de pantalla.");
    setStatus("Subiendo comprobante…");
    try {
      const ticket = await createReceiptUpload(code, token, file.type);
      if (!ticket.ok) throw new Error(ticket.error);
      const { error: upErr } = await createSupabaseBrowserClient().storage.from("receipts").uploadToSignedUrl(ticket.path, ticket.uploadToken, file, { contentType: file.type });
      if (upErr) throw new Error("No se pudo subir el archivo. Revisa tu conexión.");
      const r = await confirmReceipt(code, token, ticket.path, file.name);
      if (!r.ok) throw new Error(r.error);
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="space-y-2">
      <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={!!status} />
      <label
        htmlFor="receipt"
        className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-colors ${hasReceipt || done ? "border border-border hover:bg-surface" : "bg-brand text-brand-contrast hover:bg-brand-hover"} ${status ? "pointer-events-none opacity-60" : ""}`}
      >
        <IconUpload className="size-5" />
        {status ?? (hasReceipt || done ? "Subir otro comprobante" : "Subir comprobante de transferencia")}
      </label>
      {done && <p role="status" className="text-sm font-medium text-success">¡Recibido! Verificaremos tu transferencia y te confirmaremos por WhatsApp.</p>}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <p className="text-xs text-muted">Foto o captura (JPG, PNG, WebP) o PDF · máximo 8 MB. Se guarda de forma privada.</p>
    </div>
  );
}
