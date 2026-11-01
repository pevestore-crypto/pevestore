-- =====================================================================
-- PEVESTORE — esquema inicial
-- Dinero en centavos enteros (bigint). Instantes en timestamptz (UTC);
-- la zona America/Santo_Domingo se aplica al capturar y mostrar.
-- Los clientes NO tienen cuenta: pedidos, archivos y comprobantes solo los
-- escribe el servidor (service role). El público solo lee el catálogo activo.
-- =====================================================================

-- ---------- Utilidades -------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Administradores --------------------------------------------

create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'owner');
$$;

-- ---------- Configuración del negocio ----------------------------------
-- Una sola fila. Todo lo que aquí aparece es seguro de mostrar al público.

create table public.settings (
  id                     boolean primary key default true check (id),
  business_name          text not null default 'PEVESTORE',
  whatsapp_number        text,                 -- se configura en el panel
  contact_email          text,
  address                text,
  business_hours         text,
  -- Política de precios (decisión comercial)
  pricing_stacking       text not null default 'best_price'
                         check (pricing_stacking in ('best_price', 'promo_over_volume', 'stack')),
  rounding_unit          int  not null default 1 check (rounding_unit in (1, 100)),
  deposit_bps            int  not null default 5000 check (deposit_bps between 1 and 10000),
  -- Calendario de producción
  default_production_days int not null default 3 check (default_production_days >= 0),
  non_working_weekdays   int[] not null default '{0}',
  order_cutoff_hour      int check (order_cutoff_hour between 0 and 23),
  updated_at             timestamptz not null default now()
);
insert into public.settings (id) values (true);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

create table public.blocked_dates (
  date   date primary key,
  reason text
);

-- Condiciones comerciales versionadas: el pedido guarda la versión aceptada.
create table public.terms_versions (
  id          uuid primary key default gen_random_uuid(),
  version     int  not null unique,
  body        text not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index terms_one_current on public.terms_versions (is_current) where is_current;

create table public.bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  bank_code      text not null check (bank_code in ('banreservas', 'popular', 'bhd')),
  account_holder text not null,
  account_number text not null,
  account_type   text not null check (account_type in ('ahorros', 'corriente')),
  holder_id_doc  text,                          -- RNC o cédula, si el negocio lo muestra
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  updated_at     timestamptz not null default now()
);
create trigger bank_accounts_updated_at before update on public.bank_accounts
  for each row execute function public.set_updated_at();

-- ---------- Catálogo ---------------------------------------------------

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  description     text,
  image_path      text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  seo_title       text,
  seo_description text,
  updated_at      timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid references public.categories (id) on delete set null,
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null,
  short_description text,
  description       text,
  base_price_cents  bigint not null check (base_price_cents > 0),
  min_qty           int not null default 1 check (min_qty >= 1),
  max_qty           int not null default 10000 check (max_qty >= min_qty),
  production_days   int check (production_days >= 0),   -- null = usa el valor general
  allows_own_design boolean not null default true,
  allows_gallery    boolean not null default false,
  allows_idea       boolean not null default true,
  availability      text not null default 'available'
                    check (availability in ('available', 'on_request', 'unavailable')),
  is_active         boolean not null default false,       -- nace en borrador
  is_featured       boolean not null default false,
  sort_order        int not null default 0,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index products_category on public.products (category_id) where is_active;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt          text not null default '',
  sort_order   int not null default 0
);
create index product_images_product on public.product_images (product_id, sort_order);

create table public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  name              text not null,
  sku               text,
  price_delta_cents bigint not null default 0 check (price_delta_cents >= 0),
  is_active         boolean not null default true,
  sort_order        int not null default 0
);
create index product_variants_product on public.product_variants (product_id, sort_order);

-- Rangos por cantidad. Solapes y huecos se validan en la aplicación (validateTiers).
create table public.price_tiers (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  min_qty          int not null check (min_qty >= 1),
  max_qty          int check (max_qty is null or max_qty >= min_qty),
  unit_price_cents bigint not null check (unit_price_cents > 0),
  unique (product_id, min_qty)
);

