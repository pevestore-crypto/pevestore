-- =====================================================================
-- Operaciones del panel sobre pedidos. Corren con los permisos del
-- administrador (RLS aplica) y registran quién hizo qué.
-- =====================================================================

-- Cambiar estado con nota opcional (queda en order_status_history).
-- Las reglas de transición y "confirmar solo con pago verificado" las
-- impone el trigger orders_guard_status.
create or replace function public.admin_set_order_status(p_order uuid, p_status text, p_note text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform set_config('pevestore.status_note', coalesce(p_note, ''), true);
  update public.orders set status = p_status where id = p_order;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'no_data_found';
  end if;
end $$;

-- Verificar o rechazar un pago declarado. Verificar = el dinero llegó a la cuenta.
create or replace function public.admin_review_payment(p_payment uuid, p_verified_cents bigint, p_note text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_verified_cents is null then
    update public.payments
       set status = 'rejected', verified_cents = null, verified_at = null, verified_by = auth.uid(), note = p_note
     where id = p_payment and status = 'pending';
  else
    if p_verified_cents <= 0 then
      raise exception 'El monto verificado debe ser mayor que cero' using errcode = 'check_violation';
    end if;
    update public.payments
       set status = 'verified', verified_cents = p_verified_cents, verified_at = now(), verified_by = auth.uid(), note = p_note
     where id = p_payment and status = 'pending';
  end if;
  if not found then
    raise exception 'El pago ya fue revisado o no existe' using errcode = 'no_data_found';
  end if;
end $$;

revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
revoke all on function public.admin_review_payment(uuid, bigint, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated;
grant execute on function public.admin_review_payment(uuid, bigint, text) to authenticated;
