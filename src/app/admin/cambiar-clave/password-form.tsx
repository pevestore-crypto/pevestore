"use client";

import { useActionState } from "react";
import { type PasswordState, changeOwnPassword } from "./actions";

const input = "h-12 w-full rounded-xl border border-border bg-surface-raised px-4 text-base outline-none focus:border-brand";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changeOwnPassword, { error: null });
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="current" className="block text-sm font-medium">Contraseña actual</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={input} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="next" className="block text-sm font-medium">Nueva contraseña</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={10} className={input} />
        <p className="text-xs text-muted">Mínimo 10 caracteres, con letras y números.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block text-sm font-medium">Repite la nueva contraseña</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={input} />
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-contrast hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
