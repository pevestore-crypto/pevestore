# Publicar PEVESTORE

Guía para poner la tienda en internet. Los pasos marcados **(tú)** requieren tus cuentas, pagos o decisiones; el resto lo hace o verifica el desarrollador.

## 0. Antes de empezar

- [ ] **(tú)** En Supabase → *Authentication → Sign In / Providers* (o *Settings*): **desactiva "Allow new users to sign up"**. La tienda no usa cuentas de clientes; los administradores se crean desde el panel → Equipo. Así nadie puede registrarse por su cuenta.
- [ ] **(tú)** Supabase → plan **Pro** (copias de seguridad diarias y sin pausa por inactividad). Activa también *Point-in-Time Recovery* si el presupuesto lo permite.
- [ ] **(tú)** Elimina el proyecto viejo de Supabase (`dhibtdmackujjnvbxwgx`) cuando confirmes que todo funciona en el nuevo (`dkinehikhwmdfnvlccmn`).

## 1. Claves anti-bots reales (Cloudflare Turnstile) — gratis

1. **(tú)** Entra a dash.cloudflare.com (crea la cuenta si no tienes) → **Turnstile** → *Add widget*.
2. Nombre: `PEVESTORE`. Dominios: tu dominio (ej. `pevestore.com`) y `localhost`.
3. Modo: **Managed**.
4. Guarda el **Site Key** y el **Secret Key** para el paso 3. No los compartas por chat.

## 2. Vercel

1. **(tú)** Crea una cuenta en vercel.com con **GitHub (`pevestore-crypto`)**. Plan **Pro** (el plan gratuito no permite uso comercial).
2. *Add New → Project* → importa el repositorio **`pevestore-crypto/pevestore`**.
3. Framework: **Next.js** (se detecta solo). No cambies los comandos de compilación.
4. Región de funciones: **Washington, D.C. (iad1)**, la más cercana a la base de datos (us-east-1).

## 3. Variables de entorno en Vercel

En el proyecto de Vercel → *Settings → Environment Variables* → entorno **Production** (y *Preview* si quieres):

| Variable | Valor | Marcar como *Sensitive* |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://tudominio.com` (sin barra final) | No |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dkinehikhwmdfnvlccmn.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la misma de `.env.local` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | la misma de `.env.local` | **Sí** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key **real** del paso 1 | No |
| `TURNSTILE_SECRET_KEY` | Secret Key **real** del paso 1 | **Sí** |

- **No** agregues `SUPABASE_DB_URL`: solo se usa desde la computadora para aplicar migraciones.
- **No** uses las claves de prueba de Turnstile (`1x000…`) en producción.
- Después de agregar o cambiar variables, haz **Redeploy**.

## 4. Dominio

1. **(tú)** Vercel → *Settings → Domains* → agrega tu dominio (ej. `pevestore.com` y `www.pevestore.com`).
2. En tu proveedor de dominio, crea los registros DNS que indique Vercel. El certificado HTTPS es automático.
3. Si el dominio es `.do` (NIC.DO), los cambios de DNS pueden tardar algunas horas.

## 5. Supabase: dirección del sitio

Supabase → *Authentication → URL Configuration*:
- **Site URL**: `https://tudominio.com`
- **Redirect URLs**: `https://tudominio.com/**`

## 6. Prueba completa antes de anunciar

Con datos reales cargados en el panel (WhatsApp, cuenta bancaria, condiciones, privacidad, al menos un producto):

- [ ] Abrir la tienda en el celular: inicio, catálogo, ficha de producto, modo oscuro.
- [ ] Hacer un **pedido real de prueba** (cantidad 1) → subir una captura cualquiera como comprobante → "Continuar por WhatsApp" llega al número del negocio.
- [ ] En el panel: ver el pedido, abrir el comprobante, **rechazarlo** con nota "prueba" y **cancelar** el pedido.
- [ ] Solicitar una cotización con un archivo → aparece en Cotizaciones.
- [ ] Consultar el pedido en "Consultar pedido" con número + WhatsApp.
- [ ] Revisar `https://tudominio.com/sitemap.xml` y `https://tudominio.com/robots.txt`.
- [ ] Registrar el sitio en **Google Search Console** y enviar el sitemap.

> El pedido y la cotización de prueba consumirán PEV-000001 y COT-000001. Si quieres que los primeros reales sean 000001, pide reiniciar la numeración después de borrarlos.

## Mantenimiento

- **Cambios de base de datos**: se aplican con `npx supabase db push --db-url "<SUPABASE_DB_URL>"` (ver `docs/ARQUITECTURA.md`).
- **Cambios de código**: cada `git push` a `main` publica automáticamente en Vercel.
- **Copias de seguridad**: Supabase Pro las hace a diario; además puedes exportar CSV de pagos desde Finanzas.
