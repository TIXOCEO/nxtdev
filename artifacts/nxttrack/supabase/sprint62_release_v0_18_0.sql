-- ──────────────────────────────────────────────────────────
-- Sprint 62 — Release notes v0.18.0
-- Programs MVP fase 3: layered capacity + program ⇄ plans
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.18.0',
  'minor',
  'Programma''s fase 3: capaciteit-overzicht en lidmaatschapskoppeling',
  'Programma''s krijgen een vijfde tabblad voor lidmaatschapsplannen — koppel één of meerdere plannen aan een programma en markeer er één als standaard. Een nieuw planning-dashboard toont per sessie de bezetting met een kleurband (groen → oranje → rood → blauw) op basis van de cascade sessie-resources → groep-cap → programma-default.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Nieuwe pagina /tenant/planning/capaciteit toont per sessie de capaciteitskleur (groen ≤70%, oranje 71-90%, rood 91-100%, blauw bij overboeking binnen flex, grijs bij onbeperkt) over de komende 90 dagen.',
      'Programma-detail krijgt een tabblad "Lidmaatschap" om plannen aan een programma te koppelen — handig voor publieke marketplace (Sprint 63) en automatische plan-suggesties bij sessie-aanmaak.',
      'Sessie-aanmaak heeft een optionele programma-keuze; bij keuze worden de gekoppelde plannen meteen onder het formulier weergegeven als context.',
      'Capaciteit-cascade als view program_capacity_overview: fixed_capacity = sum(session_resources.max_participants) → groups.max_members → programs.default_capacity; flex_capacity = programs.default_flex_capacity.'
    ),
    'improved', jsonb_build_array(
      'Programmalijst toont per programma een capaciteitsband met de meest bezette komende sessie (kleur + label "Genoeg plek" / "Bijna vol" / "Vol" / "Overboekt" / "Onbeperkt").',
      'Composite (program_id, tenant_id) en (membership_plan_id, tenant_id) FK''s op program_membership_plans — schema-niveau-isolatie tussen tenants (Sprint 60-patroon).'
    ),
    'fixed', jsonb_build_array(
      'Houtrust-veilig: program_capacity_overview werkt voor sessies zonder program_id (program-kolommen zijn NULL); geen wijziging op bestaande tabellen of triggers.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint62_program_capacity → sprint62_release_v0_18_0.',
      'Nieuwe tabel public.program_membership_plans is leeg na migratie; RLS via has_tenant_access(tenant_id), partial unique index program_membership_plans_default_uq dwingt maximaal één is_default-rij per (tenant_id, program_id) af.',
      'View program_capacity_overview heeft security_invoker=true en GRANT SELECT op authenticated. Voor publieke marketplace komt later een aparte _public-view.',
      'Geen nieuwe notification-source-keys; bestaande dedup-index notifications_source_idem_uq blijft ongewijzigd.',
      'Audit-keys: program.membership_plan.linked, program.membership_plan.unlinked, program.membership_plan.set_default.',
      'Sprint 62 levert nog GEEN publieke marketplace (Sprint 63) of waitlist-program-koppeling (Sprint 64).'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
