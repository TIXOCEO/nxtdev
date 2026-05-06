-- Sprint 29 — Homepage modules v2
-- Doel:
--   • DB-constraint `tenant_modules.size` toelaten van alle vier de formaten
--     (1x1, 1x2, 2x1, 2x2) zodat de UI nooit meer crasht met
--     tenant_modules_size_check violation.
--   • Nieuwe module-catalog entries: news_hero_slider, image_slider, google_maps.
-- Run AFTER sprint28_audit_retention.sql. Idempotent.

-- ───────────────────────────────────────────────────────────────
-- 1. Size-check uitbreiden naar 2x2
-- ───────────────────────────────────────────────────────────────
alter table public.tenant_modules
  drop constraint if exists tenant_modules_size_check;

alter table public.tenant_modules
  add constraint tenant_modules_size_check
  check (size in ('1x1','1x2','2x1','2x2'));

-- ───────────────────────────────────────────────────────────────
-- 2. Nieuwe modules in de catalog
-- ───────────────────────────────────────────────────────────────
insert into public.modules_catalog (key, name, description, config_schema, is_active)
values
  ('news_hero_slider', 'Nieuws hero slider',
   'Hero-slider met de laatste nieuwsberichten als slides.',
   '{}'::jsonb, true),
  ('image_slider',     'Beeld slider',
   'Eén of meerdere afbeeldingen; meerdere = automatische slider.',
   '{}'::jsonb, true),
  ('google_maps',      'Google Maps',
   'Toont een ingebouwde kaart op basis van een adres.',
   '{}'::jsonb, true)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      is_active = true;
