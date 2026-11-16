-- Logotipos de los bancos, subidos por el dueño desde Configuración.
-- Clave = código del banco (banreservas | popular | bhd), valor = ruta en el bucket "catalog".
-- Van aparte de bank_accounts porque el logo es del banco, no de cada cuenta,
-- y no se copian en los pedidos (bank_snapshot guarda solo los datos de pago).
alter table public.settings
  add column bank_logos jsonb not null default '{}'::jsonb
  constraint settings_bank_logos_shape check (
    jsonb_typeof(bank_logos) = 'object'
    and bank_logos - array['banreservas', 'popular', 'bhd'] = '{}'::jsonb
  );
