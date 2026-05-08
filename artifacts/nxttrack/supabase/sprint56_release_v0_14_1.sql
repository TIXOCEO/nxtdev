-- ──────────────────────────────────────────────────────────
-- Sprint 56 — Release notes v0.14.1 (Sector-template backfill fix)
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.14.1',
  'patch',
  'Bestaande academies opnieuw aan hun sector-template gekoppeld',
  'Een paar bestaande academies stonden nog niet aan een sector-template gekoppeld doordat de eerste backfill een verkeerde tenant-slug zocht. Ze leunden tot nu toe op de generieke fallback. Met deze update krijgen ze automatisch de juiste sector-template, zodat sector-specifieke woordenschat en standaard-modules straks correct doorwerken.',
  jsonb_build_object(
    'new', jsonb_build_array(),
    'improved', jsonb_build_array(),
    'fixed', jsonb_build_array(
      'Voetbalschool-tenants die nog geen sector-template hadden, krijgen automatisch de voetbalschool-template toegewezen. Tenants die bewust op een andere template (of geen template) staan, blijven ongewijzigd.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint56_sector_template_backfill.sql → sprint56_release_v0_14_1.sql.',
      'Backfill is idempotent en raakt alleen rijen waar `sector_template_key` NULL is en `slug in (''voetbalschool-houtrust'', ''duindorp-sv'')`. Override Duindorp eventueel handmatig naar `generic` via /platform/tenants/[id] als dat de wens is.'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
