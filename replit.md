# NXTTRACK

NXTTRACK is a multi-tenant SaaS platform for managing sports academies, offering public, tenant, and platform administration features.

## Run & Operate

- **Run Dev**: `pnpm dev`
- **Build**: `pnpm build`
- **Typecheck**: `pnpm typecheck`
- **Codegen**: `pnpm orval` (generates API clients)
- **DB Push**: `pnpm drizzle-kit push:pg` (schema migrations)

**Required Environment Variables**:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENDGRID_API_KEY`
- `MAIL_DEFAULT_FROM_EMAIL`
- `MARKETING_LEAD_RECIPIENT`

## Stack

- **Frameworks**: Next.js 15 (App Router), Express 5
- **Runtime**: Node.js (latest LTS)
- **ORM**: Drizzle ORM
- **Validation**: Zod, React Hook Form
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Build Tool**: pnpm (monorepo)
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth

## Where things live

- **Frontend Application**: `artifacts/nxttrack/`
- **Backend API Server**: `artifacts/api-server/`
- **Database Schema**: `supabase/` (SQL migration files), `src/lib/db/schema.ts` (Drizzle schema)
- **API Contracts**: `openapi.yaml` (for Orval codegen)
- **Marketing Site Data**: `src/lib/marketing/site-data.ts`
- **Theming**: CSS custom properties mapped to Tailwind v4, `src/components/theme-style-injector.tsx`
- **Validation Schemas**: `src/lib/validation/`

## Architecture decisions

- **Monorepo Structure**: Centralized code and tooling using pnpm for `artifacts/nxttrack` (Next.js) and `artifacts/api-server` (Express).
- **Tenant Resolution**: `middleware.ts` identifies tenants via subdomain or path, passing `x-tenant-slug` header.
- **Role-Based Access Control (RBAC)**: Implemented with `isPlatformAdmin`, `isTenantAdmin`, `hasMembership`, enforced via SQL RLS and TypeScript helpers.
- **Server Actions for Mutations**: Next.js Server Actions used for data mutations, secured with `assertTenantAccess` and Zod validation.
- **Email Infrastructure**: SendGrid API for emails, with per-tenant sender resolution and customizable templates.

## Product

- **Public Tenant Pages**: Tenant-specific home, news, trial lessons, and registration with branding.
- **Tenant Admin Dashboard**: Management for news, registrations, tenant profile, members, groups, and membership plans.
- **Platform Admin Dashboard**: Tenant creation and management, master admin assignment.
- **Marketing Site**: Apex domain public website for prospect acquisition with feature overviews, sector-specific pages, and contact forms.
- **User Profile Management**: Users can manage general info, children, sports details, and financial information.
- **Audit Logging**: Persistent `public.audit_logs` table for tracking key actions, viewable by tenant/platform admins.
- **Release Notes**: Platform-admins beheren versies onder `/platform/releases` in een vast format (versie, type, datum, titel, samenvatting, secties Nieuw/Verbeterd/Opgelost/Voor admins). Tenant-admins zien de meest recente publicatie als vaste container op het dashboard, een chronologische lijst onder `/tenant/releases` en het versielabel onder "Powered by NXTTRACK" in de sidebar.

## User preferences

I prefer the AI to
- Focus on completing the tasks requested.
- Use the existing libraries and frameworks.
- Not refactor the code unless explicitly asked.
- Provide concise summaries of changes in PRs.
- Not use many emojis.
- Ask clarifying questions if something is unclear.

## Gotchas

- **Sprint 42 groups revamp**: `artifacts/nxttrack/supabase/sprint42_groups_revamp.sql` adds (a) `groups.max_members int null` (check `> 0`), (b) `groups.updated_at timestamptz` + `handle_updated_at`-trigger, en (c) `members.athlete_code text null` met partial unique index `members_athlete_code_tenant_uq` op `(tenant_id, athlete_code) where athlete_code is not null` + zoek-index `members_athlete_code_search_idx`. Idempotent. We hebben `athlete_code` op **members** gezet (niet via legacy `athletes`-table — die heeft geen FK naar `members` en is een ander concept) zodat één tabel canoniek blijft voor groepleden. `getGroupsPage(tenantId, opts)` in `src/lib/db/groups.ts` doet server-side ilike-filter (op `name` + `description`) en hydrate alle gefilterde rijen, want `member_count`/`trainer_count` kunnen niet via PostgREST gesorteerd — sorteren+pagineren gebeuren in JS (acceptabel tot enkele honderden groepen; voor schaal later naar een SQL-view). `searchMembersForGroup` matcht ilike op `full_name`/`first_name`/`last_name`/`email`/`athlete_code`. `addMemberToGroup` doet pre-check op `max_members`, en de DB-trigger `enforce_group_max_members` (constraint trigger, deferrable initially deferred) telt na insert opnieuw onder een `pg_advisory_xact_lock` per groep en raise't `group_members_max_exceeded` (sqlstate 23514) bij overflow — concurrent inserts kunnen de cap dus niet meer overschrijden. `bulkAddMembersToGroup` is de CSV-import action; weigert all-or-nothing als import het max overschrijdt en logt per ingevoegde rij `group.member_added` met `meta.source='csv_import'`. Audit-acties: `group.created`, `group.updated`, `group.member_added`, `group.member_removed` (met `member_id`). CSV-export route `/tenant/groups/[id]/export` levert `groups-{slug}.csv` (UTF-8 BOM + formula-injection-escape) met kolommen `member_id, athlete_code, voornaam, achternaam, e-mail, role, joined_at`. CSV-import gaat via 2-stap flow `/tenant/groups/[id]/api/import-preview` (POST multipart, max 1 MB, **eerst tenant-check op `group_id`**, accepteert `athlete_code` (primair), `email` (fallback) of `member_id`) → preview tonen → `bulkAddMembersToGroup`. Live add-member popover gebruikt JSON-route `/tenant/groups/[id]/api/search`. Overview clamp: pagina-nr wordt eerst tegen het totaal gecheckt zodat `?page=9999` netjes naar de laatste pagina valt. Detail-pagina heeft 3 tabs (athletes / trainers / others) met URL-state (`?tab&sort&order&page&size&q`); badge in header is grijs / amber (≥90%) / rood (vol). Oude bestanden verwijderd: `_group-assign.tsx`, `[id]/_role-picker.tsx`.

- **Sprint 43 notification dedup uitbreiding**: `sprint43_notification_dedup_extra.sql` breidt de Sprint 41 partial unique index `notifications_source_idem_uq` (en het matchende `on conflict ... where`-predicate in `create_notification_with_recipients`) uit met `news_published`, `membership_assigned`, `invite_accepted`, `attendance_changed_late` en `trainer_attendance_updated`. Index moest gedropt + opnieuw aangemaakt worden omdat `on conflict ... where` exact het index-predicate moet matchen — een tweede stack-index zou niet werken. Backfill zet `source_ref = null` op alle behalve de oudste rij per `(tenant_id, source, source_ref)` zodat de index zonder conflicten bouwt en historische inbox-rijen blijven staan. Caller-fix: `attendance_changed_late` (in `actions/public/trainings.ts`) en `trainer_attendance_updated` (in `actions/public/training-trainer.ts` + `actions/tenant/trainings.ts`) gebruiken nu de `training_attendance.id` i.p.v. `session_id` als `sourceRef`, anders zou de index legitieme notificaties voor andere leden in dezelfde sessie deduppen — zelfde patroon als Sprint 41 met `group_members.id`. `news_published` (`post.id`), `membership_assigned` (`member_memberships.id`) en `invite_accepted` (`member_invites.id`) hadden al een unieke per-event id; alleen index + RPC moesten weten dat ze dedupable zijn. `registration_converted` zit bewust niet in de lijst: er bestaat geen `sendNotification` met die source-key (alleen audit-meta + sendEmail-triggerSource).

- **Sprint 41 notification dedup**: `sprint41_notification_dedup.sql` voegt een partial unique index `notifications_source_idem_uq` toe op `notifications (tenant_id, source, source_ref) where source in ('training_created','training_reminder','group_assigned') and source_ref is not null`, en herschrijft `create_notification_with_recipients` zodat een tweede call met dezelfde idempotency-key de bestaande notification-id teruggeeft (geen extra rij, geen extra recipients, geen exception). Dedup is dus **bron-zijde** op `(tenant_id, source, source_ref)`. Voor `group_assigned` is `sourceRef` nu `group_members.id` (uniek per member-groep paar) i.p.v. `group_id`, anders zou de index legitieme notificaties voor andere leden in dezelfde groep blokkeren. De migratie bevat een **backfill** die op legacy duplicaten (oude `group_assigned`-rijen met gedeelde `group_id`, of historische `training_*`-duplicaten) de `source_ref` op NULL zet voor alle behalve de oudste rij — NULL valt buiten het partial-index predicate, dus de index kan zonder conflicten gebouwd worden en inbox-historie blijft staan. RPC-conflictpad gebruikt `on conflict (tenant_id, source, source_ref) where ... do nothing` (index-inferentie matcht het partial predicate). Cron `training-reminders` claimt sessies al atomisch via een `update ... is null returning`, dus overlappende ticks blijven veilig. Andere source-keys (`manual`, `social_*`, `news_published`, etc.) staan bewust niet in de index — die hebben geen 1-op-1 event-identiteit.

- **Sprint 36 sector templates**: `artifacts/nxttrack/supabase/sprint36_sector_templates.sql` voegt `sector_templates` (RLS: select=authenticated, write=platform_admin) + `tenants.sector_template_key` FK toe en seedt `football_school`/`swimming_school`/`generic`. Backfill is **gelimiteerd tot Houtrust** (`where slug='houtrust'`); andere tenants blijven NULL en krijgen via de resolver de generic-fallback. Per-tenant overrides leven onder `tenants.settings_json -> 'terminology_overrides'` (geen extra kolom). Pure resolver-kern in `src/lib/terminology/merge.ts` (`resolveTerminology`/`mergeIntoTerminology`); ingestie-validatie via Zod `TerminologySchema` in `schema.ts` (`safeParseTerminology` strip-onbekende-keys, lege strings vallen weg). Server-resolver `getTenantTerminology(tenantId)` in `resolver.ts` — `React.cache()`d, fallback-chain override→sector→generic→DEFAULT_TERMINOLOGY, mag nooit throwen. Provider gemount in `(tenant)/tenant/layout.tsx`; client-componenten gebruiken `useTerminology()`. Page-titles via terminology (incl. nieuwe key `program_page_title` zodat football_school "Abonnementen" blijft naast sidebar-label "Lidmaatschappen"); page-`description`s + knop-teksten blijven hardcoded NL (vervolgsprint). Unit-tests `src/lib/terminology/__tests__/merge.test.ts` (12 cases, fallback-chain + Zod-validatie + never-throw); run via `pnpm --filter @workspace/nxttrack test` (Node 24 `--experimental-strip-types`). `tsconfig.allowImportingTsExtensions=true` zodat `.ts`-imports binnen `terminology/` werken voor zowel Next bundler als node:test. Audit + 13-key mapping in `artifacts/nxttrack/docs/sector-templates-audit.md`. Out-of-scope: platform-admin UI, role-key renames, `members.player_type` opheffen.

- **Sprint 35 attendance v2**: 3 SQL files in `artifacts/nxttrack/supabase/`: `sprint35_attendance_auto_reminder.sql` (adds `training_attendance.reminder_sent_at` + `training_sessions.reminder_run_at`), `sprint35_attendance_note_visibility.sql` (`note` + `note_visibility` cols, RLS lets group-trainers read+write attendance for their group), `sprint35_member_observations.sql` (LVS table, RLS tenant/trainer/self-read). Apply in order on prod. Cron is `POST /api/cron/training-reminders` (header `x-cron-secret` matches `CRON_SECRET`); api-server `startTrainingReminderTicker` pings it hourly via `TRAINING_REMINDER_URL`. Trainer manage screen lives under `/t/[slug]/schedule/[id]/manage`; trainer-only LVS under `/t/[slug]/members/[id]`. Auth helper: `lib/auth/trainer-rules.ts` `trainerInSessionGroup`. Legacy attendance columns `notes`/`trainer_note` blijven 1 release in sync (rollback-safety).

- **Release reads**: `sprint33_release_reads.sql` voegt `release_reads(user_id, version, seen_at)` toe (PK `(user_id, version)`, RLS: enkel eigen rijen). Tenant-layout en dashboard berekenen `latestReleaseUnseen` via `hasUserSeenRelease`; sidebar-versielabel en `LatestReleaseCard` tonen een "nieuw"-dot zolang dit true is. Bezoek aan `/tenant/releases` markeert de laatste release, bezoek aan `/tenant/releases/[version]` markeert die specifieke versie via `markReleaseSeen` (idempotente upsert).
- **Release notifications**: `sprint32_release_notifications.sql` adds `platform_release_notifications` (PK `(release_id, tenant_id)`, RLS: platform-admin select). `setReleaseStatus`/`createRelease`/`updateRelease` triggers `notifyTenantsAboutRelease`, idempotent per (release, tenant). E-mail naar tenant-admins is opt-in via `notification_events.event_key='platform_release_published'` (email_enabled).
- **Release notes seed**: `sprint31_release_notes.sql` voegt `platform_releases` toe (semver-uniek, RLS: platform-admin schrijft, ingelogde users lezen alleen `published`) en seedt de historische versies `0.1.0` → `0.9.0` (incl. enkele patches). Bij herhaling worden bestaande `version`-rijen niet overschreven.
- **Manual Supabase migrations (VPS)**: Run new sprint SQL files in `artifacts/nxttrack/supabase/` against the production DB in order. Apply in this order: `sprint30_trainer_bio.sql` (adds `tenant_roles.is_trainer_role`, `trainer_bio_sections/fields/answers` tables with RLS, `seed_trainer_bio_template` RPC and `trainer_cards` entry in `modules_catalog`), then `sprint30_payments_v2.sql` (adds `is_default` on `membership_plans` & `payment_methods` (one-default partial-unique index), extends `membership_payment_logs` with `amount_expected`/`amount_paid`/`period`/`due_date`/`parent_payment_id`/`original_amount_paid`, broadens status check (paid|due|partial|overdue|refunded|cancelled|waived), creates `membership_payment_audit` (payment_id nullable + ON DELETE SET NULL) plus atomic `set_membership_plan_default` / `set_payment_method_default` RPCs, and adds `ended_at`/`end_reason` on `member_memberships` (status enum incl. `ended`)). Also note: `sprint29_homepage_modules_v2.sql` relaxes `tenant_modules.size` check and seeds `news_hero_slider`, `image_slider`, `google_maps` in `modules_catalog`. Sprint 30 introduces migration of admin-actions to RLS; see `supabase/tests/sprint30_rls_admin_actions.sql` and `supabase/sprint30_admin_client_inventory.md`. Then apply `sprint30_homepage_layout_locks.sql` (adds `add_tenant_module` and `update_tenant_module_layout` RPCs that serialise homepage-layout writes per tenant via `pg_advisory_xact_lock`).
- **Tenant-scoped Operations**: Always ensure tenant context is correctly applied to prevent data leakage. `assertTenantAccess` is crucial.
- **RLS**: Supabase Row Level Security is fundamental for data isolation and access control; understand its implications before making schema changes.
- **Email Templates**: New tenants lazily seed `staff_invite` email templates; ensure consistency if modifying default templates.
- **Onboarding Rebuilds**: The onboarding flow has undergone significant rebuilds across multiple sprints; be aware of legacy paths vs. current implementations (e.g., `members` table is canonical for persons).

## Pointers

- **Swimming-school research (Task #80)**: `artifacts/nxttrack/docs/swimming-school-research.md` — onderzoek + gefaseerd plan voor wachtlijst, inhaallessen, positieve voortgang, afzwem-event-planning en capaciteitsplanning, allemaal generiek opgezet bovenop het bestaande sector-template-fundament.
- **Supabase Docs**: `https://supabase.com/docs`
- **Next.js Docs**: `https://nextjs.org/docs`
- **Drizzle ORM Docs**: `https://orm.drizzle.team/docs/overview`
- **Tailwind CSS Docs**: `https://tailwindcss.com/docs`
- **shadcn/ui Docs**: `https://ui.shadcn.com/docs`
- **Zod Docs**: `https://zod.dev/`
- **Orval Docs**: `https://orval.dev/docs`
- **TipTap Docs**: `https://tiptap.dev/docs`
- **SendGrid Docs**: `https://docs.sendgrid.com/`