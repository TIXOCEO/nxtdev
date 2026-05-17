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
- **Sprint history (gotchas archive)**: `artifacts/nxttrack/docs/sprint-history.md` — alle sprints t/m 65 staan hier; alleen de laatste ~3 sprints staan hieronder onder "Gotchas".

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

> Laatste ~4 sprints. Oudere sprint-gotchas (≤ Sprint 70) staan in `artifacts/nxttrack/docs/sprint-history.md`.

- **Sprint 77 backend-fundament fase 6 + fase 7 (task #136, v0.34.0, Optie B)**: Backend-bouwstenen voor (a) parent-portal-notificaties, (b) trainer-notitiesysteem met internal/external visibility, (c) visuele drag-n-drop agenda — alles zónder UI; die volgt na de UserShell-redesign in Sprint 78+. **SQL** (`sprint77_planning_fundament.sql` + `sprint77_release_v0_34_0.sql`, idempotent, dev+prod). **A) Notification dedup-pattern** (Sprint 41/43/53/55/57/64/65/66/73/74/76): drop+recreate `notifications_source_idem_uq` + `create_notification_with_recipients` (10-param signature uit sprint76g blijft) met 6 nieuwe `child_*`-keys: `child_attendance_recorded/missed/...session_cancelled/...membership_expiring/...placement_offered/...note_published`. Parent-routing zélf vereist géén SQL-uitbreiding — `lib/notifications/resolve-recipients.ts` doet sinds Sprint 11 al de **minor → parent reroute via `member_links`** voor elke candidate-member zonder `user_id`; nieuwe parent-flows targeten gewoon de child-member en de bestaande resolve-helper levert de juiste recipients. **B) Notes-systeem**: nieuwe tabel `training_attendance_notes(id, tenant_id, session_id, member_id, visibility ∈ internal|external, body 1-4000 char, author_member_id, author_user_id, created_at, updated_at)` met composite-FK pattern (Sprint 60+) op `(session_id,tenant_id)→training_sessions` + `(member_id,tenant_id)→members`, **unieke index op `(session_id, member_id, visibility)`** (één interne + één externe regel per leerling per sessie, upsert overschrijft body), partial index op `(member_id, created_at desc) where visibility='external'` voor de parent-feed, en updated_at-trigger. **RLS**: 4 policies — staff via `has_tenant_access` (alle visibility), lid-self via `members.user_id=auth.uid()` (alleen external), parent-via-`member_links` (alleen external + eigen kinderen), plus een belt-and-braces `no_direct_write all using(false) check(false)` policy zodat schrijven uitsluitend via de RPC kan. **RPC `upsert_member_note(p_session, p_member, p_visibility, p_body)`** (security definer): resolved tenant via session, cross-tenant-check session↔member, `has_tenant_access`-guard, author-member best-effort lookup via `members.user_id=auth.uid()`, upsert op de visibility-unique-index. Grant alleen aan `authenticated`. **C) Agenda-fundament**: `training_sessions.lock_version int not null default 0` (optimistic locking) + `training_sessions_tenant_starts_idx` op `(tenant_id, starts_at)`. **RPC `get_planning_window(tenant, from, to)`** (security definer, stable) — één call retourneert `{sessions, resources, instructors, groups}` als `jsonb` voor een venster (max **35 dagen** cap tegen abuse/N+1-renders); tenant-gate `has_tenant_access`, range-validatie `to>from`. **RPC `_compute_move_conflicts(session, new_starts, new_ends)`** (security definer, stable, internal helper): retourneert `jsonb`-array met `{type:'resource'|'instructor', ...}`-objecten — resource-conflicten via tstzrange-overlap op `session_resources` met andere bookings op dezelfde resource (alleen rows met expliciete starts_at/ends_at; sessie-impliciete bookings worden overgeslagen), instructor-conflicten via `session_instructors`-join op andere sessies in hetzelfde venster. **RPC `preview_move_session(session, new_starts, new_ends)`** (read-only dry-run voor drag-preview) en **RPC `move_session(session, new_starts, new_ends, expected_lock_version, force=false)`**: laatste lockt de sessie-row (`for update`) om concurrent moves te serializen, checkt `lock_version` (return `{ok:false, reason:'version_mismatch'}` zonder mutatie bij mismatch), berekent conflicts, retourneert `{ok:false, reason:'conflicts', conflicts}` tenzij `force=true`, anders update + bump `lock_version` + audit-row. **Audit-keys** `training.session.moved` (meta: `from/to_starts_at`, `from/to_ends_at`, `duration_diff_minutes`, `conflicts_overridden`, `forced`, `from/to_lock_version`) en `training.session.move_conflict` (mislukte poging, meta: `attempted_starts/ends_at`, `conflicts`). **TS-side**: `lib/notifications/event-labels.ts` uitgebreid met 6 nederlandstalige `child_*`-labels (parent-perspectief: "Aanwezigheid van je kind", "Nieuwe notitie over je kind", etc.); nieuwe helper `lib/notifications/parent-flags.ts` met `PARENT_NOTIFICATION_KEYS` constant + `isParentNotificationKey` type-guard + `isParentNotificationEnabled(settings_json, key)` (default-on bij ontbrekende settings of key). **Houtrust-veilig**: geen bestaande paden geraakt — nieuwe tabel + nieuwe RPCs + extra notif-keys + één nullable kolom met default. **Niet uitgevoerd** (follow-up): triggers die de nieuwe `child_*`-keys daadwerkelijk versturen (komen in Sprint 78 met de parent-portal UI-koppeling), tenant-admin UI voor `settings_json.parent_notifications`-toggles, Vitest voor `_compute_move_conflicts` (happy/resource/instructor/cross-tenant), pgTAP voor de notes-RLS (parent-A kan child-B niet lezen, member kan internal niet lezen), `move_session`-end-to-end test met seed-data, expiry voor stale lock_versions, recurrence/serie-edits (`move_session` werkt alleen op enkele sessies).

- **Sprint 76 capacity-available trigger + notificatie (task #121 + #130, v0.33.0)**: Wanneer ergens een plek vrijkomt (lid verlaat groep → `group_members` DELETE; admin verhoogt `groups.max_athletes`/`max_members`) schrijft DB-trigger `_trg_capacity_member_removed` / `_trg_capacity_groups_increased` een rij in `capacity_available_events` via security-definer helper `record_capacity_available_event` (day-dedup via partial unique op `(tenant_id, group_id, date)`, exception-tolerant zodat een mislukte registratie nooit de DELETE/UPDATE rollbackt). Daarna stuurt TS-haakje `notifyCapacityEventIfAny` (aangeroepen vanuit `removeMemberFromGroup` + `updateGroup` via dynamic import) een **in-app notificatie** naar role `tenant_admin` met titel `"Plek vrijgekomen in groep {X} — {N} kandidaten"`, `source='capacity_available_candidates'` (idempotent via dedup-key `source_ref=event_id`) en `pushUrl=/tenant/intake/vrijgekomen-plekken#evt-{eventId}`. Drempel per tenant via `tenants.settings_json.capacity_event_min_freed_seats` (default 1, sprint76g) — events onder de drempel blijven wel als rij staan zodat de UI-tile telt. Admins zien een 7e tile "Vrijgekomen plekken" op `/tenant/intake` + dedicated pagina `/tenant/intake/vrijgekomen-plekken` met scored kandidaat-lijst (stage 40 / program 25 / age 20 / preferred-days 15, FIFO-tiebreaker) uit `find_waitlist_candidates_for` (union van `intake_submissions.status='waitlisted'` + `waitlist_entries.status='waiting'`). Klik op de notificatie → deeplink met anchor scrollt naar de juiste CapacityEventCard. RPC `record_capacity_available_event` is **locked-down** (alleen `postgres` + `service_role`-execute, plus belt-and-braces `has_tenant_access`-guard in de body). **Detail-archief** (sprint76b/c/d/e/f/g review-rondes met scoring-iteraties, RPC-bugfixes, day-dedup-fix, lockdown, deeplink+drempel) staat in `artifacts/nxttrack/docs/sprint-history.md` onder "Sprint 76".

- **Sprint 75 publieke wachtrij-indicator (task #120, v0.32.0)**: Marketplace-kaarten en programma-detail tonen voortaan een groen/oranje/rood badge met label "Korte/Gemiddelde/Lange wachtrij"; géén exacte aantallen. **SQL** (`sprint75_waitlist_indicator.sql` + `sprint75_release_v0_32_0.sql`, idempotent): drie nullable kolommen op `programs` (`waitlist_threshold_low`, `waitlist_threshold_high`, `expected_wait_label` max 60 char) + check-constraints (≥0 én high≥low). Twee read-only views, beide `security_invoker=true`, `grant select` aan `authenticated,anon`: `program_waitlist_indicator` (per programma) en `program_waitlist_indicator_by_stage` (per stage via `group_stages → groups → training_sessions`). **Capacity-window**: `program_capacity_overview` (Sprint 62) gefilterd op `starts_at > now() AND < now() + interval '84 days' AND status<>'cancelled'`; per-row `max(fixed + flex - used, 0)` daarna gesommeerd en nogmaals geclampt naar ≥0. **Waiting-tak** is COALESCE-som van twee bronnen: `intake_submissions.status='waitlisted'` (Sprint 73/74) + `waitlist_entries.status='waiting'` (Sprint 49/64); beide moeten een `program_id` hebben (zonder kunnen we niet aggregeren). Per-stage variant gebruikt `coalesce(selected_stage_id, recommended_stage_id)` voor submissions; `waitlist_entries` heeft géén stage-veld en wordt alleen meegeteld in het programma-totaal — niet in de stage-tabel. **Anon-leesbaarheid**: vanwege RLS op de onderliggende tabellen kan de anon-rol de views feitelijk niet uitlezen via de gewone client. App-laag gebruikt daarom de **admin-client** voor view-reads en filtert expliciet op tenant_id + program_id; de views exposen alleen aggregaat-counts (geen PII). **Pure helper** `lib/programs/bucket-waitlist.ts` (`bucketWaitlistPressure`, `waitlistBadgeMeta`, defaults low=5/high=15) — regels van streng naar mild: `available<=0 OR waiting>=high → long`; `waiting>=low → medium`; anders `short`. Defensief: clamp naar ≥0 + zorg dat high≥low om dronken thresholds op te vangen. **App-laag**: `lib/db/programs-public.ts` herschreven met `listPublicMarketplaceProgramsWithIndicator` (anon `programs.select` → admin-client view-reads → bucket-mapping per rij), `getProgramWaitlistIndicator` en `listProgramStageIndicators`. ProgramRow + PROGRAM_COLUMNS in `lib/db/programs.ts` uitgebreid met 4 velden (incl. `use_stages` dat voor de detail-pagina nodig was). `lib/validation/programs.ts` `updateProgramSchema` uitgebreid + refinement `waitlist_threshold_high ≥ waitlist_threshold_low`; `lib/actions/tenant/programs.ts` `updateProgram` schrijft de 3 nieuwe velden weg. **UI**: nieuwe component `components/public/waitlist-badge.tsx` (kleur-dot + label + optioneel "· {expected_wait_label}"-suffix). Marketplace-kaart op `/t/[slug]/programmas/page.tsx` toont badge top-right over de hero-image. Detail-pagina `[publicSlug]/page.tsx` heeft een prominent "Beschikbaarheid"-blok (size=md badge) en — wanneer `program.use_stages && stageIndicators.length>0` — een mini-tabel "Niveau · Status" met per-stage badges (sortering `stage_sort_order, stage_name`). Beide pages fetchen via `Promise.all` (programma + indicator + stage-indicators parallel). **Tenant-admin form** (`_overview-form.tsx`) heeft een nieuwe sectie "Wachtrij-indicator" met 3 velden (twee numeric inputs + tekst max 60 char) + uitleg-blokje over de heuristiek. **Houtrust-veilig**: lege defaults op kolommen + lege waitlist-bronnen → `waiting_count=0` + `available_seats` afhankelijk van capaciteit → bucket `short`/`long` (groen wanneer er plek is, rood wanneer geen sessies of vol). **Geen nieuwe notification-keys, geen nieuwe RLS-policies**. **Niet uitgevoerd**: Vitest voor `bucketWaitlistPressure`-grensgevallen (low=0, equal-to-low, high=low, available=0+waiting=0), pgTAP voor de twee views (multi-tenant isolation, capacity-window-grenzen), Playwright voor de marketplace→detail-flow met seeded fixtures, drempel-presets per sector (zwemschool 5/15 vs voetbal 10/25 — nu één globale default), real-time refresh van het badge na admin-actie (`revalidatePath` op publieke routes — momenteel `force-dynamic` waardoor het bij volgende request fresh komt).

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
