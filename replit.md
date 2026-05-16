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
- **Sprint history (gotchas archive)**: `artifacts/nxttrack/docs/sprint-history.md` — alle sprints t/m 43 staan hier; alleen de laatste ~4 sprints staan hieronder onder "Gotchas".

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

### Sprint-release werkwijze (vaste volgorde)
Bij elke sprint die SQL-migraties bevat houdt de agent deze volgorde aan:

1. **Dev-database migreren** — alle nieuwe `sprintNN_*.sql`-files in `artifacts/nxttrack/supabase/` in nummer-volgorde uitvoeren tegen `DEV_DATABASE_URL` met `psql -v ON_ERROR_STOP=1 -f …`. Files moeten idempotent zijn (`if not exists`, `add column if not exists`, drop+create voor policies/triggers).
2. **Prod-database migreren** — exact dezelfde volgorde tegen `PROD_DATABASE_URL`. Als de env-var ontbreekt of de connectie faalt: stop en vraag de gebruiker om hem te zetten (Supabase **Session pooler**, port 5432, username `postgres.<project-ref>`).
3. **Release notes toevoegen** — een laatste `sprintNN_release_vX.Y.Z.sql` die een rij invoegt in `public.platform_releases` met `status='published'` en de standaard secties (Nieuw / Verbeterd / Opgelost / Voor admins). Verifieer met `select version, status, published_at from platform_releases where version='X.Y.Z';` op zowel dev als prod.
4. **Commit-instructies** — bevestig wat er gecommit is (de platform-checkpoint commit-id) of geef de gebruiker een lijst van bestanden + een suggested commit message als handmatig committen nodig is. Vermeld expliciet dat pushen naar GitHub door de gebruiker zelf gedaan moet worden (de agent kan niet pushen).
5. **Pull / build instructies voor de VPS** — geef een copy-paste blok:
   ```bash
   cd /pad/naar/nxttrack
   git pull --ff-only origin main
   pnpm install --frozen-lockfile
   pnpm --filter @workspace/nxttrack build
   pnpm --filter @workspace/api-server build   # alleen als deze in prod draait
   # herstart app (pm2/systemd)
   ```
   Vermeld expliciet dat de DB-migraties NIET nogmaals gedraaid hoeven te worden omdat stap 2 die al deed.

Verificatie-query na prod-migratie geeft altijd: release-row, count nieuwe tabellen, eventuele backfill-counts, en de hardening-constraints/indexen — zodat de gebruiker in één blik ziet dat alles klopt.

### Onderhoud van dit bestand
- Houd `replit.md` bondig: alleen de **laatste ~4 sprints** in de Gotchas-sectie.
- Bij een nieuwe sprint-gotcha: voeg de nieuwe sprint bovenaan "Gotchas" toe en verplaats de oudste sprint-entry naar `artifacts/nxttrack/docs/sprint-history.md`.
- Structurele/blijvende info (Run & Operate, Stack, Where things live, RLS-principes, etc.) hoort hier en niet in sprint-history.

## Gotchas

> Laatste ~4 sprints. Oudere sprint-gotchas (≤ Sprint 54) staan in `artifacts/nxttrack/docs/sprint-history.md`.

