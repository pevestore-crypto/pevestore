-- Equipo administrativo: contraseña temporal obligatoria de cambiar.
alter table public.admin_users add column must_change_password boolean not null default false;

-- El propio usuario marca que ya cambió su contraseña temporal (no puede
-- tocar su rol ni nada más: solo esta bandera de su propia fila).
create or replace function public.admin_password_changed() returns void
language sql security definer set search_path = public as $$
  update public.admin_users set must_change_password = false where user_id = auth.uid();
$$;
revoke all on function public.admin_password_changed() from public, anon;
grant execute on function public.admin_password_changed() to authenticated;

-- Nunca dejar el negocio sin dueño.
create or replace function public.admin_users_keep_owner() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner') or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    if not exists (select 1 from public.admin_users where role = 'owner' and user_id <> old.user_id) then
      raise exception 'Debe quedar al menos un dueño' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger admin_users_keep_owner before update or delete on public.admin_users
  for each row execute function public.admin_users_keep_owner();
