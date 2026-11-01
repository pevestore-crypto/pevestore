"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Sin permiso de portapapeles: el número sigue visible para copiarlo a mano.
        }
      }}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface"
      aria-label={label}
    >
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
