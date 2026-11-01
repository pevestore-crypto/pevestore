import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated?: string | null; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-6 lg:pt-10">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted">{updated}</p>}
      <div className="mt-6">{children}</div>
    </article>
  );
}

export function LegalText({ body }: { body: string }) {
  return <div className="whitespace-pre-line rounded-2xl border border-border bg-surface-raised p-5 text-sm leading-relaxed sm:text-base">{body}</div>;
}

export function NotPublished({ what }: { what: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
      {what} están en preparación. Si tienes dudas, <Link href="/contacto" className="font-semibold text-brand hover:underline">escríbenos</Link>.
    </p>
  );
}
