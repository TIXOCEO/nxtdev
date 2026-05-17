-- ============================================================================
-- Sprint 78 release notes — v0.35.0
-- ============================================================================
-- Idempotent insert in public.platform_releases (do-nothing on conflict).
-- Pattern: Sprint 73/74/75/76/77 release-SQL.
-- Geen schema-wijzigingen in deze sprint — alleen visuele migratie van de
-- UserShell + styling-pass op de inschrijfwizard + read-only Documenten-route.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.35.0',
  'minor',
  now(),
  'Vernieuwde uitstraling van de gebruikersshell',
  'Sprint 78 brengt het nieuwe ontwerp naar de gebruikerskant: opgefriste navigatie met navy accent-balken, een verbeterde page-header op elke pagina, een mobiele tab-balk onderaan, en een eerste opzet voor de Trainer Documenten-pagina.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Vernieuwde navigatie: actieve menu-items hebben nu een navy accent-balk en lichte achtergrond. Per-tenant accentkleur (mint) blijft behouden voor knoppen en badges.',
      'Mobiele tab-balk onderaan het scherm met snelle toegang tot Home, Agenda, Berichten, Meldingen en Profiel.',
      'Page-header met titel en omschrijving als vast element bovenaan elke pagina (consistente uitstraling).',
      'Nieuwe Trainer Documenten-pagina (read-only stub): in een vervolg-sprint kunnen beheerders hier handleidingen en oefenmateriaal uploaden en categoriseren.',
      'Eenmalig "wat is nieuw"-bannertje op de eerstvolgende inlog, met link naar deze release-notes.'
    ),
    'improved', jsonb_build_array(
      'Inschrijfwizard: nieuwe page-header met navy accent-balk geeft duidelijk aan op welke stap je bent. De flow (Type → Persoon → Kinderen → Bevestigen) blijft identiek.',
      'Donkere modus: nieuwe nav-states hebben aangepaste lichter-navy varianten zodat alles leesbaar blijft.',
      'Notificatie-badges in de zijbalk gebruiken nu het mint-accent in plaats van rood — past beter bij het rustigere ontwerp.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Per-tenant theming blijft volledig werken: een academie met een eigen primary_color ziet zijn eigen mint-tint i.p.v. de standaard, en het navy blijft als brand-secundair overal aanwezig.',
      'Trainer-link "Documenten" verschijnt automatisch in de zijbalk voor gebruikers met een trainer-rol; voor andere rollen blijft de navigatie ongewijzigd.'
    )
  ),
  'published'
)
on conflict (version) do nothing;
