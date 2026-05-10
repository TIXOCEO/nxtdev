-- ──────────────────────────────────────────────────────────
-- Sprint 60 — Release notes v0.16.0 (Programs MVP)
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.16.0',
  'minor',
  'Programma''s: nieuwe planning-laag boven groepen',
  'Tenant-admins kunnen nu programma''s definiëren als overkoepelende eenheid boven bestaande groepen — met defaults voor capaciteit, flex-capaciteit, minimum-instructeurs en marketplace-velden. Bestaande groepen en sessies blijven exact werken zonder programma; programma''s zijn een additieve laag.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Programma''s-overzicht onder Planning — lijst, filter op zichtbaarheid en aantal gekoppelde groepen.',
      'Nieuw programma-formulier met interne naam, slug, zichtbaarheid (intern/publiek/archief), capaciteit-defaults, flex-capaciteit en minimum-instructeurs.',
      'Programma-detail met twee tabbladen: Overzicht (inclusief marketing-velden zodra zichtbaarheid op publiek staat) en Groepen (koppelen, ontkoppelen, primaire groep aanwijzen).',
      'Sector-terminologie aangevuld: programs_page_description, programs_marketplace_title/intro, programs_new_button, program_assignment_lead_label, membership_plan_singular/plural — per sector eigen wording.'
    ),
    'improved', jsonb_build_array(
      'Permissions: nieuwe groep "Programma''s" met read/write/publish/assign_instructors/manage_resources/manage_capacity/override_capacity/link_membership_plan/view_capacity_dashboard.',
      'Composite (id, tenant_id) uniques op programs/groups/members/capacity_resources/membership_plans — voorbereiding voor schema-niveau tenant-isolatie van komende programma-join-tabellen (Sprint 61+).'
    ),
    'fixed', jsonb_build_array(
      'Geen Houtrust-regressie: groups.program_id is nullable, alle nieuwe tabellen leeg na migratie, en zonder programma-koppeling gedragen sessie-/groep-/registratie-schermen zich identiek.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint60_programs → sprint60_release_v0_16_0.',
      'Trigger enforce_group_primary_program houdt groups.program_id in sync met program_groups.is_primary — UI gebruikt program_groups als bron, de kolom is een denormalized hint.',
      'Programma met visibility=public vereist een gevulde public_slug (DB-check programs_public_requires_slug_chk).',
      'Per programma kan maar één groep is_primary=true zijn (partial unique index program_groups_primary_uq).',
      'Sprint 60 levert nog GEEN marketplace-route, instructeurs-/resources-/billing-koppeling of capaciteits-cascade — die volgen in Sprint 61-64.'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
