-- Sprint 46 — Publiceer release v0.13.1 in `platform_releases` (patch).
-- Idempotent op `version` (insert ... on conflict do nothing).
-- Bevat: groepenpagina-finetuning (Nieuwe groep als modal),
-- en aparte limiet `max_athletes` per groep.

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values
  ('0.13.1', 'patch',
   'Groepenpagina opgeruimd + apart maximum aantal atleten',
   'Het formulier "Nieuwe groep" verschijnt nu pas wanneer je erop klikt — als pop-up bovenop de pagina — in plaats van altijd zichtbaar te zijn boven de groepen. Daarnaast kun je per groep naast een totaal-limiet ook een aparte limiet zetten op alleen het aantal atleten, zodat trainers en staff geen plek wegnemen.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Knop "Nieuwe groep" rechtsboven op `/tenant/groups`. Klik opent een nette pop-up met naam, omschrijving en beide limieten — geen lange inline-form meer.',
       'Nieuw veld "Max. atleten" per groep: telt alleen leden met de rol atleet. Trainers en staff vallen er buiten en kun je dus altijd nog toevoegen.',
       'Extra kolom "Atleten" in het groepenoverzicht (X / Y) zodat je in één blik ziet of de atleet-cap bereikt is.'
     ),
     'improved', jsonb_build_array(
       'Toevoegen-knop wordt automatisch geblokkeerd zodra óf de totaal-cap óf de atleten-cap bereikt is, met een duidelijke uitleg in de tooltip.',
       'Mobiele kaart toont aparte badges voor "leden" en "atleten" zodat beide caps zichtbaar blijven op smalle schermen.'
     ),
     'fixed', jsonb_build_array(
       'Het oude permanente "Nieuwe groep"-blok nam veel ruimte in op telefoon — die rustige pagina is hersteld.'
     ),
     'admin', jsonb_build_array(
       'SQL-migraties die deze release vereist (in deze volgorde, idempotent): sprint45_groups_max_athletes.sql, sprint46_release_v0_13_1.sql.',
       'De DB-trigger `enforce_group_max_members` controleert nu zowel `max_members` als `max_athletes` onder hetzelfde advisory-lock — concurrent inserts kunnen geen van beide caps overschrijden.',
       'Bestaande groepen blijven ongewijzigd: `max_athletes` is `null` (= ongelimiteerd) totdat een tenant-admin het zelf zet.'
     )
   ),
   'published', now())
on conflict (version) do nothing;