create table public.product_surcharges (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products (id) on delete cascade,
  label              text not null,
  amount_cents       bigint not null check (amount_cents >= 0),
  per                text not null check (per in ('unit', 'order')),
  -- null = siempre; si no, solo con ese modo de personalización
  customization_mode text check (customization_mode in ('own_design', 'gallery', 'idea')),
  is_active          boolean not null default true
);

-- Galería de diseños disponibles por producto
create table public.designs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  storage_path text not null,
  is_active    boolean not null default true,
  sort_order   int not null default 0
);
create table public.design_products (
  design_id  uuid not null references public.designs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (design_id, product_id)
);

-- ---------- Promociones y banners --------------------------------------

create table public.promotions (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  product_id             uuid references public.products (id) on delete cascade,
  category_id            uuid references public.categories (id) on delete cascade,
  discount_kind          text not null check (discount_kind in ('percent', 'fixed_unit_price')),
  discount_bps           int check (discount_bps between 1 and 9999),
  fixed_unit_price_cents bigint check (fixed_unit_price_cents > 0),
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  message_style          text not null default 'fire' check (message_style in ('fire', 'last_days', 'gift')),
  headline               text,
  body                   text,
  cta_label              text,
  show_countdown         boolean not null default true,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((product_id is not null) <> (category_id is not null)),
  check (
    (discount_kind = 'percent' and discount_bps is not null and fixed_unit_price_cents is null) or
    (discount_kind = 'fixed_unit_price' and fixed_unit_price_cents is not null and discount_bps is null and product_id is not null)
  )
);
create index promotions_window on public.promotions (starts_at, ends_at) where is_active;
create trigger promotions_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();

-- Banners propios. El enlace debe ser interno: no se admite publicidad de terceros.
create table public.banners (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  subtitle           text,
  cta_label          text,
  cta_href           text check (cta_href ~ '^/[^/]'  or cta_href = '/'),
  image_desktop_path text not null,
  image_mobile_path  text,
  alt                text not null default '',
  starts_at          timestamptz,
  ends_at            timestamptz,
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  updated_at         timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check ((cta_label is null) = (cta_href is null))
);
create trigger banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

-- ---------- Servicios cotizables ---------------------------------------

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null,
  description       text,
  image_path        text,
  asks_measurements boolean not null default true,
  asks_material     boolean not null default true,
  is_active         boolean not null default true,
  sort_order        int not null default 0
);

-- ---------- Clientes y pedidos -----------------------------------------

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  whatsapp   text not null unique check (whatsapp ~ '^[0-9]{10,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create sequence public.order_number_seq start 1;

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  number              int  not null unique default nextval('public.order_number_seq'),
  code                text generated always as ('PEV-' || lpad(number::text, 6, '0')) stored,
  customer_id         uuid not null references public.customers (id),
  customer_name       text not null,               -- copia al momento del pedido
  customer_whatsapp   text not null,
  required_date       date not null,
  notes               text,
  status              text not null default 'pending_payment' check (status in (
                        'pending_payment', 'payment_review', 'confirmed', 'pending_design',
                        'in_production', 'ready_for_pickup', 'delivered', 'cancelled')),
  payment_plan        text not null check (payment_plan in ('deposit_50', 'full')),
  bank_account_id     uuid references public.bank_accounts (id) on delete set null,
  bank_snapshot       jsonb,                       -- banco/cuenta mostrados al cliente
  total_cents         bigint not null check (total_cents > 0),
  due_now_cents       bigint not null check (due_now_cents > 0),
  balance_cents       bigint not null check (balance_cents >= 0),
  paid_verified_cents bigint not null default 0 check (paid_verified_cents >= 0),
  terms_version       int not null references public.terms_versions (version),
  terms_accepted_at   timestamptz not null,
  tracking_token_hash text not null unique,        -- sha-256 del enlace privado de seguimiento
  estimated_date      date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  confirmed_at        timestamptz,
  check (due_now_cents + balance_cents = total_cents)
);
create index orders_status on public.orders (status, created_at desc);
create index orders_customer on public.orders (customer_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  product_id         uuid references public.products (id) on delete set null,
  variant_id         uuid references public.product_variants (id) on delete set null,
  product_name       text not null,
  variant_name       text,
  quantity           int not null check (quantity >= 1),
  unit_cents         bigint not null check (unit_cents >= 0),
  total_cents        bigint not null check (total_cents >= 0),
  customization_mode text check (customization_mode in ('own_design', 'gallery', 'idea')),
  design_id          uuid references public.designs (id) on delete set null,
  idea_text          text,
  pricing_snapshot   jsonb not null                -- desglose completo calculado por el servidor
);
create index order_items_order on public.order_items (order_id);

