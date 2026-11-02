# PEVESTORE — Arquitectura

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Web y servidor | Next.js 16 (App Router) + React 19 + TypeScript | Un solo proyecto para tienda, panel y API; buen SEO y rendimiento móvil |
| Estilos | Tailwind CSS 4 con tokens propios | Modo claro/oscuro y ajuste de marca desde un solo archivo |
| Datos, autenticación y archivos | Supabase (Postgres + Auth + Storage) | RLS, buckets privados, copias de seguridad en plan Pro |
| Hosting | Vercel Pro (uso comercial) | Despliegue automático |
| Pruebas | Vitest + PGlite (Postgres en memoria) | La lógica de negocio y las reglas de la BD se prueban sin servicios externos |

## Estructura

```
src/
  app/(public)/        Tienda pública (inicio, productos, ofertas, servicios, consulta, contacto)
  app/admin/           Panel administrativo (separado, con sesión obligatoria) — pendiente
  components/layout/   Encabezado, menú móvil, barra inferior, pie
  components/theme/    Modo claro/oscuro sin parpadeo
  components/ui/       Íconos y piezas reutilizables
  lib/config/site.ts   Datos fijos de marca (lo que cambia va en la tabla settings)
  lib/domain/          Reglas de negocio puras y probadas:
    money.ts           Centavos enteros, redondeo, formato RD$
    pricing.ts         Motor de precios, rangos por cantidad, ofertas, anticipo/saldo
    promotions.ts      Vigencia y contador regresivo con fechas reales
    schedule.ts        Calendario de producción en America/Santo_Domingo
    order-status.ts    Estados del pedido y transiciones permitidas
    order-number.ts    PEV-000125 / COT-000031
    whatsapp.ts        Mensajes y enlaces wa.me
    uploads.ts         Validación de archivos por contenido real
supabase/
  migrations/          Esquema, RLS, triggers y buckets
  seed.sql             Categorías y servicios definidos por el cliente
tests/                 Pruebas de dominio y de base de datos
```

## Reglas que impone la base de datos (no solo la aplicación)

- Los clientes no tienen cuenta: el público **solo lee** el catálogo activo. Pedidos, clientes, archivos y pagos se escriben desde el servidor con la clave secreta.
- Un pedido **no puede pasar a Confirmado** sin pagos verificados que cubran el anticipo.
- Los pagos declarados no cuentan como dinero recibido: `paid_verified_cents` se recalcula solo con pagos verificados.
- Las transiciones de estado son las mismas en SQL y en TypeScript (una prueba lo verifica) y cada cambio queda en el historial.
- Anticipo + saldo = total, siempre.
- Los banners solo pueden enlazar dentro del sitio: no admiten publicidad de terceros.
- Los comprobantes y archivos de clientes están en buckets privados; el personal los ve con URLs firmadas temporales.
- Cada línea de pedido guarda el desglose de precios aplicado: un cambio futuro de precios no altera pedidos anteriores.

## Seguimiento de pedidos

El número de pedido **no** basta para consultar. Al finalizar, el cliente recibe un enlace privado con un token aleatorio (en la BD se guarda solo su hash). Como alternativa: número de pedido + WhatsApp, con límite de intentos, mostrando solo el estado, la fecha y el saldo. El código por WhatsApp (OTP) requiere la API de WhatsApp Business y queda para más adelante.

## Decisiones comerciales pendientes (configurables, sin tocar código)

| Decisión | Opciones | Valor inicial |
|---|---|---|
| Oferta + descuento por volumen | `best_price` (gana el menor), `promo_over_volume`, `stack` (se suman) | `best_price` |
| Redondeo | al centavo, al peso | al centavo |
| Anticipo | % del total | 50 % |
| Días sin producción, feriados, hora de corte | calendario en el panel | domingo |

## Pendiente del cliente

Logotipo oficial (SVG), fotos de productos, precios y rangos reales, número de WhatsApp empresarial, cuentas bancarias (las carga el administrador), condiciones comerciales, dirección/horario y política de privacidad (Ley 172-13).

## Aplicar cambios a la base de datos

Las migraciones están en `supabase/migrations/`. Se aplican al proyecto de Supabase con la cadena de conexión (Session pooler) de `.env.local`:

```bash
npx supabase db push --db-url "<SUPABASE_DB_URL>"
```

Primero con `--dry-run` para ver qué se aplicará. `npx supabase db advisors --db-url "<…>"` revisa seguridad y rendimiento.

## Comandos

```bash
npm run dev        # servidor local
npm test           # pruebas
npm run typecheck  # tipos
npm run lint       # estilo
```
