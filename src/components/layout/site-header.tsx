import Link from "next/link";
import { publicNav } from "@/lib/config/site";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { IconSearch } from "@/components/ui/icons";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:gap-6 lg:px-6">
        <MobileMenu />
        <Logo className="text-2xl lg:text-[1.7rem]" />

        <nav aria-label="Principal" className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-1">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SearchForm className="hidden w-72 xl:flex" />
          <ThemeToggle />
          <CartButton />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-3 lg:px-6 xl:hidden">
        <SearchForm />
      </div>
    </header>
  );
}

export function SearchForm({ className = "" }: { className?: string }) {
  return (
    <form action="/productos" role="search" className={`flex h-11 overflow-hidden rounded-xl border border-border bg-surface-raised focus-within:border-brand ${className}`}>
      <label htmlFor="q" className="sr-only">Buscar productos y servicios</label>
      <input
        id="q"
        name="q"
        type="search"
        placeholder="Buscar productos, servicios…"
        className="min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted"
      />
      <button type="submit" aria-label="Buscar" className="grid w-12 place-items-center bg-brand text-brand-contrast transition-colors hover:bg-brand-hover">
        <IconSearch className="size-5" />
      </button>
    </form>
  );
}
