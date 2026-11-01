-- Datos iniciales definidos por el cliente (categorías y servicios del encargo).
-- Sin precios, imágenes ni datos bancarios: eso se carga desde el panel.

insert into public.categories (slug, name, sort_order) values
  ('tazas-personalizadas',    'Tazas personalizadas',    1),
  ('termos-personalizados',   'Termos personalizados',   2),
  ('vasos-personalizados',    'Vasos personalizados',    3),
  ('camisetas',               'Camisetas',               4),
  ('mesas-de-domino',         'Mesas de dominó',         5),
  ('regalos-personalizados',  'Regalos personalizados',  6),
  ('articulos-promocionales', 'Artículos promocionales', 7),
  ('productos-navidenos',     'Productos navideños',     8),
  ('ofertas-especiales',      'Ofertas especiales',      9)
on conflict (slug) do nothing;

insert into public.services (slug, name, asks_measurements, asks_material, sort_order) values
  ('impresion-de-banners',  'Impresión de banners',  true,  true,  1),
  ('impresion-de-vinilos',  'Impresión de vinilos',  true,  true,  2),
  ('letreros',              'Letreros',              true,  true,  3),
  ('rotulacion-vehicular',  'Rotulación vehicular',  true,  true,  4),
  ('senaletica',            'Señalética',            true,  true,  5),
  ('trabajos-especiales',   'Trabajos especiales',   false, false, 6)
on conflict (slug) do nothing;
