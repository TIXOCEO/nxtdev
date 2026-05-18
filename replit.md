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

> Laatste ~4 sprints. Oudere sprint-gotchas (≤ Sprint 80) staan in `artifacts/nxttrack/docs/sprint-history.md`.

- **Sprint 82 patches v0.40.1 + v0.40.2 (tasks #145/#147/#148, patch-releases)**: Drie kleine follow-ups op de Sprint 82 slimme-intake flow. **v0.40.1** (sprint82d): admin-knop "Stuur 3 voorstellen aan aanvrager" op `/tenant/intake/[id]` via nieuwe server-action `sendIntakeReviewLink` (lib/actions/tenant/intake-review-link.ts) — eigen `assertTenantAccess`-autoriteit los van publieke `public_intake_propose_slots`-flag, genereert vers token (7d) + overschrijft eventueel bestaand token op de submission, faalt vroeg bij ontbrekend contact_email of terminale status (placed/rejected/converted), verstuurt template `intake_review_link` via `tenantUrl()` deep-link, logt audit `intake.review_link_sent`. Nieuwe `SendReviewLinkButton.tsx` client-component met confirm-dialog. Mail-template `intake_review_link` toegevoegd aan `default-templates.ts` + idempotente seed-SQL (`sprint82d_intake_review_link_template.sql`) voor bestaande tenants. **v0.40.2** (sprint82e): (a) Op de admin-detail-pagina toont `SendReviewLinkButton` nu onder de knop "Laatst verstuurd op {datum}" + "Link nog geldig tot {datum}" — page leest `review_token_expires_at` + recent audit-row `intake.review_link_sent` en geeft `lastSentAt`/`linkValidUntil` als props. Knop-label wordt "Stuur nieuwe voorstellen-link" wanneer een actieve link bestaat (preventie dubbele mails). `SubmissionHistory.describeRow` mapt audit-key naar "Voorstellen-link verstuurd". (b) Nieuwe shared component `ExpiredReviewLinkNotice.tsx` op `/voorstellen` én `/geen-plek`: bij ontbrekend/verlopen/al-gebruikt token rendert een vriendelijke uitleg (7d geldig + single-use) met "Neem contact op"-mailto-knop (resolved via nieuwe `getTenantContactEmailBySlug`: `tenant_email_settings.reply_to_email` → fallback `tenants.contact_email`) en "Naar de homepage"-link. Mailto-button rendert altijd (wanneer geen contact-mail bekend is → fallback-link naar tenant-homepage zodat aanvrager nooit zonder route achterblijft). Geen schema-wijzigingen voor v0.40.2 — `review_token_*` kolommen + `intake.review_link_sent` audit-key bestaan al sinds Sprint 82. Release-rows via `sprint82d_release_v0_40_1.sql` + `sprint82e_release_v0_40_2.sql` (idempotent, dev+prod gedraaid). **Tests** (#146, geen versie-bump): Vitest-suites voor `isFieldVisible` (equals/not_equals/in operator-prioriteit + coercion) en `wait-time` (tone + label, plus mock-supabase die view-kolomcontract bevriest), pgTAP-test voor `notifications_source_idem_uq` partial unique + chooseProposedSlot single-use, Playwright-spec voor submit→/voorstellen→accept + token-replay (default geskipt; `RUN_E2E_INTAKE=1` + `APP_BASE_URL` + `TEST_TENANT_SLUG` activeert). `vitest.config.ts` + `playwright.config.ts` toegevoegd. **Bug-vermijding-tip**: bij vervolg-actions die een review-token overschrijven → altijd EERST oude `review_token_hash=null` zetten via een dedicated update vóór `randomBytes(32)`-generatie, anders kan in een race-conditie kortstondig de oude hash + nieuwe token co-existeren wat de unique-partial-index laat falen. `sendIntakeReviewLink` doet dit correct via één enkele update-statement met de nieuwe hash + expires_at.

- **Sprint 82 slimme intake — 3 tijdsblok-voorstellen + transparante wachtlijst (task #144, v0.40.0)**: Maakt het publieke inschrijfformulier slimmer met (A) conditional fields via uitgebreide `show_if`-engine, (B) wachttijd-schatting per (group, stage), (C) een publieke "kies-je-tijdsblok"-pagina met top-3 voorstellen na intake-submit, en (D) een transparante "geen plek — wachtlijst?"-keuze i.p.v. stille auto-waitlist. **SQL** (`sprint82_smart_intake.sql` + `sprint82_release_v0_40_0.sql`, idempotent, dev+prod). **A) Review-token-kolommen** op `intake_submissions`: `review_token_hash text` + `review_token_expires_at timestamptz` + unique partial index op `review_token_hash where review_token_hash is not null`. Token = `randomBytes(32).toString('hex')`, hash = sha256, TTL 7 dagen. Token-flow ondersteunt anonieme aanvragers die via mail-link binnenkomen op /voorstellen of /geen-plek — autoriteit is het token zelf (geen `assertTenantAccess`). **B) View `program_group_waitlist_estimate`** (security_invoker=true, grants `anon,authenticated`): per (tenant_id, group_id, stage_id) joint `groups` × `group_stages` × `capacity_resources` × `waitlists`. Formule: `case when open_slots>0 then 0 else least(52, greatest(0, waitlist_count*4)) end`. Tone-mapping in `lib/intake/wait-time.ts`: ≤2 wk groen, 3-8 wk geel, >8 wk rood. **C) `show_if`-engine uitgebreid**: `IntakeShowIf` ondersteunt nu `equals` (legacy), `not_equals` en `in` (array). Prioriteit: `in` > `not_equals` > `equals`. `isFieldVisible()` in `lib/intake/build-schema.ts` evalueert via `valueMatches()`-helper met boolean/number-coercion. Zod-schema in `lib/actions/tenant/intake-forms.ts` (`fieldSchema.show_if`) en de inline-typed `ShowIfEditor` in `app/(tenant)/tenant/intake/forms/[id]/builder/_builder.tsx` verbreed naar dezelfde shape — backwards compatible: bestaande rows met alleen `equals` blijven 1:1 werken. **D) Sector-default zwemschool**: nieuw `had_lessons`-veld bovenaan (radio ja/nee, required, sort_order=55), `current_level` krijgt `show_if: {field_key:'had_lessons', equals:'ja'}` — leeg wanneer "Nee" → branching werkt direct in de Houtrust default-flow. **E) Server-actions** (`lib/actions/public/propose-slot.ts`, anoniem via review-token): `resolveSubmissionByReviewToken(plain)` hasht en checkt expiry; `chooseProposedSlot({reviewToken, groupId, ...})` maakt `intake_slot_offers`-rij met **48u TTL** (hardcoded, niet via `tenant.settings_json.intake_slot_offer_ttl_hours`) en retourneert `redirectUrl` naar `${appBaseUrl()}/intake-slot/<token>/accept` (bestaande Sprint 74-flow); `confirmWaitlistChoice` zet status='waitlisted' + audit `intake.submission.waitlist_confirmed` + mail `intake_waitlisted`; `cancelSubmissionChoice` zet status='rejected' + audit `intake.submission.cancelled_by_applicant`. Alle drie loggen `source: "public_propose_slots"` in meta. **F) Feature-flag** `tenants.settings_json.public_intake_propose_slots` default false. `submitIntake` checkt de flag ná de submission-insert: aan → genereer review-token + return `{ok:true, data:{submissionId, redirectUrl:'/t/<slug>/inschrijven/voorstellen?token=<plain>'}}` en skip auto-waitlist; uit → Sprint 74-gedrag (auto-waitlist bij capacity=0) blijft 1:1 werken. Token-failure → silently fallback naar legacy pad zodat aanvrager nooit in dood spoor belandt. **G) UI publiek**: nieuwe routes `/t/[slug]/inschrijven/voorstellen` (server-component: leest token, roept `scorePlacementCandidates` aan, joint group_names, computeert wait-weeks per row via `getWaitEstimate(admin, ...)`, sorteert op `capacity_match>0 → wait_weeks → total_score`, redirect naar `/geen-plek` wanneer geen kandidaten of `capacity_match=0` overal; rendert `ChooseSlotList` client-component met tone-badges) en `/t/[slug]/inschrijven/geen-plek` (rendert `NoCapacityChoiceForm` met 2 expliciete knoppen — wachtlijst of annuleren). `DynamicIntakeForm.tsx`: bij `res.ok && res.data?.redirectUrl` → `window.location.assign(redirectUrl)`. **H) UI tenant**: nieuwe route `/(tenant)/tenant/settings/intake/page.tsx` met `IntakeSettingsToggle`-switch + `setPublicProposeSlots` server-action (audit-key `tenant.settings.intake_propose_slots`). **Houtrust-veilig**: flag default false → identieke UX als pre-Sprint 82 totdat tenant-admin de toggle aanzet; conditional `had_lessons` toegevoegd aan sector-default maar oude submissions worden niet hervalideerd. **Niet uitgevoerd (drift)**: admin-UI knop "Stuur 3 voorstellen aan aanvrager" op `/tenant/intake/[id]` (review-link via mail naar admin-flow) — DB-fundament staat klaar (token-kolommen), UI volgt in vervolgsprint; `/tenant/programs/[id]/stages` wachttijd-kolom niet uitgevoerd (route bestaat niet in deze codebase); geen Vitest voor `isFieldVisible`-operatoren of `getWaitEstimate`-tone-mapping; geen pgTAP voor de unique-index op `review_token_hash`; geen Playwright voor de end-to-end submit → /voorstellen → /intake-slot/<token>/accept flow. Tokens worden **single-use**: na succesvolle `chooseProposedSlot`/`confirmWaitlistChoice`/`cancelSubmissionChoice` zet de action `review_token_hash=null` + `review_token_expires_at=null` zodat replay onmogelijk wordt vóór expiry. View `program_group_waitlist_estimate` levert kolommen `current_waitlist_count` + `estimated_wait_weeks` — TS select moet exact diezelfde namen gebruiken (column-mismatch maakt PostgREST stilletjes data=null en zou ranking degraderen). **Sprint 82b fixes (post-review)**: (1) Publieke RPC `score_placement_candidates_public(submission_id, token_hash)` — security definer met token-validatie i.p.v. `has_tenant_access`, granted aan `anon`+`authenticated`. Wrapper `scorePlacementCandidatesPublic` in `lib/db/placement.ts` gebruikt admin-client + sha256-hash, gerendeerd in `/voorstellen` én vóór `chooseProposedSlot`-constraint. (2) Rationale_json emit `target_stage_id` (UUID van resolved stage) zodat wachttijd-lookup in `program_group_waitlist_estimate` accuraat is i.p.v. `stage_id IS NULL`-fallback. (3) `recommend-stage.ts` voor zwemschool: `hadLessons === false` → "Watergewenning" met rationale "Nog geen zwemles gehad", geplaatst ná age-gate maar vóór level/floats-checks. (4) `sprint82c_release_correction.sql` herstelt de release-row body_json: claim "Stuur 3 voorstellen aan aanvrager" verwijderd (admin-knop is follow-up #145, niet shipped in v0.40.0). **Bug-vermijding-tip**: review-token-hash MUST gebruiken `createHash('sha256').update(plain).digest('hex')` met identieke encoding op write + read — verschil tussen `digest('hex')` en `digest('base64url')` of trailing-whitespace zou de unique-index-lookup laten falen zonder herkenbare error. `chooseProposedSlot` gebruikt 48u TTL hardcoded i.p.v. `intake_slot_offer_ttl_hours`-setting (Sprint 74) zodat de publieke flow voorspelbaar blijft ongeacht admin-config; bij wijziging in toekomst → wel via setting laten lopen, anders krijgen aanvragers verrassend lange/korte expiry-windows.

- **Sprint 81 UserShell shell-modus + trainer-menu (task #143, v0.39.0-pending)**: Verfijnt het Sprint 80-fundament met (A) een twee-panel sidebar die wisselt tussen **rol-modus** (Home + Trainer + Mijn sport + Mijn account) en **publieke modus** (Algemeen + Pagina's) via een 300ms-translateX-animatie; default = rol-modus voor ingelogde users met trainer/parent/athlete-rol, persist in `sessionStorage` onder key `nxt-shell-mode-{slug}`. Pijl-links + Globe-icoon bovenaan rol-modus schakelt naar publiek; accent-knop onderaan publiek-paneel ("Trainerportaal" voor trainers, anders "Leerlingportaal") schakelt terug. Niet-ingelogden zien altijd alleen het publieke paneel, géén toggle-UI. Twee panelen renderen als `absolute inset-0` met `translateX` + `pointer-events:none` + `aria-hidden` op het inactieve paneel (kleine flicker mogelijk bij users die hun keuze hebben omgewisseld, omdat sessionStorage pas in `useEffect` wordt gelezen). (B) Trainer-rol-menu uitgebreid: nieuwe items **Mijn agenda** (`/agenda` — bestond al sinds Sprint ~35), **Mijn lessen** (`/schedule` — bestond al), **Mijn leerlingen** (NIEUW route `/t/[slug]/leerlingen`). `PublicNavKey` uitgebreid met `"leerlingen"`. (C) Nieuwe route `/t/[slug]/leerlingen` (trainer-only via `isTrainer(ctx)`, anders redirect naar tenant-home) + helper `lib/db/trainer-athletes.ts:listAthletesForTrainer(tenantId, userId)`: query-pad = mijn member-ids → group_members JOIN groups (met `groups.tenant_id=tenantId` **als DB-niveau filter** voor defense-in-depth, niet alleen in-memory) → group_members JOIN members+groups voor zelfde groep-ids met dezelfde tenant_id-filter → filter op `member_roles.role='athlete'` → exclude mijn eigen member_ids + archived. Geeft `{member_id, full_name, email, groups:[{id,name}]}[]` gesorteerd op naam (locale `nl`). (D) `public-tenant-shell.tsx`: `showKinderen = isParent(ctx) || isAthlete(ctx)` zodat athletes-zonder-parent ook de "Mijn sport"-sectie krijgen (parent-routes voor athletes filterden al via `getUserTenantContext`). (E) `NewsListCard` (Sprint 78b mockup-stijl) krijgt 48×48 `rounded-lg object-cover`-thumbnail links wanneer `cover_image_url` aanwezig (datum/titel/excerpt verschuift naar rechter kolom in `flex items-start gap-3`-layout). (F) Legacy-fallback module-grid in `app/t/[slug]/page.tsx` krijgt `sm:auto-rows-[280px]` zodat tiles even hoog zijn als de hero-slider (hero is `h-[240px] sm:h-[280px]`). **Houtrust-veilig**: géén SQL, géén DB-mutaties; alle changes zijn client-side UI + één read-only helper. **Niet uitgevoerd (drift)**: bottom-tab-bar `/agenda`-key wijst naar `/schedule` (pre-existing mismatch, niet aangepakt); role-mode sidebar heeft potentiële active-key-collision op `key="agenda"` tussen "Mijn agenda" en "Mijn lessen" wanneer beide naar verwante routes wijzen (geaccepteerde minor visual issue); Vitest/Playwright voor de mode-switch en `listAthletesForTrainer` ontbreken. **Bug-vermijding-tip**: bij nieuwe helpers die `admin`-client gebruiken op tabellen met `member_id`/`group_id`-FK's → **altijd** `.eq("<table>.tenant_id", tenantId)` via `!inner`-join, niet alleen in-memory filtering achteraf, anders is RLS-bypass mogelijk wanneer een member toevallig in een groep van een andere tenant zou zitten.

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
