import Link from "next/link";
import { developer, publicNav, site } from "@/lib/config/site";
import { Logo } from "./logo";

/** Los datos de contacto (dirección, horario, teléfono) vienen de `settings`. */
export interface FooterContact {
  address?: string | null;
  businessHours?: string | null;
  email?: string | null;
}

export function SiteFooter({ contact }: { contact?: FooterContact }) {
  return (
    <footer className="mt-16 border-t border-border bg-surface pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="space-y-3">
          <Logo className="h-12" />
          <p className="max-w-xs text-sm text-muted">{site.tagline}.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Navegación</h2>
          <ul className="space-y-2 text-sm text-muted">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Compra segura</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/como-comprar" className="hover:text-foreground">Cómo comprar</Link></li>
            <li><Link href="/condiciones" className="hover:text-foreground">Condiciones comerciales</Link></li>
            <li><Link href="/privacidad" className="hover:text-foreground">Política de privacidad</Link></li>
          </ul>
        </div>
        {contact && (contact.address || contact.businessHours || contact.email) && (
          <div>
            <h2 className="mb-3 text-sm font-semibold">Contacto</h2>
            <address className="space-y-2 text-sm not-italic text-muted">
              {contact.address && <p>{contact.address}</p>}
              {contact.businessHours && <p>{contact.businessHours}</p>}
              {contact.email && <p><a href={`mailto:${contact.email}`} className="hover:text-foreground">{contact.email}</a></p>}
            </address>
          </div>
        )}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted lg:px-6">
          <p>© {site.name}. República Dominicana.</p>
          <p>
            Desarrollado por{" "}
            <a href={developer.url} target="_blank" rel="noopener" className="font-medium text-foreground hover:text-brand hover:underline">
              {developer.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
