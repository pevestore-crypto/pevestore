import Link from "next/link";
import { Suspense } from "react";
import { adminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { requireAdmin } from "@/lib/auth/dal";
import { signOut } from "../actions";

/**
 * Marco del panel. No lee la sesión en su nivel superior (se prerenderiza);
 * el usuario aparece en un componente dentro de <Suspense> y cada página
 * verifica el acceso por su cuenta en la capa de datos.
 */
export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden flex-col bg-[#111111] text-white lg:flex">
        <div className="px-5 py-6">
          <Link href="/admin" className="text-2xl font-black italic tracking-tight">
            <span className="text-brand">PEVE</span>STORE
          </Link>
          <p className="mt-1 text-xs text-white/60">Panel administrativo</p>
        </div>
        <nav aria-label="Panel" className="flex-1 px-3">
          <ul className="space-y-1">
            {adminNav.map((item) => (
              <li key={item.href}>
                {item.ready ? (
                  <Link href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10">
                    {item.label}
                  </Link>
                ) : (
                  <span className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white/40">
                    {item.label}
                    <span className="text-[10px] uppercase tracking-wider">pronto</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-4">
          <Suspense fallback={<div className="h-10" />}>
            <UserBox dark />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
          <Link href="/admin" className="text-xl font-black italic tracking-tight">
            <span className="text-brand">PEVE</span>STORE
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={null}>
              <UserBox />
            </Suspense>
          </div>
        </header>
        <nav aria-label="Panel" className="overflow-x-auto border-b border-border bg-background lg:hidden">
          <ul className="flex gap-1 px-3 py-2">
            {adminNav.map((item) => (
              <li key={item.href} className="shrink-0">
                {item.ready ? (
                  <Link href={item.href} className="block rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">
                    {item.label}
                  </Link>
                ) : (
                  <span className="block rounded-full px-3 py-1.5 text-sm text-muted">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <main id="contenido" className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

async function UserBox({ dark = false }: { dark?: boolean }) {
  const admin = await requireAdmin();
  return (
    <div className="flex items-center gap-3">
      <div className={`min-w-0 ${dark ? "" : "hidden sm:block"}`}>
        <p className="truncate text-sm font-semibold">{admin.fullName}</p>
        <p className={`truncate text-xs ${dark ? "text-white/60" : "text-muted"}`}>
          {admin.role === "owner" ? "Dueño" : "Personal"}
        </p>
      </div>
      <form action={signOut} className="ml-auto">
        <button
          type="submit"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${dark ? "hover:bg-white/10" : "hover:bg-surface"}`}
        >
          Salir
        </button>
      </form>
    </div>
  );
}
