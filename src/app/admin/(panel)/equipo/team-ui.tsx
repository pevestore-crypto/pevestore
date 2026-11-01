"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field, FormError, inputClass, primaryButton, secondaryButton, dangerButton } from "@/components/admin/form-ui";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/admin/team-schema";
import { changeRole, createStaff, removeStaff, resetPassword } from "./actions";

export interface Member {
  userId: string;
  fullName: string;
  email: string;
  role: "owner" | "staff";
  mustChangePassword: boolean;
  lastSignIn: string | null;
  isMe: boolean;
}

export function NewMemberForm() {
  const router = useRouter();
  const [f, setF] = useState({ fullName: "", email: "", role: "staff" as "owner" | "staff", tempPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setDone(null);
          const r = await createStaff(f);
          if (!r.ok) return setErrors(r.errors);
          setErrors({});
          setDone(`Listo. Comparte con ${f.fullName.split(" ")[0]} su correo y la contraseña temporal por un medio privado; al entrar deberá cambiarla.`);
          setF({ fullName: "", email: "", role: "staff", tempPassword: "" });
          router.refresh();
        });
      }}
    >
      <Card title="Agregar persona al equipo" description="Crea su acceso con una contraseña temporal. En su primer ingreso el sistema le pedirá cambiarla.">
        <FormError message={errors._} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" htmlFor="m-name" error={errors.fullName}>
            <input id="m-name" className={inputClass} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </Field>
          <Field label="Correo" htmlFor="m-email" error={errors.email}>
            <input id="m-email" type="email" autoComplete="off" className={inputClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Rol" htmlFor="m-role" hint={ROLE_HINT[f.role]}>
            <select id="m-role" className={inputClass} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "owner" | "staff" })}>
              <option value="staff">{ROLE_LABEL.staff}</option>
              <option value="owner">{ROLE_LABEL.owner}</option>
            </select>
          </Field>
          <Field label="Contraseña temporal" htmlFor="m-pass" error={errors.tempPassword} hint="Mínimo 10 caracteres, con letras y números.">
            <input id="m-pass" type="text" autoComplete="new-password" className={inputClass} value={f.tempPassword} onChange={(e) => setF({ ...f, tempPassword: e.target.value })} />
          </Field>
        </div>
        {done && <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{done}</p>}
        <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Creando…" : "Crear acceso"}</button>
      </Card>
    </form>
  );
}

export function MemberRow({ m }: { m: Member }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [temp, setTemp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; errors?: Record<string, string> }>, after?: () => void) =>
    start(async () => {
      setError(null);
      setMsg(null);
      const r = await fn();
      if (!r.ok) return setError(Object.values(r.errors ?? {})[0] ?? "Error.");
      after?.();
      router.refresh();
    });

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{m.fullName}{m.isMe && <span className="text-muted"> (tú)</span>}</span>
          <span className="block truncate text-xs text-muted">
            {m.email}
            {m.mustChangePassword ? " · contraseña temporal pendiente de cambiar" : m.lastSignIn ? ` · último ingreso ${new Date(m.lastSignIn).toLocaleDateString("es-DO")}` : " · aún no ha entrado"}
          </span>
        </span>
        <label className="sr-only" htmlFor={`role-${m.userId}`}>Rol de {m.fullName}</label>
        <select
          id={`role-${m.userId}`}
          disabled={pending}
          value={m.role}
          onChange={(e) => run(() => changeRole({ userId: m.userId, role: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-surface-raised px-2 text-sm"
        >
          <option value="owner">{ROLE_LABEL.owner}</option>
          <option value="staff">{ROLE_LABEL.staff}</option>
        </select>
        {!m.isMe && (
          <>
            <button type="button" className={`${secondaryButton} h-9 px-3 text-sm`} onClick={() => setResetting((v) => !v)}>Nueva contraseña</button>
            <button
              type="button"
              disabled={pending}
              className={`${dangerButton} h-9 px-3 text-sm`}
              onClick={() => window.confirm(`¿Quitar a ${m.fullName} del equipo? Perderá el acceso al panel.`) && run(() => removeStaff(m.userId))}
            >
              Quitar
            </button>
          </>
        )}
      </div>
      {resetting && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface p-3">
          <Field label="Contraseña temporal" htmlFor={`temp-${m.userId}`} hint="Deberá cambiarla al entrar. Se cierran sus sesiones abiertas.">
            <input id={`temp-${m.userId}`} type="text" autoComplete="new-password" className={`${inputClass} h-10`} value={temp} onChange={(e) => setTemp(e.target.value)} />
          </Field>
          <button
            type="button"
            disabled={pending}
            className={`${primaryButton} h-10 text-sm`}
            onClick={() => run(() => resetPassword(m.userId, temp), () => { setResetting(false); setTemp(""); setMsg("Contraseña temporal asignada."); })}
          >
            Guardar
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      {msg && <p role="status" className="text-sm font-medium text-success">{msg}</p>}
    </li>
  );
}
