# Sprint 30 — `createAdminClient()` inventarisatie

Volgt op sprint 27 (profile-acties → RLS). Doel: per resterende
call-site beslissen of we naar het RLS-pad migreren of expliciet
op de service-role-client blijven, met reden.

Bron: `rg -n "createAdminClient" artifacts/nxttrack/src/lib/actions/`.

## ✅ Sprint 30 — gemigreerd naar RLS-pad

Alle hieronder genoemde acties roepen nu `createClient()` (anon-key +
sessie) aan. De TS-gate (`assertTenantAccess` / `requireTenantAdmin`)
blijft als snelle voorvermelding/early-exit; de RLS-policy is de
autoritatieve controle.

| Action-bestand                     | Tabel(len)                                    | RLS-policy (autoritatief)                                  |
| ---------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `tenant/sponsors.ts`               | `sponsors`, `members.show_in_public/public_bio` | `sp_admin_all`, `members_tenant_all` (`has_tenant_access`) |
| `tenant/alerts.ts`                 | `alerts`                                      | `alerts_admin_all` (`has_tenant_access`)                   |
| `tenant/media-wall.ts`             | `media_wall_items`                            | `mwall_admin_all` (`has_tenant_access`)                    |
| `tenant/themes.ts`                 | `tenant_active_themes`                        | `tat_tenant_all` (`has_tenant_access`)                     |
| `tenant/seo.ts`                    | `tenant_seo_settings`, `tenant_page_seo`      | `tss_tenant_all`, `tps_tenant_all` (`has_tenant_access`)   |
| `tenant/social-links.ts`           | `tenant_social_links`                         | `tsl_admin_all` (`has_tenant_access`)                      |
| `tenant/custom-pages.ts`           | `tenant_custom_pages`                         | `tcp_tenant_all` (`has_tenant_access`)                     |

Self-test SQL: `supabase/tests/sprint30_rls_admin_actions.sql`.

## 🟡 Kandidaten voor volgende sprint (RLS-pad mogelijk, policy uitbreiden)

Deze gebruiken nu `createAdminClient()`. RLS bestaat al maar de policy
gebruikt `fn_is_tenant_admin` (alleen platform_admin / tenant_admin
enum) terwijl onze TS-gate ook admin-via-role
(`user_has_tenant_admin_role`) toelaat. Migreren = eerst policy
uitbreiden naar `has_tenant_access` of vergelijkbaar, anders breken
admins-via-role.

- `tenant/social-settings.ts` — `social_settings.ss_admin_all`
- `tenant/social-moderation.ts` — `posts.posts_admin_all`,
  `comments.cm_admin_all`, `social_mutes.sm_admin_all`

## 🟡 Kandidaten voor volgende sprint (RLS-pad mogelijk, geen policy-wijziging nodig)

Tabellen die al `has_tenant_access` policies hebben; alleen de actions
moeten nog omgebouwd worden (en getest):

- `tenant/news.ts` (niet in createAdminClient-lijst → check separately)
- `tenant/newsletters.ts`
- `tenant/email.ts`
- `tenant/messages.ts`
- `tenant/homepage.ts`
- `tenant/trainings.ts`
- `tenant/push.ts`
- `tenant/profile-pictures.ts`
- `tenant/training-settings.ts`
- `tenant/registrations.ts`
- `tenant/registration-statuses.ts`
- `tenant/payment-methods.ts`
- `tenant/members.ts`
- `tenant/profile.ts`
- `tenant/invite-statuses.ts`
- `tenant/homepage-uploads.ts`
- `tenant/select.ts`
- `tenant/notifications.ts`

Per call-site moet het `assertTenantAccess`-pad één-op-één matchen met
de RLS-policy van de geraakte tabellen. Bij twijfel: uitbreiden zoals
sprint 27 deed met `members_self_parent_perm_*`.

## 🔴 Moet admin-client blijven (reden gedocumenteerd)

| Call-site                                        | Reden                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `actions/auth.ts`                                | `auth.admin.createUser` / `auth.admin.updateUserById` — vereist service-role; geen RLS-equivalent.         |
| `actions/admin-handoff.ts`                       | Platform-admin handoff: muteert auth-user en cross-tenant rijen die per definitie buiten tenant-RLS vallen.|
| `actions/public/registrations.ts`                | Publieke registratie zonder ingelogde sessie — RLS heeft geen `auth.uid()`.                                |
| `actions/public/profile.ts` (`revealMemberIban`) | IBAN-onthulling: bewust admin-pad zodat de actie hard audit-logt voordat de raw-waarde geretourneerd wordt; sprint 27 keuze. |
| `actions/public/social.ts`                       | Bevat o.a. push/notif-fanout naar leden van andere tenants en triggert auto-posts; cross-tenant lookups.   |
| `actions/public/push.ts`                         | Web-push subscriptions: schrijft naar tabellen waar de RLS-policy nog niet bestaat (out of scope).         |
| `actions/public/trainings.ts`                    | Public read voor anonieme bezoekers van trainingen — geen sessie.                                          |
| `actions/public/notification-prefs.ts`           | Self-write zonder tenant context (auth.uid only); migratie eenvoudig maar buiten scope.                    |
| `actions/public/theme-pref.ts`                   | Self-write; migratie eenvoudig maar buiten scope.                                                          |
| `actions/tenant/invites.ts`                      | Sprint 27 expliciet uitgesloten (invite-acceptatie is bewust admin-only).                                  |
| `actions/tenant/roles.ts`                        | Wijzigt `tenant_roles` / `tenant_member_roles` / `tenant_role_permissions` — privilege-escalatie risico, blijft admin tot eigen RLS-sprint. |
| `actions/platform/tenants.ts`                    | Platform-admin only: tenant-creatie, master-admin assignment.                                              |
| `actions/platform/admins.ts`                     | Beheert `tenant_memberships(role='platform_admin')` — privilege-grant, moet hard service-role blijven.     |
| `actions/platform/themes.ts`                     | Beheert platform-scoped themes (geen tenant context).                                                      |
| `actions/platform/push.ts`                       | Cross-tenant broadcast push.                                                                               |

## Vervolg

- Volgende sprint: `social-settings.ts` + `social-moderation.ts`
  policies uitbreiden naar `has_tenant_access` en migreren.
- Daarna stap-voor-stap de 🟡-lijst aflopen (één PR per actie-bestand,
  steeds met bijbehorende RLS-test in `supabase/tests/`).
