"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { primaryButton, textareaClass } from "@/components/admin/form-ui";
import { updateQuote } from "./actions";

const OPTIONS = [
  ["new", "Nueva"],
  ["quoted", "Cotizada"],
  ["won", "Aceptada"],
  ["lost", "No concretada"],
] as const;

export function QuoteEditor({ id, status, adminNote }: { id: string; status: string; adminNote: string }) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [note, setNote] = useState(adminNote);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateQuote({ id, status: s, adminNote: note });
          setMsg(r.ok ? "Guardado" : r.errors._);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado de la cotización">
        {OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={s === value}
            onClick={() => setS(value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${s === value ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="admin-note" className="mb-1 block text-xs font-medium">Nota interna (precio enviado, seguimiento…)</label>
        <textarea id="admin-note" className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${primaryButton} h-10 text-sm`}>{pending ? "Guardando…" : "Guardar"}</button>
        {msg && <span role="status" className="text-sm font-medium">{msg}</span>}
      </div>
    </form>
  );
}
