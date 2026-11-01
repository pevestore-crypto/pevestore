-- =====================================================================
-- Pedidos sin cuenta: creación atómica, comprobantes y límite de abuso.
-- Estas funciones solo las ejecuta el servidor (service_role), que ya
-- recalculó precios, validó fechas y archivos. El público no puede invocarlas.
-- =====================================================================

-- ---------- Límite de solicitudes ----------
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;  -- sin políticas: solo service_role

-- Devuelve true si la solicitud está permitida (y la cuenta), false si excede el límite.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, ws, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  -- Limpieza oportunista de ventanas viejas.
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return n <= p_limit;
end $$;

-- ---------- Crear pedido ----------
create or replace function public.create_order(p jsonb)
returns table (id uuid, code text) language plpgsql as $$
declare
  cid uuid;
  oid uuid;
  ocode text;
  it jsonb;
begin
  insert into public.customers (full_name, whatsapp)
  values (p->>'customerName', p->>'customerWhatsapp')
  on conflict (whatsapp) do update set full_name = excluded.full_name
  returning customers.id into cid;

  insert into public.orders (
    customer_id, customer_name, customer_whatsapp, required_date, notes, payment_plan,
    bank_account_id, bank_snapshot, total_cents, due_now_cents, balance_cents,
    terms_version, terms_accepted_at, tracking_token_hash, estimated_date)
  values (
    cid, p->>'customerName', p->>'customerWhatsapp', (p->>'requiredDate')::date, nullif(p->>'notes', ''),
    p->>'paymentPlan', (p->>'bankAccountId')::uuid, p->'bankSnapshot',
    (p->>'totalCents')::bigint, (p->>'dueNowCents')::bigint, (p->>'balanceCents')::bigint,
    (p->>'termsVersion')::int, now(), p->>'trackingTokenHash', (p->>'requiredDate')::date)
  returning orders.id, orders.code into oid, ocode;

  for it in select * from jsonb_array_elements(p->'items') loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, quantity, unit_cents,
      total_cents, customization_mode, idea_text, pricing_snapshot)
    values (
      oid, (it->>'productId')::uuid, nullif(it->>'variantId', '')::uuid, it->>'productName',
      nullif(it->>'variantName', ''), (it->>'quantity')::int, (it->>'unitCents')::bigint,
      (it->>'totalCents')::bigint, nullif(it->>'customizationMode', ''), nullif(it->>'ideaText', ''),
      it->'pricingSnapshot');
  end loop;

  return query select oid, ocode;
end $$;

-- ---------- Comprobante de pago ----------
-- Guarda el archivo, el pago declarado (sin verificar) y pasa el pedido a "Pago por verificar".
create or replace function public.submit_receipt(p_order uuid, p_file jsonb, p_declared bigint)
returns uuid language plpgsql as $$
declare
  fid uuid;
  st text;
  bank uuid;
begin
  select status, bank_account_id into st, bank from public.orders where id = p_order for update;
  if st is null then raise exception 'Pedido no encontrado' using errcode = 'no_data_found'; end if;
  if st not in ('pending_payment', 'payment_review') then
    raise exception 'Este pedido ya no admite comprobantes' using errcode = 'check_violation';
  end if;

  insert into public.order_files (order_id, purpose, bucket, storage_path, mime, size_bytes, original_name)
  values (p_order, 'receipt', 'receipts', p_file->>'path', p_file->>'mime', (p_file->>'size')::int, nullif(p_file->>'name', ''))
  returning order_files.id into fid;

  insert into public.payments (order_id, bank_account_id, receipt_file_id, declared_cents)
  values (p_order, bank, fid, p_declared);

  if st = 'pending_payment' then
    update public.orders set status = 'payment_review' where id = p_order;
  end if;
  return fid;
end $$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
revoke all on function public.submit_receipt(uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.submit_receipt(uuid, jsonb, bigint) to service_role;
