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

- **Sprint 76 capacity-available trigger + notificatie (task #121 + #130, v0.33.0)**: Wanneer ergens een plek vrijkomt (lid verlaat groep → `group_members` DELETE; admin verhoogt `groups.max_athletes`/`max_members`) schrijft DB-trigger `_trg_capacity_member_removed` / `_trg_capacity_groups_increased` een rij in `capacity_available_events` via security-definer helper `record_capacity_available_event` (day-dedup via partial unique op `(tenant_id, group_id, date)`, exception-tolerant zodat een mislukte registratie nooit de DELETE/UPDATE rollbackt). Daarna stuurt TS-haakje `notifyCapacityEventIfAny` (aangeroepen vanuit `removeMemberFromGroup` + `updateGroup` via dynamic import) een **in-app notificatie** naar role `tenant_admin` met titel `"Plek vrijgekomen in groep {X} — {N} kandidaten"`, `source='capacity_available_candidates'` (idempotent via dedup-key `source_ref=event_id`) en `pushUrl=/tenant/intake/vrijgekomen-plekken#evt-{eventId}`. Drempel per tenant via `tenants.settings_json.capacity_event_min_freed_seats` (default 1, sprint76g) — events onder de drempel blijven wel als rij staan zodat de UI-tile telt. Admins zien een 7e tile "Vrijgekomen plekken" op `/tenant/intake` + dedicated pagina `/tenant/intake/vrijgekomen-plekken` met scored kandidaat-lijst (stage 40 / program 25 / age 20 / preferred-days 15, FIFO-tiebreaker) uit `find_waitlist_candidates_for` (union van `intake_submissions.status='waitlisted'` + `waitlist_entries.status='waiting'`). Klik op de notificatie → deeplink met anchor scrollt naar de juiste CapacityEventCard. RPC `record_capacity_available_event` is **locked-down** (alleen `postgres` + `service_role`-execute, plus belt-and-braces `has_tenant_access`-guard in de body). **Detail-archief** (sprint76b/c/d/e/f/g review-rondes met scoring-iteraties, RPC-bugfixes, day-dedup-fix, lockdown, deeplink+drempel) staat in `artifacts/nxttrack/docs/sprint-history.md` onder "Sprint 76".

- **Sprint 75 publieke wachtrij-indicator (task #120, v0.32.0)**: Marketplace-kaarten en programma-detail tonen voortaan een groen/oranje/rood badge met label "Korte/Gemiddelde/Lange wachtrij"; géén exacte aantallen. **SQL** (`sprint75_waitlist_indicator.sql` + `sprint75_release_v0_32_0.sql`, idempotent): drie nullable kolommen op `programs` (`waitlist_threshold_low`, `waitlist_threshold_high`, `expected_wait_label` max 60 char) + check-constraints (≥0 én high≥low). Twee read-only views, beide `security_invoker=true`, `grant select` aan `authenticated,anon`: `program_waitlist_indicator` (per programma) en `program_waitlist_indicator_by_stage` (per stage via `group_stages → groups → training_sessions`). **Capacity-window**: `program_capacity_overview` (Sprint 62) gefilterd op `starts_at > now() AND < now() + interval '84 days' AND status<>'cancelled'`; per-row `max(fixed + flex - used, 0)` daarna gesommeerd en nogmaals geclampt naar ≥0. **Waiting-tak** is COALESCE-som van twee bronnen: `intake_submissions.status='waitlisted'` (Sprint 73/74) + `waitlist_entries.status='waiting'` (Sprint 49/64); beide moeten een `program_id` hebben (zonder kunnen we niet aggregeren). Per-stage variant gebruikt `coalesce(selected_stage_id, recommended_stage_id)` voor submissions; `waitlist_entries` heeft géén stage-veld en wordt alleen meegeteld in het programma-totaal — niet in de stage-tabel. **Anon-leesbaarheid**: vanwege RLS op de onderliggende tabellen kan de anon-rol de views feitelijk niet uitlezen via de gewone client. App-laag gebruikt daarom de **admin-client** voor view-reads en filtert expliciet op tenant_id + program_id; de views exposen alleen aggregaat-counts (geen PII). **Pure helper** `lib/programs/bucket-waitlist.ts` (`bucketWaitlistPressure`, `waitlistBadgeMeta`, defaults low=5/high=15) — regels van streng naar mild: `available<=0 OR waiting>=high → long`; `waiting>=low → medium`; anders `short`. Defensief: clamp naar ≥0 + zorg dat high≥low om dronken thresholds op te vangen. **App-laag**: `lib/db/programs-public.ts` herschreven met `listPublicMarketplaceProgramsWithIndicator` (anon `programs.select` → admin-client view-reads → bucket-mapping per rij), `getProgramWaitlistIndicator` en `listProgramStageIndicators`. ProgramRow + PROGRAM_COLUMNS in `lib/db/programs.ts` uitgebreid met 4 velden (incl. `use_stages` dat voor de detail-pagina nodig was). `lib/validation/programs.ts` `updateProgramSchema` uitgebreid + refinement `waitlist_threshold_high ≥ waitlist_threshold_low`; `lib/actions/tenant/programs.ts` `updateProgram` schrijft de 3 nieuwe velden weg. **UI**: nieuwe component `components/public/waitlist-badge.tsx` (kleur-dot + label + optioneel "· {expected_wait_label}"-suffix). Marketplace-kaart op `/t/[slug]/programmas/page.tsx` toont badge top-right over de hero-image. Detail-pagina `[publicSlug]/page.tsx` heeft een prominent "Beschikbaarheid"-blok (size=md badge) en — wanneer `program.use_stages && stageIndicators.length>0` — een mini-tabel "Niveau · Status" met per-stage badges (sortering `stage_sort_order, stage_name`). Beide pages fetchen via `Promise.all` (programma + indicator + stage-indicators parallel). **Tenant-admin form** (`_overview-form.tsx`) heeft een nieuwe sectie "Wachtrij-indicator" met 3 velden (twee numeric inputs + tekst max 60 char) + uitleg-blokje over de heuristiek. **Houtrust-veilig**: lege defaults op kolommen + lege waitlist-bronnen → `waiting_count=0` + `available_seats` afhankelijk van capaciteit → bucket `short`/`long` (groen wanneer er plek is, rood wanneer geen sessies of vol). **Geen nieuwe notification-keys, geen nieuwe RLS-policies**. **Niet uitgevoerd**: Vitest voor `bucketWaitlistPressure`-grensgevallen (low=0, equal-to-low, high=low, available=0+waiting=0), pgTAP voor de twee views (multi-tenant isolation, capacity-window-grenzen), Playwright voor de marketplace→detail-flow met seeded fixtures, drempel-presets per sector (zwemschool 5/15 vs voetbal 10/25 — nu één globale default), real-time refresh van het badge na admin-actie (`revalidatePath` op publieke routes — momenteel `force-dynamic` waardoor het bij volgende request fresh komt).

- **Sprint 74 auto-waitlist + slot-offer (task #119, v0.31.0)**: Aanmeldingen zonder vrije plek gaan automatisch op de wachtlijst en admins kunnen vanuit het plaatsings-paneel een plek aanbieden via een tijdelijk token-link in een e-mail. **SQL** (`sprint74_intake_slot_offers.sql` + `sprint74_release_v0_31_0.sql`, idempotent): nieuwe tabel `intake_slot_offers` met composite-FK's `(submission_id,tenant_id)→intake_submissions` en `(group_id,tenant_id)→groups` (Sprint 60+-pattern), `token uuid unique default gen_random_uuid()`, status-check `(pending,accepted,declined,expired,cancelled)`, `expires_at/used_at`, RLS-policy `has_tenant_access(tenant_id)`, partial indexen op `token where used_at is null`, `(submission_id, created_at desc)` voor de tijdlijn, en `expires_at where used_at is null and status='pending'` voor toekomstige cleanup-jobs. **Notification dedup-pattern** (Sprint 41/43/53/55/57/64/65/66/73): drop+recreate van `notifications_source_idem_uq` + `create_notification_with_recipients` met drie nieuwe keys (`intake_slot_offered`, `intake_slot_accepted`, `intake_slot_declined`, allemaal `source_ref=intake_slot_offers.id`) plus de eerder vergeten `intake_submission_auto_waitlisted` (`source_ref=intake_submissions.id`). **Geen schema-wijziging** aan `intake_submissions` — de bestaande `waitlisted`-status uit Sprint 73 wordt hergebruikt. **Release-SQL gebruikt `body_json`** (niet `sections_json` zoals de eerdere sprints suggereerden — daadwerkelijke kolom is `body_json` met keys `new/improved/fixed/admin`). **App-laag — gedeelde core**: `lib/intake/place-submission-core.ts` (`server-only`, géén `assertTenantAccess`) bevat de echte plaatsings-logica (status-check `allowedFrom=[submitted,in_review,needs_review,waitlisted]`, group-tenant-match, status→placed, top5_max_score-capture, audit `intake.submission.placed` met `from_status/to_status/via_slot_offer/slot_offer_id`-meta). `lib/actions/tenant/placements.ts` is gestript tot een dunne wrapper die `assertTenantAccess` doet en de core aanroept; `lib/intake/respond-slot-offer.ts` (token-route, géén auth) gebruikt diezelfde core met sentinel-actor `00000000-…` zodat audit-meta consistent blijft. **Auto-waitlist** in `lib/actions/public/intake.ts`: alleen wanneer `initialStatus==='submitted'` (niet bij `needs_review`); haalt `scorePlacementCandidates`, leest top-1 `capacity_match`. Bij `0` → `update status='waitlisted'` + audit `intake.submission.auto_waitlisted` (`reason='no_capacity'`, `top1_score`) + e-mail `intake_waitlisted` + in-app notificatie. RPC-fout → géén waitlist (laat 'submitted', Houtrust-veilig — die heeft 0 submissions). **`offerIntakeSlot`** (`lib/actions/tenant/slot-offers.ts`): valideert allowedFrom + contact_email aanwezig + group-tenant-match, leest `tenants.settings_json.intake_slot_offer_ttl_hours` (default 72, cap 24·30 uur), inserteert offer-rij, bouwt `accept_url`/`decline_url` via `appBaseUrl()` (bewust géén `tenantUrl` — token is enige autoriteit; tenant-rewrite zou `/t/<slug>/intake-slot/...` opleveren wat niet bestaat), `middleware.ts` heeft expliciete exclusion `pathname.startsWith('/intake-slot/')` als belt-and-suspenders, stuurt mail `intake_slot_offered` + in-app notificatie, logt `intake.slot_offer.created`. **`cancelIntakeSlotOffer`** voor admin-intrekken (alleen pending → cancelled). **`respondToSlotOffer`** (publieke token-route) doet een **atomaire claim** (`update ... where token=? and status='pending' and used_at is null and expires_at > now() returning ...`) zodat twee gelijktijdige klikken nooit beide de post-processing draaien; bij `0` rows update gevolgd door `peekSlotOffer(token)` om reden te bepalen (`expired/accepted/declined/cancelled/not_found`). Bij succesvolle claim: op accept call `placeSubmissionCore({viaSlotOffer:true, slotOfferId})` + bevestigingsmail `intake_slot_confirmation` + notificatie `intake_slot_accepted`; als place faalt (bv. submission al placed via andere weg) wordt de claim teruggedraaid naar `pending`. Op decline: submission terug naar `waitlisted` mits reopenable + notificatie `intake_slot_declined`. **Mutation-on-GET vermeden** (mail-scanners/link-prefetchers): `/intake-slot/[token]/accept|decline/page.tsx` doet alleen `peekSlotOffer` op GET en rendert een client `<SlotConfirmCard>` met `<form action={submitSlotResponse}>` — pas op de POST-klik draait de mutatie. `submitSlotResponse` ("use server", in `lib/actions/public/slot-response.ts`) is een dunne wrapper rond `respondToSlotOffer`. **Lege resultaat-shape** is gestructureerd `{status: accepted|declined|expired|already_used|not_found|error, message, groupName?, submissionId?}` zodat de page-route altijd nette UI rendert (idempotent: tweede klik op accepteer-link geeft "already_used" i.p.v. crash). **Publieke routes**: `app/intake-slot/[token]/accept/page.tsx` + `decline/page.tsx` zijn server-components buiten elke layout (geen tenant-cookie/sidebar nodig); rendert `<SlotResponseCard>` standalone. **UI tenant**: `PlacementSuggestionsPanel.tsx` heeft naast "Plaats hier" nu een secundaire knop "Plek aanbieden" met confirm-popover die `offerIntakeSlot` aanroept; `SubmissionSlotOffers.tsx` toont chronologische tijdlijn op submission-detail met status-dot (`pending=#d68910`, `accepted=#1f9d55`, `declined/expired/cancelled` grijstinten), "Verstuurd/Verloopt/Reactie"-timestamps, en een "Intrekken"-knop op pending-aanbiedingen (alleen tenant-admin); detail-page laadt offers + group-namen in parallel met de bestaande audit-history-query. **3 nieuwe e-mail-templates** in `default-templates.ts`: `intake_waitlisted` (`{{contact_name}}/{{form_name}}`), `intake_slot_offered` (`{{contact_name}}/{{group_name}}/{{accept_url}}/{{decline_url}}/{{expires_label}}` — datum-format `nl-NL` long-month + 24u-tijd), `intake_slot_confirmation` (`{{contact_name}}/{{group_name}}`). Wrappen via dezelfde `wrap(heading, body)`-helper als de andere templates; accept/decline-knoppen zijn inline-styled CTA's. **Houtrust-veilig**: zonder `dynamic_intake_enabled` komt er nooit een intake binnen → 0 auto-waitlist-paden, 0 slot-offers. **Niet uitgevoerd**: Vitest voor `respondToSlotOffer` happy/expired/already-used/wrong-decision (follow-up), pgTAP voor de slot-offer-tabel + dedup-RPC, Playwright voor end-to-end submit→auto-waitlist→offer→accept-flow, expiry-cleanup-cron (alleen UI-laag toont "verlopen" bij `expires_at < now()` op pending — daadwerkelijke `status='expired'`-flip gebeurt pas bij een klik op de verlopen link), per-tenant override van de e-mail-templates via admin-UI (templates staan in defaults — lazy-seed-pad bestaat al elders), session-id koppeling op slot-offers (kolom bestaat maar wordt nog niet gevuld omdat de UI op group-niveau aanbiedt, niet sessie-niveau).

- **Sprint 73 submission lifecycle + stage-aanbeveling (task #118, v0.30.0)**: Vervangt de oude `submitted → placed`-mini-flow door een volledige lifecycle (`submitted, in_review, needs_review, waitlisted, placed, rejected, converted`) + rule-based stage-aanbeveling + auto-needs-review-heuristiek. **SQL** (`sprint73_submission_lifecycle.sql` + `sprint73_release_v0_30_0.sql`, idempotent): defensieve UPDATE'jes `reviewing→in_review` / `eligible→submitted` / `cancelled→rejected` (no-op op lege tabellen — beide DBs hadden 0 submissions); `intake_submissions_status_check` drop+recreate met de 7 nieuwe waarden; partial index `intake_submissions_tenant_needs_review_idx on (tenant_id, created_at desc) where status='needs_review'` voor de kop-tile-query. Notification dedup-index + RPC drop+recreate (Sprint 41/43/53/55/57/64/65/66-pattern) met nieuwe key `intake_submission_needs_review`, `source_ref = intake_submissions.id`. **Pure helpers** (geen DB-roundtrip): `lib/intake/recommend-stage.ts` (zwemschool: `preferred_level=a/b/c` → Schoolslag/Rugslag/Afzwem-ready, `can_float=false` → Watergewenning, `can_float=true && underwater_comfort=false` → Drijven; voetbal: leeftijdsklassen O7..O19; generic: `null`) en `lib/intake/needs-review.ts` (medische velden niet-leeg, leeftijd buiten `programs.age_min/age_max`, "weet ik niet/onbekend"-tokens, zwemschool zonder herkenbaar niveau). **Publieke submit** (`lib/actions/public/intake.ts`): Sprint 72 `preferred_level`-naam-match blijft primair; bij geen match valt het terug op `recommendStage()` (case-insensitive matching tegen `program_stages.name`). Daarna draait `needsReview()`; `initialStatus = 'needs_review' | 'submitted'`. **Belangrijke fix uit review**: `program_id` wordt nu géén leeg-laten meer — het wordt eerst tenant-gevalideerd (`programs.select.eq(tenant_id).eq(id)`) en pas dan op de submission-rij gepersisteerd, zodat downstream stage/placement-logica geen aanname hoeft te doen. Extra `sendNotification` met source `intake_submission_needs_review` + redenen in contentText (idempotent dankzij dedup-key). **Tenant actions** (`lib/actions/tenant/submission-status.ts`): `markSubmissionInReview/NeedsReview/Waitlisted`, `rejectSubmission`, `updateSelectedStage` met strikte from→to-validatie + audit-keys `intake.submission.{reviewed,status_changed,rejected,stage_selected}`. Terminale statussen (`placed/rejected/converted`) blokkeren elke verdere status-mutatie; `updateSelectedStage` mag wél op terminale statussen want stage-keuze is meta-data, geen status. **`placeSubmission` cleanup uit review**: ook hier nu strikte `allowedFrom=['submitted','in_review','needs_review','waitlisted']` check + audit-meta uitgebreid met `from_status`/`to_status='placed'` zodat lifecycle-tracking compleet is. **UI**: `SubmissionStatusStrip.tsx` (color-coded status-dot + actie-knoppen op detailpagina, wachtlijst+afwijzen openen een confirm-popover met optionele reden, `useTransition` + `router.refresh()`); `RecommendedStageBadge.tsx` (toont selected_stage óf fallback recommended_stage met source-label, "Pas aan" popover met select-dropdown over alle `program_stages` van het programma + "Geen stage"-optie). Intake-lijst-page heeft nieuwe kop-tile "Vereist beoordeling" (oranje accent + count via `head:true count:'exact'`-query, alleen zichtbaar bij `dynamic_intake_enabled` én count>0) + status-dots in de status-kolom; `STATUS_LABEL`/`STATUS_COLOR` mappings uitgebreid in beide pages. Detailpagina laadt `program_stages` (sorted by sort_order) + namen van recommended/selected stage in parallel; strip + badge alleen voor tenant-admins (staff ziet ze niet). **Geen schema-wijziging aan `programs/program_stages`**, geen nieuwe permissions. **Niet uitgevoerd**: Vitest voor `recommendStage`/`needsReview` (task #118 follow-up), pgTAP voor de status-check-constraint + dedup-RPC, Playwright voor de end-to-end triage-flow, converted-status flow (omzetting submission → registration/member — Sprint 74-territorium).

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
