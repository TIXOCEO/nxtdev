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

- **Sprint 65 dynamic intake foundation (task #103, v0.21.0)**: Eerste implementatie-sprint van het dynamische aanmeldsysteem. **SQL** (`sprint65_intake_foundation.sql` + `sprint65_release_v0_21_0.sql`): 4 nieuwe tabellen `intake_forms` / `intake_form_fields` / `intake_submissions` / `submission_answers`, allemaal tenant-scoped met composite-FK `(id, tenant_id)`-pattern (Sprint 60-64-stijl). Belangrijk: omdat de drie composite-uniques (`*_id_tenant_uq`) door child-FK's worden gebruikt, kunnen ze niet drop+recreate worden — gebruik conditional `do $$ if not exists pg_constraint $$`-block. `registrations.intake_submission_id uuid null` als opt-in compat-link voor toekomstige migratie van de bestaande tryout-flow. RLS overal via `has_tenant_access(tenant_id)` + public-read policy op `intake_forms`/`intake_form_fields` voor anon (alleen `status='published'`). Member self-read policy gebruikt `members.user_id = auth.uid()` + `member_links` voor parent→child (let op: `profiles`-tabel heeft géén `user_id`-kolom, alleen `id` matchend met `auth.uid()`; voor member-self-read moet je via de `members`-tabel gaan). Notification dedup-index/RPC drop+recreate (Sprint 41/43/53/55/57/64-pattern) met nieuwe key `intake_submission_created`; `source_ref` zal `intake_submissions.id` zijn zodra de admin-notificatie wordt geactiveerd. **App-laag**: `lib/intake/` library met `types.ts` (IntakeFormConfig + IntakeFormFieldConfig + 11 field-types), `sector-defaults.ts` (football/swimming/generic code-side defaults zodat flag-on direct werkt zonder DB-form), `build-schema.ts` (`buildZodFromFormConfigMemo` met cache-key `id:updated_at` + visibility-aware superRefine — verborgen velden faal-valideren niet maar worden ook gestript uit de payload), `answers.ts` (`buildAnswerRow` typed-column mapper voor text/number/date/bool/json), `forms.ts` (`resolveIntakeForm` cascade: program → settings.intake_default_form_id → tenant-default `is_default=true` → code-side sector-default; `isDynamicIntakeEnabled` checkt `settings_json.dynamic_intake_enabled === true`). **Feature-flag default OFF**: `tenants.settings_json.dynamic_intake_enabled` (config-only, geen schema-migratie); Houtrust en alle bestaande tenants blijven dus op de legacy `TryoutForm`-renderer. **Server action** `lib/actions/public/intake.ts` `submitIntake` resolvet tenant + form server-side (nooit client-trusted), valideert via Zod-rebuild, strijpt verborgen velden, extracteert canonical-targets naar gedenormaliseerde kolommen (contact_name/email/phone/dob, registration_target) en inserteert in `intake_submissions` + per-veld in `submission_answers`. Fire-and-forget bevestigingsmail `intake_submitted`-template naar de indiener. **UI**: `components/public/forms/dynamic-intake-form.tsx` is één client component met inline switch op 11 field_types (geen 11 aparte field-components — keuze voor maintenance over abstractie); `app/t/[slug]/proefles/page.tsx` controleert `isDynamicIntakeEnabled(tenant.settings_json)` en rendert óf `DynamicIntakeForm` óf de bestaande `TryoutForm` — geen breaking change. Admin-overzicht op `(tenant)/tenant/intake/page.tsx` is **read-only MVP** (filters/triage volgen Sprint 66) en getoond in sidebar onder "Inschrijvingen → Intake". **Email**: nieuwe DEFAULT_TEMPLATES-entry `intake_submitted` (lazy-seed per tenant zoals de Sprint 20-templates). **release_notes**: `platform_releases.body_json` (niet `sections_json`; column heet `body_json` in deze tabel). **Niet uitgevoerd in deze sprint**: compat-shim in `submitTryoutRegistration` (try/catch mirror naar intake_submissions), terminology-keys (`intake_singular`/`intake_plural` + submission_type_*), Vitest-tests voor buildZodFromFormConfig + isFieldVisible, audit-helper recordAudit-calls op submit/status-changes — staan als follow-up tasks. Admin-page is bewust nog niet terminology-driven; wordt opgepakt in Sprint 66 samen met de triage-acties.

- **Sprint 64 waitlist program-koppeling + intake-overrides (task #98, v0.20.0)**: Programs MVP fase 5. **SQL** (`sprint64_waitlist_programs.sql` + `sprint64_release_v0_20_0.sql`): kolommen `waitlists.program_id uuid null` en `waitlist_entries.program_id uuid null`, beide met composite-FK `(program_id, tenant_id)` → `programs(id, tenant_id)` `on delete set null` + partial index `where program_id is not null`; notification dedup-index/RPC drop+recreate (Sprint 41/43/53/55/57-patroon) met nieuwe key `waitlist_entry_program_assigned`, `source_ref` zal `waitlist_entries.id` zijn wanneer toekomstige flows admins notificeren over auto-koppeling. **App-laag** — intake-cascade in `submitPublicRegistration` (de wizard, niet de legacy `submitMembershipRegistration`) is uitgebreid: voor `parent`/`adult_athlete`-account-types resolved `intake_overrides_by_program[public_slug]` → `intake_overrides_by_target[child|self]` → `intake_default`. Bij `'waitlist'` schrijft de actie nu rechtstreeks naar `waitlist_entries` (incl. `program_id`!) en stuurt géén invite — pas wanneer een admin een aanbod doet wordt er een echte member aangemaakt. **Defense-in-depth**: parent met koppelcode-children (`mode='link'`) blijft altijd in registration-modus omdat het bestaande member is; trainer/staff is niet wachtlijst-eligible (zinloos). **Settings**: `intake-settings.ts` action heeft nu `intake_overrides_by_program` Zod-veld (sleutel = `programs.public_slug` zodat de URL-stable identifier bewaard blijft, niet program_id), lege map verwijdert de hele key uit settings_json. **UI**: `/tenant/registrations/instellingen` heeft een 3e `<fieldset>` "Per programma overrides" — `IntakeSettingsForm` accepteert `programs: Array<{public_slug, name, marketing_title}>` prop, page query filtert op `visibility='public' AND public_slug not null` (alleen deeplink-relevante programma's, anders dead-weight); empty-state rendert nette uitleg-card. **Audit**: `tenant_intake.update`-meta uitgebreid met `program_override_count` (geen aparte audit-key per-programma, want diffing van prior-state is overkill). **Geen wijziging** aan `submitMembershipRegistration` (legacy form heeft geen program_id-veld), `/tenant/wachtlijst`-page (bestaat niet — research-scope was filter, geskipt als scope-creep), of de RPC `create_public_registration` (cascade is server-action-side om RPC-signature stabiel te houden). **Houtrust-veilig**: program_id-kolommen nullable, geen settings backfill, IntakeSettingsForm-paneel verbergt zich automatisch wanneer er geen publieke programma's zijn.

- **Sprint 63 programs publieke marketplace (task #97, v0.19.0)**: Publieke marketplace + `?program=`-deeplink bovenop Sprint 60-62. **SQL** (`sprint63_programs_public.sql` + `sprint63_release_v0_19_0.sql`): policy `programs_public_read` op `public.programs` voor `anon`/`authenticated` (alleen rijen met `visibility='public'` AND `public_slug is not null`); kolommen `registrations.program_id uuid null` en `members.intended_program_id uuid null`, beide met composite-FK `(tenant_id, …)` → indexen; RPC `create_public_registration` drop+recreate met extra parameter `p_program_id uuid default null` + defense-in-depth check (`tenant_id` match + `visibility='public'`) zodat ook bij rauwe RPC-aanroep een non-public program wordt geweigerd; child-rijen erven hetzelfde `intended_program_id` van de parent. **App-laag**: `lib/db/programs-public.ts` (`listPublicMarketplacePrograms`, `countPublicMarketplacePrograms`, `getPublicProgramBySlug` — alle 3 scopen expliciet op `tenant_id` + `visibility='public'` + `public_slug not null` als defense-in-depth naast RLS); `publicOnboardingSchema.program_id` optional/nullable met `transform("" → null)`; `submitPublicRegistration` valideert program (in-tenant + public + slug not null) vóór RPC en stuurt `p_program_id` mee; `RegistrationWizard` accepteert `program?: RegistrationWizardProgramRef` prop met top-of-form banner (gekozen programma + uitleg "wordt automatisch gekoppeld") en geeft `program_id` mee in payload; `app/t/[slug]/inschrijven/page.tsx` leest `searchParams.program`, lookupt via slug, en negeert onbekende slugs **stilletjes** (geen 404, oude links blijven werken); 2 nieuwe routes `/t/[slug]/programmas/page.tsx` (lijst-grid met `marketing_title`/leeftijdslabel/`hero_image_url`/eerste 3 regels van `marketing_description` — `marketing_description` is **plain text** dus rendered met `whitespace-pre-wrap`, géén `dangerouslySetInnerHTML`) en `/t/[slug]/programmas/[publicSlug]/page.tsx` (detail met hero, beschrijving, highlights-bullets, CTA met `cta_label || "Inschrijven"` die linkt naar `/inschrijven?program=<slug>`); empty-state op lijst-page rendert **HTTP 200** met heading + uitleg + CTA's "Inschrijven"/"Proefles aanvragen" (Houtrust-veiligheid: `voetbalschool-houtrust` heeft 0 publieke programma's en de page rendert nog steeds netjes). **Nav**: `PublicNavKey` uitgebreid met `programmas`, `PublicSidebarProps`/`PublicHeaderProps`/`PublicMobileNavProps` met optionele `showProgrammas`-prop; `PublicTenantShell` voegt `countPublicMarketplacePrograms(tenant.id)` toe aan de bestaande `Promise.all`-batch en zet `showProgrammas={count>0}` — voor Houtrust dus géén nav-item, geen regressie. Sidebar-injectie zit tussen "Proefles" en "Inschrijven" met `Layers`-icoon. **Geen nieuwe `notifications.source`-keys** dus dedup-index ongewijzigd. **Geen nieuwe audit-keys** in deze sprint (registratie blijft `registration.created`).

- **Sprint 57-59 instructeursplanning MVP (task #89, v0.15.0)**: 3 idempotente SQL-files in `artifacts/nxttrack/supabase/`. Volgorde: `sprint57_instructor_planning.sql` (tabellen `instructor_availability`, `instructor_unavailability` met btree_gist exclusion-constraint tegen overlap, `session_instructors`; kolommen `groups.default_min_instructors`, `training_sessions.min_instructors`; view `session_instructors_effective` met `security_invoker=true` en **fallback naar group-trainers** wanneer geen expliciete `session_instructors`-rij — Houtrust-veiligheid; RPC `detect_instructor_conflicts` met 4 conflict_kind: `not_available_weekly`, `unavailable_explicit`, `double_booked`, `understaffed`; Sprint 41/43-patroon: dedup-index/RPC uitgebreid met `instructor.assignment.added`, `instructor.assignment.removed`, `instructor.substitute.assigned`) → `sprint58_release_v0_15_0.sql` (release notes) → `sprint59_instructor_conflicts_fix.sql` (RPC `detect_instructor_conflicts` herschreven n.a.v. code-review: `not_available_weekly` vlagt nu sessies buiten geconfigureerde wekelijkse beschikbaarheid, alléén wanneer instructeur ≥1 `available`/`preferred`-rij heeft op die weekdag — leeg = geen voorkeur = geen conflict; weekday-mapping `extract(isodow)::int - 1` → 0=ma..6=zo). App-laag: `lib/actions/tenant/instructors.ts` met `assertMemberInTenant` + `assertSessionInTenant` + `assertMemberHasTrainerRole` op alle write-paden (member_roles.role='trainer' OR tenant_roles.is_trainer_role=true). Audit-namespace: `instructor.availability.{added,updated,removed}`, `instructor.unavailability.{added,updated,removed}`, `session.instructor.{assigned,removed,substituted}`, `group.min_instructors.updated`, `session.min_instructors.updated`. UI: `/tenant/instructeurs/[memberId]` met 4 tabs (`?tab=`: beschikbaarheid|uitzonderingen|groepen|agenda) via `_tab-nav.tsx`; `_instructors-block.tsx` op sessie-detail accepteert `labels={singular,plural}` props; `components/tenant/min-instructors-field.tsx` is reusable inline editor gemount op group-detail én session-detail; publieke `/t/[slug]/agenda` voor instructeurs (eigen sessies, 90 dagen). Terminology overal via `getTenantTerminology` (incl. assignment-type label `Hoofd<singular>`). `getInstructorMember` en `listMemberGroups` in `lib/db/instructors.ts` checken trainer-rol via beide bronnen (member_roles + tenant_roles.is_trainer_role). **Niet uitgevoerd in deze sprint**: automated tests (view fallback regression, RPC-scenario's, RLS) — staan als follow-up tasks #90/#91/#92.

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