create table public.order_files (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete cascade,
  purpose       text not null check (purpose in ('design', 'reference', 'receipt')),
  bucket        text not null check (bucket in ('customer-files', 'receipts')),
  storage_path  text not null unique,
  mime          text not null,
  size_bytes    int  not null check (size_bytes > 0),
  original_name text,
  created_at    timestamptz not null default now()
);
create index order_files_order on public.order_files (order_id);

-- Pagos declarados por el cliente y verificados por el administrador.
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  bank_account_id  uuid references public.bank_accounts (id) on delete set null,
  receipt_file_id  uuid references public.order_files (id) on delete set null,
  declared_cents   bigint not null check (declared_cents > 0),
  verified_cents   bigint check (verified_cents >= 0),  -- lo que realmente llegó
  status           text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  verified_by      uuid references auth.users (id),
  verified_at      timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  check ((status = 'verified') = (verified_cents is not null and verified_at is not null))
);
create index payments_order on public.payments (order_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references auth.users (id),
  note        text,
  created_at  timestamptz not null default now()
);
create index order_status_history_order on public.order_status_history (order_id, created_at);

-- ---------- Cotizaciones de servicios ----------------------------------

create sequence public.quote_number_seq start 1;

create table public.quote_requests (
  id             uuid primary key default gen_random_uuid(),
  number         int  not null unique default nextval('public.quote_number_seq'),
  code           text generated always as ('COT-' || lpad(number::text, 6, '0')) stored,
  service_id     uuid references public.services (id) on delete set null,
  service_name   text not null,
  customer_name  text not null,
  whatsapp       text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  measurements   text,
  quantity       int check (quantity >= 1),
  material       text,
  required_date  date,
  description    text not null,
  status         text not null default 'new' check (status in ('new', 'quoted', 'won', 'lost')),
  created_at     timestamptz not null default now()
);

create table public.quote_files (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references public.quote_requests (id) on delete cascade,
  storage_path  text not null unique,
  mime          text not null,
  size_bytes    int  not null check (size_bytes > 0),
  original_name text,
  created_at    timestamptz not null default now()
);

-- ---------- Reglas de estados del pedido -------------------------------
-- Debe coincidir con src/lib/domain/order-status.ts (hay una prueba que lo verifica).

create or replace function public.order_transition_allowed(from_status text, to_status text) returns boolean
language sql immutable as $$
  select (from_status, to_status) in (
    ('pending_payment',  'payment_review'),
    ('pending_payment',  'cancelled'),
    ('payment_review',   'confirmed'),
    ('payment_review',   'pending_payment'),
    ('payment_review',   'cancelled'),
    ('confirmed',        'pending_design'),
    ('confirmed',        'in_production'),
    ('confirmed',        'cancelled'),
    ('pending_design',   'in_production'),
    ('pending_design',   'cancelled'),
    ('in_production',    'ready_for_pickup'),
    ('in_production',    'pending_design'),
    ('in_production',    'cancelled'),
    ('ready_for_pickup', 'delivered'),
    ('ready_for_pickup', 'in_production')
  );
$$;

create or replace function public.orders_guard_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not public.order_transition_allowed(old.status, new.status) then
      raise exception 'Cambio de estado no permitido: % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
    -- La confirmación exige que el anticipo (o el total) esté verificado.
    if new.status = 'confirmed' then
      if new.paid_verified_cents < new.due_now_cents then
        raise exception 'No se puede confirmar: pago verificado insuficiente'
          using errcode = 'check_violation';
      end if;
      new.confirmed_at := coalesce(new.confirmed_at, now());
    end if;
  end if;
  return new;
end $$;

