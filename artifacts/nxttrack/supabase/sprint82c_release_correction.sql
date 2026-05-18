-- Sprint 82c — correctie release-notes v0.40.0.
--
-- Architect review (2e iteratie) markeerde dat de release-notes claimden
-- dat "Intake-detailpagina krijgt een knop 'Stuur 3 voorstellen aan
-- aanvrager'" — die admin-UI is **niet** in v0.40.0 verscheept (zit in
-- follow-up #145). Dit bericht is misleidend voor tenant-admins.
--
-- Idempotent: vervangt het admin-array van de v0.40.0 release-row.

set search_path = public;

update public.platform_releases
   set body_json = jsonb_set(
         body_json,
         '{admin}',
         jsonb_build_array(
           'Nieuwe tenant-instelling "Publieke tijdsblok-voorstellen" onder /tenant/settings/intake — default uit. Wanneer aan, zien aanvragers direct de 3 voorstellen i.p.v. alleen een bevestigingsmail.'
         )
       )
 where version = '0.40.0';
