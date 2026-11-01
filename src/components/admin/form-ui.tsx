import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-xl border border-border bg-surface-raised px-3.5 text-base text-foreground outline-none focus:border-brand aria-[invalid=true]:border-danger sm:text-sm";
export const textareaClass =
  "min-h-24 w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-base text-foreground outline-none focus:border-brand aria-[invalid=true]:border-danger sm:text-sm";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-raised p-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-danger">{message}</p>;
}

export function StatusPill({ active, on = "Activo", off = "Inactivo" }: { active: boolean; on?: string; off?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? "bg-success-soft text-success" : "bg-surface text-muted"}`}>
      {active ? on : off}
    </span>
  );
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 font-semibold text-brand-contrast transition-colors hover:bg-brand-hover disabled:opacity-60";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 font-medium transition-colors hover:bg-surface disabled:opacity-60";
export const dangerButton =
  "inline-flex h-11 items-center justify-center rounded-xl px-4 font-medium text-danger transition-colors hover:bg-brand-soft disabled:opacity-60";
