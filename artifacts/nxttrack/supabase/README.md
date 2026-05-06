# Supabase migraties — runvolgorde

Alle migraties zijn idempotent (gebruik van `if not exists`,
`drop ... if exists` voor constraints/triggers, etc.). Toch is de
volgorde belangrijk vanwege foreign keys en triggers die naar elkaar
verwijzen.

Draai in deze volgorde op een verse Supabase-database:

| # | Bestand | Inhoud |
|---|---------|--------|
| 1 | `schema.sql` | Initieel schema (tenants, members, news, …) |
| 2 | `seed.sql` | Optionele seed voor lokaal testen |
| 3 | `storage.sql` | Storage buckets + policies |
| 4 | `sprint7.sql` | Public news + tenant-pages |
| 5 | `sprint8.sql` | Members + memberships v1 |
| 6 | `sprint9.sql` | E-mail templates + dispatch |
| 7 | `sprint9_ses.sql` | SES → SendGrid migratie kolommen |
| 8 | `sprint10.sql` | Invites + auth-bridge |
| 9 | `sprint11.sql` | Trainings/groups |
| 10 | `sprint12.sql` | Membership plans + payments log |
| 11 | `sprint13.sql` | Public membership-registration tabel |
| 12 | `sprint14.sql` | Trainer public profiles |
| 13 | `sprint15.sql` | Themes + custom pages + tenant SEO |
| 14 | `sprint16.sql` | Push notifications |
| 15 | `sprint17.sql` | Sponsors + media-wall |
| 16 | `sprint18_homepage_cms.sql` | Homepage CMS + opt-in modules |
| 17 | `sprint19_social_feed.sql` | Public social feed |
| 18 | `sprint20_newsletters.sql` | Newsletters + audiences |
| 19 | `sprint21_staff_invite_template.sql` | Staf-invite template (optioneel backfill) |
| 20 | `sprint22_roles_scope_grid.sql` | Roles + scope grid + permissies |
| 21 | `sprint23_onboarding_foundation.sql` | **Onboarding rebuild fundament** (members extra velden, member_financial_details, payment_methods, account_type, soft-delete, sync_full_name + sync_staff_trainer_role triggers) |
| 22 | `sprint23c_public_registration.sql` | Aanvullingen voor publieke wizard |
| 23 | `sprint24_admin_member_fields.sql` | `members.member_since` + `members.notes` (admin-only) |
| 24 | `sprint25_rls_hardening.sql` | Belt-and-braces revoke voor anon op gevoelige tabellen |

## Conventies

- **Geen `drop column`** — wij doen alleen additive migraties zodat een
  rollback van de app niet de database stuktrekt.
- **Idempotent** — elke migratie moet meerdere keren draaien zonder
  fouten te geven.
- **RLS aan voordat policies bestaan** is OK; standaard valt alles dicht
  totdat `create policy` is gedraaid.
- **Geen `service_role` references in app-code** behalve via
  `createAdminClient()` voor de paden waar RLS expliciet gebypassed
  moet worden (financial reveal, public-registration insert, etc.).

## Onboarding-architectuur (Sprint 23+)

Zie ook de sectie "Onboarding architectuur" in `replit.md`.

- **Canonical persoon-tabel**: `members` (geen `athletes`/`parent_athlete_links`
  in nieuwe code; die tabellen blijven voor legacy reads).
- **Account type**: `members.account_type` ∈
  `athlete | minor_athlete | parent | trainer | staff`.
- **Status**: `members.member_status` ∈
  `prospect | invited | aspirant | pending | active | paused | inactive |
  cancelled | archived` (legacy waarden uit Sprint 8 blijven geldig).
- **Soft delete**: `members.archived_at` + `archived_by`. List-queries
  filteren standaard op `archived_at IS NULL`.
- **Parent ↔ child**: `member_links` (geen FK op auth user; werkt ook
  vóór invite-acceptatie).
- **Invite auto-link**: invite-rij draagt `child_member_id` zodat de
  parent direct na wachtwoord-set wordt gekoppeld.
- **Financial scheiding**: `member_financial_details` (1:1 op member,
  IBAN + holder + payment_method_id) staat los van `members`. RLS:
  zelf via `members.user_id` of admin met permissie
  `members.financial.view` / `.manage`. Reveal en write via
  audit-gelogde server actions.
- **Tenant payment methods**: `payment_methods` per tenant
  (CRUD + archive in `/tenant/settings/betaalmogelijkheden`).
