-- Supabase concede EXECUTE a anon por privilegios por defecto; la función ya
-- exige is_admin(), pero el público ni siquiera debe poder invocarla.
revoke execute on function public.admin_save_product(jsonb) from anon;
