-- Política de privacidad editable desde el panel (la publica el dueño).
alter table public.settings add column privacy_body text;
alter table public.settings add column privacy_updated_at timestamptz;

-- create_order guarda también el diseño elegido de la galería.
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
      total_cents, customization_mode, design_id, idea_text, pricing_snapshot)
    values (
      oid, (it->>'productId')::uuid, nullif(it->>'variantId', '')::uuid, it->>'productName',
      nullif(it->>'variantName', ''), (it->>'quantity')::int, (it->>'unitCents')::bigint,
      (it->>'totalCents')::bigint, nullif(it->>'customizationMode', ''), nullif(it->>'designId', '')::uuid,
      nullif(it->>'ideaText', ''), it->'pricingSnapshot');
  end loop;

  return query select oid, ocode;
end $$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
