-- ──────────────────────────────────────────────────────────
-- Sprint 39 — Sector-default homepage-modules
--
-- Vult `sector_templates.default_modules_json` voor de drie
-- geseede templates (`football_school`, `swimming_school`,
-- `generic`) met een sector-passende start-set homepage-modules.
-- Tenants die via `createTenant` of de "Seed homepage" knop een
-- sector toegewezen krijgen, krijgen deze modules automatisch.
--
-- Schema per entry komt overeen met
-- `src/lib/validation/sector-template-modules.ts`:
--   { module_key: string, size: '1x1'|'1x2'|'2x1'|'2x2',
--     title?, visible_for?, visible_mobile?, config? }
--
-- Idempotent: alleen rijen met een lege array worden bijgewerkt
-- zodat platform-admin overrides niet worden overschreven.
-- ──────────────────────────────────────────────────────────

-- Voetbalschool — slider, nieuws, evenementen, alerts, sponsors.
update public.sector_templates
   set default_modules_json = jsonb_build_array(
     jsonb_build_object('module_key', 'hero_slider',          'size', '2x1'),
     jsonb_build_object('module_key', 'news',                 'size', '2x1'),
     jsonb_build_object('module_key', 'events_trainings',     'size', '1x1'),
     jsonb_build_object('module_key', 'alerts_announcements', 'size', '2x1'),
     jsonb_build_object('module_key', 'sponsors',             'size', '2x1')
   )
 where key = 'football_school'
   and (default_modules_json is null
        or jsonb_typeof(default_modules_json) <> 'array'
        or jsonb_array_length(default_modules_json) = 0);

-- Zwemschool — focus op lessen, aanmeldingen, alerts.
update public.sector_templates
   set default_modules_json = jsonb_build_array(
     jsonb_build_object('module_key', 'hero_slider',          'size', '2x1'),
     jsonb_build_object('module_key', 'news',                 'size', '1x1'),
     jsonb_build_object('module_key', 'events_trainings',     'size', '2x1'),
     jsonb_build_object('module_key', 'alerts_announcements', 'size', '2x1'),
     jsonb_build_object('module_key', 'cta',                  'size', '1x1',
                        'config', jsonb_build_object(
                          'text', 'Schrijf je in voor een proefles',
                          'button_label', 'Proefles aanvragen',
                          'button_url', 'proefles'))
   )
 where key = 'swimming_school'
   and (default_modules_json is null
        or jsonb_typeof(default_modules_json) <> 'array'
        or jsonb_array_length(default_modules_json) = 0);

-- Generic — minimale, sector-neutrale set.
update public.sector_templates
   set default_modules_json = jsonb_build_array(
     jsonb_build_object('module_key', 'hero_slider',          'size', '2x1'),
     jsonb_build_object('module_key', 'news',                 'size', '2x1'),
     jsonb_build_object('module_key', 'alerts_announcements', 'size', '2x1')
   )
 where key = 'generic'
   and (default_modules_json is null
        or jsonb_typeof(default_modules_json) <> 'array'
        or jsonb_array_length(default_modules_json) = 0);

-- Einde sprint39.
