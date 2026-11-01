-- Cotizaciones: nota interna del personal.
alter table public.quote_requests add column admin_note text;
create index quote_requests_status on public.quote_requests (status, created_at desc);

-- Consulta de pedido sin enlace: requiere número de pedido Y el WhatsApp con
-- que se hizo. Devuelve solo datos no sensibles (sin nombre, archivos ni cuenta).
create or replace function public.lookup_order(p_number int, p_whatsapp text)
returns table (code text, status text, required_date date, estimated_date date, total_cents bigint, paid_verified_cents bigint, created_at timestamptz)
language sql stable as $$
  select o.code, o.status, o.required_date, o.estimated_date, o.total_cents, o.paid_verified_cents, o.created_at
    from public.orders o
   where o.number = p_number and o.customer_whatsapp = p_whatsapp;
$$;

revoke all on function public.lookup_order(int, text) from public, anon, authenticated;
grant execute on function public.lookup_order(int, text) to service_role;
