-- ═════════════════════════════════════════════════════════════════
-- Sprint 56 — Sector-template backfill fix
--
-- De originele backfill in sprint36_sector_templates.sql gebruikte
-- `where slug = 'houtrust'`, maar de echte tenant-slug is
-- `voetbalschool-houtrust`. Daardoor zijn Voetbalschool Houtrust en
-- Duindorp SV op productie nooit aan een sector-template gekoppeld
-- (sector_template_key = NULL). Resultaat: ze leunen op de
-- generic-fallback. Dat veroorzaakt nu nog geen zichtbare regressie
-- (generic en football_school hebben identieke NL-defaults voor de
-- bestaande keys), maar zodra een football-specifieke override
-- wordt toegevoegd zou Houtrust die niet zien.
--
-- Deze migratie zet beide voetbal-tenants op `football_school`.
-- Idempotent: alleen als de huidige waarde NULL is. Tenants die
-- bewust op NULL of een andere template zijn gezet door een platform-
-- admin worden niet overschreven.
--
-- Operator-noot: als Duindorp SV bij nader inzien op `generic` moet
-- staan, wijzig dit dan na de run handmatig via het platform-admin-
-- scherm (`/platform/tenants/[id]` → Sector-card).
-- ═════════════════════════════════════════════════════════════════

update public.tenants
   set sector_template_key = 'football_school'
 where sector_template_key is null
   and slug in ('voetbalschool-houtrust', 'duindorp-sv');