create trigger orders_guard_status before update of status on public.orders
  for each row execute function public.orders_guard_status();

create or replace function public.orders_log_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by,
      note)
    values (new.id, old.status, new.status, auth.uid(),
      nullif(current_setting('pevestore.status_note', true), ''));
  end if;
  return null;
end $$;

create trigger orders_log_status after insert or update of status on public.orders
  for each row execute function public.orders_log_status();

-- El total verificado se recalcula a partir de los pagos: nunca se edita a mano.
create or replace function public.payments_sync_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
     set paid_verified_cents = coalesce((
           select sum(verified_cents) from public.payments
            where order_id = target and status = 'verified'), 0)
   where o.id = target;
  return null;
end $$;

create trigger payments_sync_order after insert or update or delete on public.payments
  for each row execute function public.payments_sync_order();

-- ---------- Seguridad a nivel de fila (RLS) ----------------------------

alter table public.admin_users          enable row level security;
alter table public.settings             enable row level security;
alter table public.blocked_dates        enable row level security;
alter table public.terms_versions       enable row level security;
alter table public.bank_accounts        enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.product_variants     enable row level security;
alter table public.price_tiers          enable row level security;
alter table public.product_surcharges   enable row level security;
alter table public.designs              enable row level security;
alter table public.design_products      enable row level security;
alter table public.promotions           enable row level security;
alter table public.banners              enable row level security;
alter table public.services             enable row level security;
alter table public.customers            enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_files          enable row level security;
alter table public.payments             enable row level security;
alter table public.order_status_history enable row level security;
alter table public.quote_requests       enable row level security;
alter table public.quote_files          enable row level security;

-- Lectura pública: solo catálogo activo y datos públicos del negocio.
create policy public_read on public.settings       for select using (true);
create policy public_read on public.blocked_dates  for select using (true);
create policy public_read on public.terms_versions for select using (is_current);
create policy public_read on public.bank_accounts  for select using (is_active);
create policy public_read on public.categories     for select using (is_active);
create policy public_read on public.products       for select using (is_active);
create policy public_read on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy public_read on public.product_variants for select using (is_active and
  exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy public_read on public.price_tiers for select using (
  exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy public_read on public.product_surcharges for select using (is_active and
  exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy public_read on public.designs         for select using (is_active);
create policy public_read on public.design_products for select using (true);
create policy public_read on public.promotions for select using (
  is_active and now() >= starts_at and now() < ends_at);
create policy public_read on public.banners for select using (
  is_active and (starts_at is null or now() >= starts_at) and (ends_at is null or now() < ends_at));
create policy public_read on public.services for select using (is_active);

-- Administradores: acceso completo a la operación.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'blocked_dates', 'terms_versions', 'bank_accounts', 'categories', 'products',
    'product_images', 'product_variants', 'price_tiers', 'product_surcharges', 'designs',
    'design_products', 'promotions', 'banners', 'services', 'customers', 'orders',
    'order_items', 'order_files', 'payments', 'quote_requests', 'quote_files'
  ] loop
    execute format('create policy admin_all on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- El historial no se edita ni se borra: solo lectura para administradores.
create policy admin_read on public.order_status_history for select using (public.is_admin());

-- Solo el dueño gestiona quién es administrador.
create policy self_read  on public.admin_users for select using (user_id = auth.uid() or public.is_owner());
create policy owner_all  on public.admin_users for all using (public.is_owner()) with check (public.is_owner());

-- ---------- Almacenamiento ---------------------------------------------
-- catalog: imágenes públicas de productos, banners y diseños.
-- customer-files y receipts: privados; el personal los ve con URLs firmadas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog',        'catalog',        true,  5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('customer-files', 'customer-files', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('receipts',       'receipts',       false, 8388608,  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy catalog_public_read on storage.objects for select
  using (bucket_id = 'catalog');
create policy catalog_admin_write on storage.objects for all
  using (bucket_id = 'catalog' and public.is_admin())
  with check (bucket_id = 'catalog' and public.is_admin());
create policy private_admin_read on storage.objects for select
  using (bucket_id in ('customer-files', 'receipts') and public.is_admin());