- **Sprint 70 placement-assistent (task #105, v0.26.0)**: Advisory placement-paneel op submission-detail. **SQL** (`sprint70_placement_rpc.sql` + `sprint70_release_v0_26_0.sql`, idempotent): RPC `score_placement_candidates(p_submission_id uuid)` `security definer` + `set search_path=public` + tenant-authz guard `has_tenant_access(tenant_id)` binnen body (Sprint-66-hotfix-pattern; `42501` bij cross-tenant). Returns `(group_id, session_id, total_score, capacity_match, time_pref_match, location_pref_match, age_match, level_match, free_seats, rationale_json)`. Formule `total = 0.30·capacity + 0.25·time + 0.20·location + 0.15·age + 0.10·level`. **Belangrijk schema-adapter t.o.v. research §9**: `groups` heeft géén `age_min/age_max/default_location/level_band` — daarom `age_match` afgeleid van `programs.age_min/age_max` (via `group.program_id` met fallback naar `submission.program_id`), `location_pref_match` uit `training_sessions.location`-aggregaat per groep (case-insensitive), `level_match` is permanent `0` met rationale "niveau-data nog niet beschikbaar" (placeholder zodat de RPC-signature stabiel blijft als later `groups.level_band` toegevoegd wordt). `capacity_match` leest `program_capacity_overview` (Sprint 62) met `min(greatest(fixed - used, 0))` over toekomstige niet-afgelaste sessies; `time_pref_match` parsed `preferences_json.preferred_days` via helper `_placement_dow(text)` die zowel `mon/tue/...` als Nederlands (`ma/di/wo/...` + voluit) ondersteunt; ±1 dag = 50, exact = 100. Onbekende submission → leeg result (geen exception → UI rendert lege-state). Max 50 kandidaten via `limit 50`. **Geen wijzigingen aan bestaande tabellen**, geen nieuwe `notifications.source`-keys (placement triggert geen notifications — admin-action only). **App-laag**: `lib/db/placement.ts` wrapper `scorePlacementCandidates(submissionId)` (lege RPC-result = lege array, geen throw). `lib/actions/tenant/placements.ts` met `placeSubmission({submissionId, groupId, suggestionRank?, suggestionScore?})` — `assertTenantAccess` op submission.tenant_id, defense-in-depth check dat group.tenant_id matcht, zet `status='placed'` + `assigned_group_id`, audit-key `intake.submission.placed` met meta `{group_id, group_name, suggestion_rank?, suggestion_score?}` zodat opvolg-rate later meetbaar is. **UI**: nieuwe route `/tenant/intake/[id]/page.tsx` (Contact-block + Antwoorden + Voorkeuren-JSON + `<PlacementSuggestionsPanel/>` rechts in 3-koloms grid); toegang = tenant-admin OF tenant-staff (zelfde regel als Sprint 65 lijst). `PlacementSuggestionsPanel.tsx` is client-component: top-5 kandidaten als kaarten met dikke kleurgecodeerde total_score (groen ≥70, oranje ≥40, rood <40), 5 componentscores als micro-bars, expandable rationale-uitleg, "Plaats hier"-knop fire-and-forget via `useTransition`. **Lege-state-varianten**: geen kandidaten → "Geen kandidaat-groepen gevonden", alle scores ≤ 20 → "Geen geschikte groep — open groepenlijst handmatig", missende `preferences_json` of `contact_date_of_birth` → warning-banner "Suggesties beperkt door ontbrekende voorkeuren/geboortedatum". Intake-lijst-page linkt nu via `Link` op contact_name naar de detail. **Houtrust-veilig**: RPC bestaat in hun DB maar wordt nooit aangeroepen omdat `dynamic_intake_enabled=false` → 0 submissions → 0 calls. **Niet uitgevoerd in deze sprint**: pgTAP `sprint70_placement_rpc.sql` (5 scenario's), Vitest voor wrapper, Playwright builder→place flow, performance-snapshot p95 < 200ms (geen `pg_stat_statements`-baseline beschikbaar). PlaceSubmissionDialog uit research §9 was niet aanwezig in Sprint 65 — directe `placeSubmission`-call via paneel-knop i.p.v. dialog. Tests + dialog-extractie staan als follow-up tasks.

- **Sprint 66 form-builder UI (task #104, v0.22.0)**: Visuele CRUD-builder voor `intake_forms`/`intake_form_fields` bovenop Sprint 65-fundament. **SQL** (`sprint66_intake_forms_publish.sql` + `sprint66_release_v0_22_0.sql` + hotfix `sprint66_intake_forms_publish_hotfix.sql` voor tenant-authz guard binnen de RPC — `has_tenant_access(tenant_id)` check + onbekende form-id geeft `42501`, voorkomt cross-tenant leak via `security definer`): RPC `validate_intake_form(p_form_id uuid) returns (is_valid bool, errors jsonb)` met 8 error-codes (`no_fields`, `missing_options` voor select/multiselect/radio, `invalid_pattern` via `regexp_count`-probe, `invalid_canonical_target` tegen vaste enum-array, `show_if_empty_target`/`show_if_missing_target`/`show_if_self_reference`, `show_if_cycle` via DFS over de show-if-graaf). Before-update trigger `intake_forms_validate_publish` op `intake_forms` blokkeert `draft→published` wanneer `validate_intake_form` errors heeft (raise check_violation met de jsonb-errors als detail). Idempotent: drop+recreate van function én trigger. Geen nieuwe `notifications.source`-keys (dedup-index ongewijzigd), geen schema-wijzigingen aan bestaande tabellen. **App-laag**: `lib/intake/validate-form.ts` is 1-op-1 TS-mirror van de SQL-RPC voor client-side preview-validatie tijdens het bouwen (server-trigger blijft de echte gatekeeper). `lib/actions/tenant/intake-forms.ts` met CRUD-actions: `createIntakeForm`/`updateIntakeForm`/`publishIntakeForm`/`archiveIntakeForm`/`duplicateIntakeForm`/`setDefaultIntakeForm` + `addIntakeFormField`/`updateIntakeFormField`/`removeIntakeFormField`/`reorderIntakeFormFields` + `importSectorDefaultAsForm`. Alle write-paden: `assertTenantAccess` + composite-tenant-check via `assertFormInTenant`-helper + audit-keys `intake.form.{created,updated,published,archived,duplicated}` en `intake.form.field.{added,updated,removed,reordered}`. **Default-flip** gebruikt het partial-unique-pattern (`intake_forms_one_default_uq where is_default=true` uit Sprint 65): eerst alle `is_default=false`, dan target `=true` — best-effort 2-statement i.p.v. transactie omdat Supabase JS-client geen multi-statement tx ondersteunt; geen race-risk omdat het partial-unique-constraint elke double-default zou weigeren. **Sector-import** (`importSectorDefaultAsForm`) klont `SECTOR_DEFAULT_FORMS[key]` naar nieuwe DB-rij + velden (draft), met cleanup-rollback wanneer field-insert faalt zodat orphaned forms voorkomen worden. **UI**: 3 nieuwe routes onder `(tenant)/tenant/intake/forms/`: `page.tsx` (lijst met status-filter + nieuwe knop + sector-import knop), `[id]/page.tsx` (detail + publiceer/archiveer/standaard-maken/dupliceer met confirm-dialogs), `[id]/builder/page.tsx` (3-koloms dnd-kit builder: veldenlijst met `@dnd-kit/sortable` `verticalListSortingStrategy`, FieldEditor met OptionsEditor/ShowIfEditor/ValidationEditor sub-components, live preview via `DynamicIntakeForm` met `previewMode={true}`). `previewMode`-prop is nieuw op `DynamicIntakeForm`: disablet de server-action zonder de schema-rendering kapot te maken. Drag-end fire-and-forget reorderIntakeFormFields met optimistic UI + rollback bij error. Builder gebruikt `useTransition` voor alle field-mutaties (geen formulier-state-machine — direct DB-roundtrip per edit; simpel maar veroorzaakt veel kleine writes). **Deeplink** `/t/[slug]/proefles?form=<slug>` is nieuw: page lookupt form-slug binnen tenant + `status='published'`, geeft `programIntakeFormId` mee aan `resolveIntakeForm` (de bestaande Sprint 65-parameter); onbekende slugs stilletjes genegeerd (Sprint 63-pattern, geen 404). **Sidebar**: nieuwe link "Intake-formulieren" → `/tenant/intake/forms` onder de bestaande Intake-groep, óók flag-gated via `showIntake`-prop (Sprint 65-pattern). Houtrust ziet dus géén form-builder. **Niet uitgevoerd in deze sprint**: Vitest-tests voor `validateIntakeForm` TS-mirror, pgTAP-tests voor `validate_intake_form` RPC + publish-trigger, Playwright-flow voor end-to-end builder → publish → submit, terminology-driven labels (admin-page is generic), per-tenant programs-override via builder (programs hebben nog geen `intake_form_id`-kolom — komt in latere sprint), 11-veld-type-specifieke editor-widgets (validation/show-if zijn generic). Tests staan als follow-up tasks.

- **Sprint 65 dynamic intake foundation (task #103, v0.21.0)**: Eerste implementatie-sprint van het dynamische aanmeldsysteem. **SQL** (`sprint65_intake_foundation.sql` + `sprint65_release_v0_21_0.sql`): 4 nieuwe tabellen `intake_forms` / `intake_form_fields` / `intake_submissions` / `submission_answers`, allemaal tenant-scoped met composite-FK `(id, tenant_id)`-pattern (Sprint 60-64-stijl). Belangrijk: omdat de drie composite-uniques (`*_id_tenant_uq`) door child-FK's worden gebruikt, kunnen ze niet drop+recreate worden — gebruik conditional `do $$ if not exists pg_constraint $$`-block. `registrations.intake_submission_id uuid null` als opt-in compat-link voor toekomstige migratie van de bestaande tryout-flow. RLS overal via `has_tenant_access(tenant_id)` + public-read policy op `intake_forms`/`intake_form_fields` voor anon (alleen `status='published'`). Member self-read policy gebruikt `members.user_id = auth.uid()` + `member_links` voor parent→child (let op: `profiles`-tabel heeft géén `user_id`-kolom, alleen `id` matchend met `auth.uid()`; voor member-self-read moet je via de `members`-tabel gaan). Notification dedup-index/RPC drop+recreate (Sprint 41/43/53/55/57/64-pattern) met nieuwe key `intake_submission_created`; `source_ref` zal `intake_submissions.id` zijn zodra de admin-notificatie wordt geactiveerd. **App-laag**: `lib/intake/` library met `types.ts` (IntakeFormConfig + IntakeFormFieldConfig + 11 field-types), `sector-defaults.ts` (football/swimming/generic code-side defaults zodat flag-on direct werkt zonder DB-form), `build-schema.ts` (`buildZodFromFormConfigMemo` met cache-key `id:updated_at` + visibility-aware superRefine — verborgen velden faal-valideren niet maar worden ook gestript uit de payload), `answers.ts` (`buildAnswerRow` typed-column mapper voor text/number/date/bool/json), `forms.ts` (`resolveIntakeForm` cascade: program → settings.intake_default_form_id → tenant-default `is_default=true` → code-side sector-default; `isDynamicIntakeEnabled` checkt `settings_json.dynamic_intake_enabled === true`). **Feature-flag default OFF**: `tenants.settings_json.dynamic_intake_enabled` (config-only, geen schema-migratie); Houtrust en alle bestaande tenants blijven dus op de legacy `TryoutForm`-renderer. **Server action** `lib/actions/public/intake.ts` `submitIntake` resolvet tenant + form server-side (nooit client-trusted), valideert via Zod-rebuild, strijpt verborgen velden, extracteert canonical-targets naar gedenormaliseerde kolommen (contact_name/email/phone/dob, registration_target) en inserteert in `intake_submissions` + per-veld in `submission_answers`. Fire-and-forget bevestigingsmail `intake_submitted`-template naar de indiener. **UI**: `components/public/forms/dynamic-intake-form.tsx` is één client component met inline switch op 11 field_types (geen 11 aparte field-components — keuze voor maintenance over abstractie); `app/t/[slug]/proefles/page.tsx` controleert `isDynamicIntakeEnabled(tenant.settings_json)` en rendert óf `DynamicIntakeForm` óf de bestaande `TryoutForm` — geen breaking change. Admin-overzicht op `(tenant)/tenant/intake/page.tsx` is **read-only MVP** met basis-filters (search op naam/email/telefoon, status, submission_type, date-range from/to) — triage-acties (status-mutatie, member-convert) volgen Sprint 66. Sidebar-link onder "Inschrijvingen → Intake" is **flag-gated** (`showIntake` prop op `TenantShell`/`TenantSidebar`, alleen gerenderd bij `dynamic_intake_enabled===true`); directe URL-bezoek op flag-off rendert een uitleg-card i.p.v. redirect. Access voor de page: `hasTenantAccess` OR `hasMembership` (zowel tenant-admins als reguliere staff). Compat dual-write in `submitTryoutRegistration` is óók flag-gated zodat Houtrust geen extra `intake_submissions`-rijen krijgt. **Email**: nieuwe DEFAULT_TEMPLATES-entry `intake_submitted` (lazy-seed per tenant zoals de Sprint 20-templates). **release_notes**: `platform_releases.body_json` (niet `sections_json`; column heet `body_json` in deze tabel). **Niet uitgevoerd in deze sprint**: compat-shim in `submitTryoutRegistration` (try/catch mirror naar intake_submissions), terminology-keys (`intake_singular`/`intake_plural` + submission_type_*), Vitest-tests voor buildZodFromFormConfig + isFieldVisible, audit-helper recordAudit-calls op submit/status-changes — staan als follow-up tasks. Admin-page is bewust nog niet terminology-driven; wordt opgepakt in Sprint 66 samen met de triage-acties.

- **Sprint 64 waitlist program-koppeling + intake-overrides (task #98, v0.20.0)**: Programs MVP fase 5. **SQL** (`sprint64_waitlist_programs.sql` + `sprint64_release_v0_20_0.sql`): kolommen `waitlists.program_id uuid null` en `waitlist_entries.program_id uuid null`, beide met composite-FK `(program_id, tenant_id)` → `programs(id, tenant_id)` `on delete set null` + partial index `where program_id is not null`; notification dedup-index/RPC drop+recreate (Sprint 41/43/53/55/57-patroon) met nieuwe key `waitlist_entry_program_assigned`, `source_ref` zal `waitlist_entries.id` zijn wanneer toekomstige flows admins notificeren over auto-koppeling. **App-laag** — intake-cascade in `submitPublicRegistration` (de wizard, niet de legacy `submitMembershipRegistration`) is uitgebreid: voor `parent`/`adult_athlete`-account-types resolved `intake_overrides_by_program[public_slug]` → `intake_overrides_by_target[child|self]` → `intake_default`. Bij `'waitlist'` schrijft de actie nu rechtstreeks naar `waitlist_entries` (incl. `program_id`!) en stuurt géén invite — pas wanneer een admin een aanbod doet wordt er een echte member aangemaakt. **Defense-in-depth**: parent met koppelcode-children (`mode='link'`) blijft altijd in registration-modus omdat het bestaande member is; trainer/staff is niet wachtlijst-eligible (zinloos). **Settings**: `intake-settings.ts` action heeft nu `intake_overrides_by_program` Zod-veld (sleutel = `programs.public_slug` zodat de URL-stable identifier bewaard blijft, niet program_id), lege map verwijdert de hele key uit settings_json. **UI**: `/tenant/registrations/instellingen` heeft een 3e `<fieldset>` "Per programma overrides" — `IntakeSettingsForm` accepteert `programs: Array<{public_slug, name, marketing_title}>` prop, page query filtert op `visibility='public' AND public_slug not null` (alleen deeplink-relevante programma's, anders dead-weight); empty-state rendert nette uitleg-card. **Audit**: `tenant_intake.update`-meta uitgebreid met `program_override_count` (geen aparte audit-key per-programma, want diffing van prior-state is overkill). **Geen wijziging** aan `submitMembershipRegistration` (legacy form heeft geen program_id-veld), `/tenant/wachtlijst`-page (bestaat niet — research-scope was filter, geskipt als scope-creep), of de RPC `create_public_registration` (cascade is server-action-side om RPC-signature stabiel te houden). **Houtrust-veilig**: program_id-kolommen nullable, geen settings backfill, IntakeSettingsForm-paneel verbergt zich automatisch wanneer er geen publieke programma's zijn.

- **Algemene principes (blijvend)**:
  - **Tenant-scoped Operations**: Always ensure tenant context is correctly applied to prevent data leakage. `assertTenantAccess` is crucial.
  - **RLS**: Supabase Row Level Security is fundamental for data isolation and access control; understand its implications before making schema changes.
  - **Email Templates**: New tenants lazily seed `staff_invite` email templates; ensure consistency if modifying default templates.
  - **Onboarding Rebuilds**: The onboarding flow has undergone significant rebuilds across multiple sprints; be aware of legacy paths vs. current implementations (e.g., `members` table is canonical for persons).
  - **Notification dedup-pattern (Sprint 41/43/53/55/57/64)**: Bij elke nieuwe `notifications.source`-key die idempotent moet zijn → **drop + recreate** de partial unique index `notifications_source_idem_uq` met de nieuwe key in het `where`-predicate, en pas exact hetzelfde predicate aan in de `on conflict ... where`-clause van `create_notification_with_recipients`. `source_ref` moet uniek-per-event zijn (gebruik bv. `group_members.id` of `training_attendance.id`, niet de parent `group_id`/`session_id`).

## Pointers

- **Swimming-school research (Task #80)**: `artifacts/nxttrack/docs/swimming-school-research.md` — onderzoek + gefaseerd plan voor wachtlijst, inhaallessen, positieve voortgang, afzwem-event-planning en capaciteitsplanning, allemaal generiek opgezet bovenop het bestaande sector-template-fundament.
- **Programs-fundament research (Task #93)**: `artifacts/nxttrack/docs/programs-foundation-research.md` — onderzoek + gefaseerd plan (Sprint 60-64) voor programs als planning-laag bovenop bestaande groups/training_sessions/instructors/capacity_resources/waitlists, met layered capacity-cascade, instructor-view-uitbreiding, publieke marketplace en waitlist-koppeling. Houtrust-veilig (alle program-FK's nullable).
- **Sprint history archive**: `artifacts/nxttrack/docs/sprint-history.md`
- **Supabase Docs**: `https://supabase.com/docs`
- **Next.js Docs**: `https://nextjs.org/docs`
- **Drizzle ORM Docs**: `https://orm.drizzle.team/docs/overview`
- **Tailwind CSS Docs**: `https://tailwindcss.com/docs`
- **shadcn/ui Docs**: `https://ui.shadcn.com/docs`
- **Zod Docs**: `https://zod.dev/`
- **Orval Docs**: `https://orval.dev/docs`
- **TipTap Docs**: `https://tiptap.dev/docs`
- **SendGrid Docs**: `https://docs.sendgrid.com/`
