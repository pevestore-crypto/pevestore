-- =====================================================================
-- Guardado atómico de productos desde el panel.
-- Un producto con sus rangos, variantes y recargos se guarda completo o no
-- se guarda nada. Corre con los permisos del administrador (RLS aplica).
-- =====================================================================

create or replace function public.admin_save_product(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  pid uuid := nullif(p->>'id', '')::uuid;
  v jsonb;
  keep_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if pid is null then
    insert into public.products (
      category_id, slug, name, short_description, description, base_price_cents,
      min_qty, max_qty, production_days, allows_own_design, allows_gallery, allows_idea,
      availability, is_active, is_featured, sort_order, seo_title, seo_description)
    values (
      nullif(p->>'categoryId', '')::uuid, p->>'slug', p->>'name',
      nullif(p->>'shortDescription', ''), nullif(p->>'description', ''),
      (p->>'basePriceCents')::bigint, (p->>'minQty')::int, (p->>'maxQty')::int,
      nullif(p->>'productionDays', '')::int,
      (p->>'allowsOwnDesign')::boolean, (p->>'allowsGallery')::boolean, (p->>'allowsIdea')::boolean,
      p->>'availability', (p->>'isActive')::boolean, (p->>'isFeatured')::boolean,
      coalesce((p->>'sortOrder')::int, 0),
      nullif(p->>'seoTitle', ''), nullif(p->>'seoDescription', ''))
    returning id into pid;
  else
    update public.products set
      category_id       = nullif(p->>'categoryId', '')::uuid,
      slug              = p->>'slug',
      name              = p->>'name',
      short_description = nullif(p->>'shortDescription', ''),
      description       = nullif(p->>'description', ''),
      base_price_cents  = (p->>'basePriceCents')::bigint,
      min_qty           = (p->>'minQty')::int,
      max_qty           = (p->>'maxQty')::int,
      production_days   = nullif(p->>'productionDays', '')::int,
      allows_own_design = (p->>'allowsOwnDesign')::boolean,
      allows_gallery    = (p->>'allowsGallery')::boolean,
      allows_idea       = (p->>'allowsIdea')::boolean,
      availability      = p->>'availability',
      is_active         = (p->>'isActive')::boolean,
      is_featured       = (p->>'isFeatured')::boolean,
      sort_order        = coalesce((p->>'sortOrder')::int, 0),
      seo_title         = nullif(p->>'seoTitle', ''),
      seo_description   = nullif(p->>'seoDescription', '')
    where id = pid;
    if not found then
      raise exception 'Producto no encontrado' using errcode = 'no_data_found';
    end if;
  end if;

  -- Rangos por cantidad y recargos: nadie los referencia, se reemplazan.
  delete from public.price_tiers where product_id = pid;
  insert into public.price_tiers (product_id, min_qty, max_qty, unit_price_cents)
  select pid, (t->>'minQty')::int, nullif(t->>'maxQty', '')::int, (t->>'unitPriceCents')::bigint
    from jsonb_array_elements(coalesce(p->'tiers', '[]'::jsonb)) t;

  delete from public.product_surcharges where product_id = pid;
  insert into public.product_surcharges (product_id, label, amount_cents, per, customization_mode, is_active)
  select pid, s->>'label', (s->>'amountCents')::bigint, s->>'per',
         nullif(s->>'customizationMode', ''), coalesce((s->>'isActive')::boolean, true)
    from jsonb_array_elements(coalesce(p->'surcharges', '[]'::jsonb)) s;

  -- Variantes: los pedidos guardan variant_id, así que se conservan sus ids.
  select coalesce(array_agg((x->>'id')::uuid), '{}')
    into keep_ids
    from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb)) x
   where nullif(x->>'id', '') is not null;

  delete from public.product_variants where product_id = pid and not (id = any (keep_ids));

  for v in select * from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb)) loop
    if nullif(v->>'id', '') is null then
      insert into public.product_variants (product_id, name, sku, price_delta_cents, is_active, sort_order)
      values (pid, v->>'name', nullif(v->>'sku', ''), (v->>'priceDeltaCents')::bigint,
              coalesce((v->>'isActive')::boolean, true), coalesce((v->>'sortOrder')::int, 0));
    else
      update public.product_variants set
        name = v->>'name', sku = nullif(v->>'sku', ''),
        price_delta_cents = (v->>'priceDeltaCents')::bigint,
        is_active = coalesce((v->>'isActive')::boolean, true),
        sort_order = coalesce((v->>'sortOrder')::int, 0)
      where id = (v->>'id')::uuid and product_id = pid;
      if not found then
        raise exception 'Variante no encontrada' using errcode = 'no_data_found';
      end if;
    end if;
  end loop;

  return pid;
end $$;

-- Solo usuarios con sesión pueden invocarla (y dentro exige ser administrador).
revoke all on function public.admin_save_product(jsonb) from public;
grant execute on function public.admin_save_product(jsonb) to authenticated;
