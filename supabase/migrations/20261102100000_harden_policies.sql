-- =====================================================================
-- Endurecimiento según los revisores de Supabase (db advisors):
-- 1) search_path fijo en funciones (evita suplantación de objetos).
-- 2) Políticas de administrador solo para usuarios con sesión y con la
--    comprobación evaluada una vez por consulta, no por fila.
-- =====================================================================

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.order_transition_allowed(text, text) set search_path = public, pg_temp;
alter function public.orders_guard_status() set search_path = public, pg_temp;
alter function public.rate_limit_hit(text, int, int) set search_path = public, pg_temp;
alter function public.create_order(jsonb) set search_path = public, pg_temp;
alter function public.lookup_order(int, text) set search_path = public, pg_temp;
alter function public.submit_receipt(uuid, jsonb, bigint) set search_path = public, pg_temp;
alter function public.admin_users_keep_owner() set search_path = public, pg_temp;

-- Administradores: solo rol authenticated, is_admin() calculado una vez.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'blocked_dates', 'terms_versions', 'bank_accounts', 'categories', 'products',
    'product_images', 'product_variants', 'price_tiers', 'product_surcharges', 'designs',
    'design_products', 'promotions', 'banners', 'services', 'customers', 'orders',
    'order_items', 'order_files', 'payments', 'quote_requests', 'quote_files'
  ] loop
    execute format('drop policy admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

drop policy admin_read on public.order_status_history;
create policy admin_read on public.order_status_history for select to authenticated using ((select public.is_admin()));

drop policy self_read on public.admin_users;
drop policy owner_all on public.admin_users;
create policy self_read on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));
create policy owner_all on public.admin_users for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Almacenamiento
drop policy catalog_admin_write on storage.objects;
create policy catalog_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'catalog' and (select public.is_admin()))
  with check (bucket_id = 'catalog' and (select public.is_admin()));

drop policy private_admin_read on storage.objects;
create policy private_admin_read on storage.objects for select to authenticated
  using (bucket_id in ('customer-files', 'receipts') and (select public.is_admin()));
