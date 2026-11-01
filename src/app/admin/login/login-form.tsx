"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { type LoginState, signIn } from "../actions";

const initial: LoginState = { error: null, email: "" };

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(signIn, initial);
  const error = state.error ?? (params.get("error") === "sin-acceso" ? "Esta cuenta no tiene acceso al panel." : null);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={params.get("next") ?? "/admin"} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.email}
          className="h-12 w-full rounded-xl border border-border bg-surface-raised px-4 text-base outline-none focus:border-brand"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-xl border border-border bg-surface-raised px-4 text-base outline-none focus:border-brand"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-contrast transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
