# Zwemschoolmodules — onderzoek & gefaseerd plan

> **Status:** research-only deliverable voor Task #80. Geen schema-, route- of code-wijzigingen.
> Alle voorstellen zijn _generiek_ ontworpen (waitlists, makeup_credits, capacity_resources,
> progress_modules, milestone_events). Sector-specifieke woorden komen uit `sector_templates.terminology_json`.

## TL;DR — wat moet je onthouden voordat je verder leest

1. NXTTRACK heeft sinds Sprint 36/37/39 een werkend **terminologie-fundament**
   (`sector_templates` + `tenants.settings_json -> terminology_overrides`). Voor zwemschool
   hoeven we de generieke kern niet om te bouwen; we breiden alleen labels uit en bouwen
   nieuwe **generieke** modules op de bestaande tabellen.
2. De vier "missende" zwemschool-bouwstenen — **wachtlijst, inhaalles-credits, voortgang,
   afzwem-event-planning** — bestaan vandaag _niet_ in DB of UI. De vijfde — **capaciteit** —
   bestaat alleen op groep-niveau (`groups.max_members` / `max_athletes`) en op
   sessie-tekstveld (`training_sessions.location` als `text`). Geen `locations`, `pools`,
   `lanes` of `resources` tabellen.
3. Bouw géén nieuwe parent/guardian-tabel: ouder↔kind loopt al via `member_links`
   (parent_member_id / child_member_id, tenant-scoped, RLS-correct).
4. Notificaties uit elke nieuwe module volgen het Sprint 41/43 dedup-patroon: `source_ref` is
   altijd de unieke event-id van de _nieuwe_ tabel (waitlist_offer.id, makeup_request.id,
   milestone_event_invite.id) — nooit een parent-id zoals waitlist_id of event_id.
5. Privé-data is standaard onzichtbaar voor ouders. Iedere nieuwe progress-/observation-
   tabel krijgt een `visibility text not null default 'private' check (visibility in
   ('private','member'))`-kolom, identiek aan `member_observations.visibility` en
   `training_attendance.note_visibility`.

---

## 1. Huidige-staat-analyse per gebied

| # | Gebied | Wat er is | Wat herbruikbaar | Wat te football-specifiek | Wat generiek moet | Niet aanraken |
|---|---|---|---|---|---|---|
| 1.1 | **Tenants & terminologie** | `public.tenants.settings_json`, `public.sector_templates(key, terminology_json, default_modules_json)`, resolver `src/lib/terminology/resolver.ts`, defaults `defaults.ts`, types `types.ts`. Templates `football_school` / `swimming_school` / `generic` zijn al geseed met participant/instructor/group/session/program/certificate-keys. | Hele resolver-stack + override-pad in `settings_json -> terminology_overrides`. Sprint 37 voegde 9 sector-aware volzin-keys toe (page-descriptions + knop-teksten). | Niets meer in code; zwemschool-template heeft al "Leerling/Zweminstructeur/Lesgroep/Zwemles/Zwemdiploma". | Nieuwe sleutels voor: waitlist (wachtlijst/wachtlijstplek), makeup (inhaalles/inhaalcredit), progress (vaardigheid/checkpoint), milestone-event (afzwemmen/diplomadag), resource (zwembad/baan/lokaal). | Bestaande sleutels en `program_plural` als single source-of-truth voor sidebar+page-titel. Voetbalschool Houtrust's overrides. |
| 1.2 | **Members & rollen** | `public.members` (incl. `account_type`, `player_type`, `birth_date`, `athlete_code`), `public.member_roles(member_id, role)` met `athlete`/`trainer`/`staff`/`parent`. `public.member_links(parent_member_id, child_member_id, tenant_id)` voor minderjarige leden. | `members` blijft canoniek voor alle personen (parents + athletes + trainers + staff). `member_links` is dé brug voor parent-zichtbaarheid in RLS — al gebruikt door `member_observations.obs_self_select`, `training_sessions.training_sessions_member_read`. | Niets — rolnamen zijn intern (sleutels), labels lopen via terminology. | Nieuwe rollen niet nodig. Eventueel een `tenant_roles.is_trainer_role`-achtige flag voor "is_examiner" voor diploma-events (Sprint 30 introduceerde dit patroon al). | Renames van `athlete`/`trainer`/`staff`/`parent` keys (zou heel veel RLS en code raken). `account_type`-set aanpassen. |
| 1.3 | **Groups & capacity (groep-niveau)** | `public.groups(name, description, max_members, max_athletes, updated_at)` + `group_members(group_id, member_id)` met unique. Trigger `enforce_group_max_members()` houdt beide caps onder advisory-lock. UI: lijst + detail + 3-tab participants/trainers/others. | Hele groep-model. Een lesgroep / zwemgroep is exact een `group`. Capaciteit op groep-niveau is al hard afgedwongen. | Niets. | Behoud van groep-niveau capaciteit; sessie-niveau capaciteit komt erbij via `session_resources` (zie §3.3). | `groups`-rename naar `lesson_groups`. `group_members.role`-kolom toevoegen (rol leeft op `member_roles`). |
| 1.4 | **Sessions & attendance** | `training_sessions(group_id, starts_at, ends_at, location text, status)`, `training_attendance(session_id, member_id, rsvp, attendance, attendance_reason, absence_reason, note, note_visibility, reminder_sent_at)`, `member_observations(member_id, session_id, body, visibility)`. RLS: tenant-admin overal, trainer in shared group leest+schrijft, ouder/zelf leest member-visible obs. | Iedere "zwemles" is gewoon een `training_sessions`-rij. RSVP + attendance + late + injured + private/member-note bestaan al. Het `member_observations`-patroon is dé referentie voor positieve voortgang-tabellen. | Schema-naam `training_*` — visueel is het al sector-aware via terminology, maar kolomnamen blijven engels. Niet hernoemen in deze ronde. | `training_sessions.location` als platte tekst is te zwak voor capaciteits-/baan-planning; vervangen door optionele FK `resource_id` met fallback op text. | RLS-policies van `training_attendance` en `member_observations` (kostbaar werk uit Sprint 35). |
| 1.5 | **Registrations & trial lessons** | `public.registrations(parent_email, child_name, status, type='registration'/'trial', registration_target, address-velden, agreed_terms, athletes_json)`. Atomic RPC `public.create_public_registration` voor de publieke wizard (`src/components/public/forms/registration-wizard.tsx`). | Bestaande wizard is uitstekend startpunt voor wachtlijst-aanmelding. `type` kan een derde waarde `waitlist` krijgen (of we maken `waitlist_entries` apart, zie §3 — voorkeur). | `player_type` is voetbal-jargon — leeft al naast generieke `account_type`; voor zwemschool gebruiken we een nieuwe `participant_subtype`-key (Task #64 dekt dit los). | Wachtlijst-specifieke voorkeur-velden (preferred_days, level, location) horen op een nieuwe `waitlist_preferences` of in een gespecialiseerde tabel — niet in `registrations.extra_details`. | RLS `registrations_public_insert` (publieke wizard moet open blijven). |
| 1.6 | **Memberships & payments** | `membership_plans`, `member_memberships(status, ended_at, end_reason)`, `membership_payment_logs` (Sprint 30 v2: paid/due/partial/overdue/refunded/cancelled/waived, default-flag, parent_payment_id). | Een "lespakket" mapt 1-op-1 op een `membership_plan`. Inhaalles-credit kan financieel als bonus-betaling of korting via `membership_payment_audit` — niet bouwen in Fase A. | Niets. | Niets in deze scope. | Sprint 30 betaal-stack. |
| 1.7 | **Locations / resources / pools** | `training_sessions.location` is een **platte tekst-kolom**. Geen `locations`, `pools`, `lanes`, `rooms`, `resources` tabellen. | Tekst-fallback blijft beschikbaar voor tenants die geen capacity-planning willen. | Niets. | Volledig nieuw concept `capacity_resources` + optionele koppel-tabel `session_resources` (zie §3.3). | Verplicht maken van `resource_id` op `training_sessions` (te disruptief — blijft optional). |
| 1.8 | **Progress / certificates / gamification** | **Niets in DB**. Alleen marketing-pagina's `(marketing)/features/gamification`. `member_observations` is wel de structurele blueprint (tenant+member+author+session+visibility). | Het hele blueprint-patroon van `member_observations` (RLS-kant: tenant-admin all, trainer in shared group r/w, self/parent member-visible read). | Niets. | Volledig nieuw: `progress_modules`, `progress_categories`, `progress_items`, `progress_scores`, `scoring_labels` (per-tenant configurabel), `certificates`, `milestones`. | n.v.t. — er is niets om te beschermen. |
| 1.9 | **Notifications & email-templates** | `notifications(tenant_id, source, source_ref, ...)` + dedup partial unique index met `source in ('training_*','group_assigned','news_published','membership_assigned','invite_accepted','attendance_changed_late','trainer_attendance_updated')` (Sprint 41/43). RPC `create_notification_with_recipients`. `notification_events(event_key, email_enabled)` per tenant + `tenant_email_templates`. | Hele dedup-pad. Nieuwe modules sluiten erop aan door `source` uit te breiden + `source_ref` op de unieke event-id van hun eigen tabel. | Niets. | Nieuwe `source`-keys: `waitlist_offer_sent`, `waitlist_offer_accepted`, `waitlist_offer_declined`, `makeup_credit_granted`, `makeup_request_approved`, `makeup_request_declined`, `progress_milestone_reached`, `milestone_event_invited`, `milestone_event_result_published`, `certificate_issued`. Per key beslissen of `email_enabled` default true is. | RPC-signature `create_notification_with_recipients` (zorg dat de partial unique index exact matcht zoals beschreven in Sprint 41/43-Gotcha in `replit.md`). |
| 1.10 | **Audit logs & RLS** | `public.audit_logs(actor_user_id, action, meta jsonb)`. RLS-helpers `public.has_tenant_access(tenant_id)`, `public.is_platform_admin()`. Server-side: `assertTenantAccess` in `lib/actions/tenant/_assert-access.ts`. | Iedere nieuwe server-action gebruikt hetzelfde patroon: `assertTenantAccess` + Zod + audit met `meta`. | Niets. | Nieuwe action-keys: `waitlist.created`, `waitlist.offer_sent`, `waitlist.converted`, `makeup_credit.granted`, `makeup_request.created/approved/declined`, `progress.score_recorded`, `milestone_event.created/scheduled/completed`, `certificate.issued`. | RLS-patroon op `has_tenant_access` is heilig. |

---

## 2. Feasibility-matrix

| Module | Generiek concept | Hergebruikbare features | Ontbrekende features | Risico's | Aanbevolen MVP | Latere fase |
|---|---|---|---|---|---|---|
| **Wachtlijst** | `waitlists` | Publieke wizard (`registration-wizard.tsx`), `registrations`-flow, e-mail templates, `member_links` voor minderjarige aanvragen, audit-pad | Specifieke voorkeur-velden (dagdeel, locatie, niveau-indicatie), wachtrij-status-machine (new → offered → accepted/declined/expired/converted), aanbod-token, aanbod-vervaltimer | Twee admins doen tegelijk een offer aan dezelfde plek (race) → advisory-lock zoals bij `groups.max_members`. Spam: publieke insert open laten met rate-limit per tenant+email. | `waitlists` + `waitlist_preferences` + `waitlist_offers`. Tenant-admin lijst + filter, offer-knop, conversion → `members` + `group_members` via bestaande RPC's. Publieke aanmelding via aparte route `/t/[slug]/wachtlijst`. | Self-service ouder-portaal met "Laat een aanbod opnieuw inplannen". Auto-offer wanneer een groep een vrije plek heeft (cron + `pg_advisory_xact_lock`). |
| **Inhaallessen** | `makeup_credits` | `training_attendance.absence_reason`/`attendance` flow, `notification_events`, audit | Credit-tabel met expiry, request-tabel met status-machine, capacity-check tegen sessie-bezetting, parent-knop in user-shell | Credit-misbruik: één credit per absentie, idempotent op `(tenant_id, attendance_id)`. Capacity-check moet sessie-niveau cap respecteren (komt uit §1.7). | `makeup_credits` (auto-uitgegeven bij `attendance='absent'` met admin-toggle), `makeup_requests` met `status in ('requested','approved','declined','expired','consumed')`, admin-lijst onder /tenant/aanwezigheid. | Self-service slot-kiezer voor ouders met live capaciteit. Multi-credit policies (binnen kwartaal verlopen). |
| **Positieve voortgang** | `progress_modules` | `member_observations` als blueprint, terminology-resolver voor labels (Startend/Ontwikkelend/Groeiend/Sterk/Klaar), trainer-RLS uit Sprint 35 | Module-/categorie-/item-tree, scoring-labels per tenant configurabel, `progress_scores` event-log, voortgangsbalk-aggregatie, ouder-zichtbaarheid-toggle | UX-overload als alle items per les tonen. Aggregatie-performance bij honderden items × leerlingen — direct een view of materialized view. Negatieve labels mogen nooit lekken — Zod-strip op label-input + UI-validatie. | `progress_modules` (per tenant, met sector-default-template), `progress_categories`, `progress_items`, `scoring_labels` (per module of per tenant), `progress_scores(member_id, item_id, label_id, recorded_by, recorded_at, visibility)`. Trainer-mobile-screen met < 4 taps per score. | Rapportage-export, ouder-trail door diploma-spel-kaarten, foto/video bij score, peer-progress benchmarks. |
| **Diploma-event planning** | `milestone_events` | `training_sessions`-patroon (start/eind/locatie/status), notificaties, audit, terminology-key `certificate_singular/plural` is al geseed | Event-tabel los van trainings (eigen `kind='exam'`, examinator-rol, capaciteit, wachtwoord-tokens), readiness-detectie (drempel op `progress_scores`), uitnodigingsflow, resultaat-registratie, certificaat-uitgifte | Falen voelt als een rapportcijfer als we niet zorgvuldig formuleren. **Geen "gezakt"-label** — alleen "extra oefening nodig" of "klaar". Privacy: ouders zien resultaat, andere ouders niet. | `milestone_events(starts_at, kind, status, capacity_resource_id?)` + `milestone_event_invites(event_id, member_id, status in ('invited','confirmed','declined','attended','completed','extra_practice','absent'))` (één tabel houdt zowel uitnodiging als resultaat). Readiness-lijst is een `progress_scores`-aggregatie-view. | Certificaat-PDF-generator, ouder-RSVP zelf-flow, examinator-mobile-app. |
| **Capaciteitsplanning** | `capacity_resources` | `training_sessions.location text` (fallback), groep-niveau capaciteit | Resources-tabel (locatie/zaal/baan), per-sessie capaciteits-binding, conflict-detectie (twee sessies dezelfde baan zelfde tijd), waitlist+makeup-binding | Race conditions: zelfde resource dubbel boeken. Oplossing: btree_gist + tstzrange exclusion-constraint (Postgres) of advisory-lock per resource. | `capacity_resources(parent_id?, kind text default 'location', name, capacity int)` (parent_id ondersteunt zwembad → baan-1/baan-2) + koppel-tabel `session_resources(session_id, resource_id, max_participants int)` met optionele FK op `training_sessions`. Tenant-admin CRUD + conflict-warning. | Visuele bezetting-planner per dag, instructor-availability, public-API voor inplanning. |

---

## 3. Voorgestelde architectuur — concrete tabellen

> **Naming-mapping t.o.v. de oorspronkelijke acceptatiecheck:**
> - de gevraagde `session_capacity` is hier gerealiseerd als `session_resources.max_participants` (één koppel-tabel doet capaciteit én resource-binding);
> - de gevraagde `event_participants` is hier gerealiseerd als `milestone_event_invites` (één tabel houdt zowel uitnodigings-status als eindresultaat, conform de toelichting in de feasibility-matrix).


> Alle nieuwe tabellen zijn **tenant-scoped** met `tenant_id uuid not null references public.tenants(id) on delete cascade`, RLS aan via `using (public.has_tenant_access(tenant_id))`. Iedere tabel met door-de-mens-bewerkbare data krijgt `created_at` + `updated_at` met `handle_updated_at()`-trigger (zoals bestaande tabellen).

### 3.1 Wachtlijsten

```text
public.waitlists                 -- één wachtlijst per "doelgroep" (vaak per cohort/leeftijd/level)
  id, tenant_id, name, description?, target_group_id? (FK groups, optional), status text default 'open'
  is_public boolean default true   -- of de publieke route hem accepteert

public.waitlist_entries          -- één rij per aanvraag
  id, tenant_id, waitlist_id, member_id? (null tot conversie), parent_email, parent_phone?, child_first_name, child_last_name?, birth_date?,
  notes?, status text check in ('new','offered','accepted','declined','expired','converted','withdrawn'),
  source text default 'public_form', created_at, updated_at,
  unique (tenant_id, waitlist_id, lower(parent_email), child_first_name)  -- soft anti-duplicate

public.waitlist_preferences      -- key-value voorkeuren (bv. weekday=zat, time_slot=ochtend, location_id=...)
  id, tenant_id, entry_id, key text, value text, created_at
  -- key-set valideren via Zod, niet via DB-check (per-tenant flexibel)

public.waitlist_offers           -- audit-trail per aanbod
  id, tenant_id, entry_id, offered_group_id (FK groups), offered_session_id? (FK training_sessions),
  offered_at, offered_by_user_id, expires_at,
  status text check in ('pending','accepted','declined','expired','revoked'),
  decision_at?, decision_token text unique  -- token voor publieke accept-link
```

* **Eigenaarschap:** tenant.
* **RLS:** tenant-admin all + publieke insert op `waitlist_entries` (zoals `registrations_public_insert`). `waitlist_offers.decision_token` wordt aan ouder gemaild, accept-route mag anonymous zijn maar valideert token.
* **Idempotency:** notificaties met `source='waitlist_offer_sent'`, `source_ref = waitlist_offers.id`. Conversie naar `members + group_members` doet `INSERT ... ON CONFLICT DO NOTHING` op `(tenant_id, lower(email))` om dubbel-aanmaken te voorkomen.
* **Aansluiting bestaande tabellen:** conversie creëert een `members`-rij (status `aspirant`), `member_roles(member_id, 'athlete')`, `member_links` als ouder ook nieuw is, en `group_members(group_id, member_id)` — laatste raakt de bestaande `enforce_group_max_members`-trigger zodat caps gerespecteerd blijven.

### 3.2 Inhaallessen (makeup credits)

```text
public.makeup_credits
  id, tenant_id, member_id, source_attendance_id? (FK training_attendance, on delete set null),
  reason text, granted_by_user_id?, granted_at,
  expires_at? timestamptz, status text check in ('available','reserved','consumed','expired','revoked'),
  unique (tenant_id, source_attendance_id) where source_attendance_id is not null  -- één credit per absentie

public.makeup_requests
  id, tenant_id, credit_id (FK makeup_credits), requested_by_user_id, target_session_id (FK training_sessions),
  status text check in ('requested','approved','declined','cancelled','consumed'),
  decision_by_user_id?, decision_at?, decision_reason?, created_at, updated_at
```

* **Eigenaarschap:** tenant.
* **RLS:** tenant-admin all; trainer-of-target-group r/w (zelfde join-pattern als `member_observations`); self+parent r op eigen credits/requests via `members.user_id` + `member_links`.
* **Idempotency:** `source='makeup_credit_granted'` met `source_ref = makeup_credits.id`. Auto-grant trigger op `training_attendance` na `attendance='absent'` is opt-in per tenant via een setting in `tenants.settings_json -> 'makeup_policy'`.
* **Capacity-check:** `approve` doet `pg_advisory_xact_lock` op `target_session_id` en weigert als `session_capacity.max_participants - count(active reservations) <= 0`.

### 3.3 Capaciteit / resources

```text
public.capacity_resources
  id, tenant_id, parent_id? (self-FK voor zwembad → banen),
  kind text check in ('location','room','pool','lane','court','field','other') default 'location',
  name, capacity int? check (capacity is null or capacity > 0),
  active boolean default true, created_at, updated_at

public.session_resources         -- veel-op-veel: één sessie kan baan-1 + baan-2 claimen
  session_id (FK training_sessions on delete cascade),
  resource_id (FK capacity_resources on delete restrict),
  max_participants int? check (max_participants is null or max_participants > 0),
  primary key (session_id, resource_id),
  exclude using gist (resource_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    -- tstzrange wordt via een trigger-onderhouden generated column geprojecteerd uit training_sessions
```

* **Eigenaarschap:** tenant. Geen sector-defaults; tenant-admin maakt resources zelf aan.
* **Aansluiting bestaande tabellen:** `training_sessions.location text` blijft als optionele label. Sessie-creatie krijgt optioneel een resource_id-picker; als gekozen, dan vult een trigger het label automatisch met `resource.name`.
* **Conflictdetectie:** exclusion-constraint voorkomt dubbel-boeking dezelfde baan/zelfde tijd. Hiervoor moet `btree_gist` extension geïnstalleerd worden — eenmalige migratie-stap.

### 3.4 Positieve voortgang

```text
public.progress_modules
  id, tenant_id, name, slug, description?, sort_order int default 0,
  is_active boolean default true, sector_template_key? text  -- alleen voor sector-default seeds
  unique (tenant_id, slug)

public.progress_categories
  id, tenant_id, module_id, name, sort_order, unique (tenant_id, module_id, name)

public.progress_items
  id, tenant_id, category_id, name, description?, sort_order,
  weight int default 1,  -- voor aggregatie/voortgangsbalk
  unique (tenant_id, category_id, name)

public.scoring_labels            -- per tenant configurabel
  id, tenant_id uuid not null, key text, label text, color text, sort_order int,
  is_positive_outcome boolean not null default true
    check (is_positive_outcome = true),    -- DB weigert negatieve labels hard
  unique (tenant_id, key)
  -- Defaults wonen in sector_templates.scoring_labels_json (platform-admin schrijft);
  -- tenant-creatie cloned ze idempotent naar deze tabel. Zo blijft scoring_labels
  -- volledig tenant-scoped en blijft de RLS-baseline (has_tenant_access) consistent.

public.progress_scores
  id, tenant_id, member_id, item_id, label_id (FK scoring_labels),
  session_id? (FK training_sessions on delete set null),
  recorded_by_user_id, recorded_at,
  visibility text check in ('private','member') default 'private',
  note text?,
  unique (tenant_id, member_id, item_id, recorded_at)  -- audit-vriendelijk: meerdere scores in tijd
```

* **Eigenaarschap:** tenant. Defaults wonen in `sector_templates.scoring_labels_json` (platform-admin) en worden bij tenant-creatie geclonet naar `scoring_labels` — geen global rows. Hierdoor blijft de tenant-scoped RLS-regel zonder uitzondering gelden.
* **RLS:** identiek aan `member_observations` — tenant-admin all, trainer-in-shared-group r/w, self/parent leest `visibility='member'`. Wijziging-history is impliciet via append-only `progress_scores` (geen update, alleen nieuwe rij).
* **Idempotency:** geen dedup-source nodig (event-log = nieuwe rij per beweging).
* **Aggregatie:** maak een `view public.progress_member_progress` met `(tenant_id, member_id, module_id, latest_label_id_per_item, percent_strong)` — kandidaat voor materialized view zodra de leerlingen-aantallen het rechtvaardigen.

### 3.5 Diploma-event planning (milestones)

```text
public.milestones                -- bv. "Diploma A", "Brevet 1"
  id, tenant_id, module_id (FK progress_modules), name, description?,
  required_percent int default 100,  -- minimum % "Sterk/Klaar" labels op item-niveau
  certificate_template? text,        -- pad naar PDF-template, optioneel
  unique (tenant_id, module_id, name)

public.milestone_events
  id, tenant_id, milestone_id (FK milestones, on delete restrict),
  starts_at, ends_at, resource_id? (FK capacity_resources),
  capacity int?, status text check in ('draft','scheduled','completed','cancelled'),
  examiner_user_id? uuid, created_by_user_id, created_at, updated_at

public.milestone_event_invites   -- één rij per uitgenodigde deelnemer
  id, tenant_id, event_id, member_id,
  status text check in ('invited','confirmed','declined','attended','completed','extra_practice','absent'),
  invited_by_user_id, invited_at, decision_at?, decision_token text unique,
  unique (tenant_id, event_id, member_id)

public.certificates              -- award-trail
  id, tenant_id, member_id, milestone_id, awarded_at, awarded_by_user_id,
  event_invite_id? (FK milestone_event_invites on delete set null),
  pdf_object_path? text,         -- App Storage pad; optioneel tot we de generator hebben
  unique (tenant_id, member_id, milestone_id)  -- elk diploma één keer per leerling
```

* **Eigenaarschap:** tenant.
* **RLS:** tenant-admin all + examinator (`milestone_events.examiner_user_id = auth.uid()`) r/w op zijn eigen events; ouder/zelf leest invites + behaalde certificates van eigen kind.
* **Idempotency:** notificatie-sources `milestone_event_invited` (`source_ref = milestone_event_invites.id`), `milestone_event_result_published` (`source_ref = milestone_event_invites.id` na status-overgang), `certificate_issued` (`source_ref = certificates.id`). Per Sprint 41/43-Gotcha: nooit `event_id` als source_ref gebruiken.
* **Readiness-detectie:** een view `public.milestone_readiness(tenant_id, milestone_id, member_id, percent_complete)` op basis van `progress_scores` + `milestones.required_percent`.

### 3.6 Terminologie-uitbreiding (zonder code-wijziging in deze taak)

Nieuwe keys voor `Terminology` interface (ter overweging in Fase A1):

```
waitlist_singular / waitlist_plural        — "wachtlijst" vs "Lesgroep-aanvraag"
waitlist_entry_singular / _plural          — "Wachtlijstplek" vs "Aanmelding"
makeup_credit_singular / _plural           — "Inhaalcredit" vs "Inhaalles-tegoed"
makeup_request_singular / _plural          — "Inhaalverzoek" vs "Inhaalaanvraag"
progress_module_singular / _plural         — "Diploma" / "Vaardighedenmodule"
progress_category_singular / _plural       — "Onderdeel"
progress_item_singular / _plural           — "Vaardigheid" / "Checkpoint"
milestone_event_singular / _plural         — "Afzwemmen" / "Examen" / "Diplomadag"
resource_singular / _plural                — "Zwembad" / "Locatie" / "Veld"
sub_resource_singular / _plural            — "Baan" / "Lokaal" / "Mat"
positive_label_*                           — set sleutels voor de 5 scoring-labels
```

Deze leven in `terminology_json`; per-tenant override blijft via `settings_json -> terminology_overrides`.

---

## 4. Cross-module flow

### Stap-voor-stap (zwemschool, gelezen van links naar rechts)

```
publieke aanmelding
   │  (registration-wizard.tsx → create_public_registration of nieuwe waitlist_entries-insert)
   ▼
[1] waitlist_entries (status='new')
   │  admin opent /tenant/wachtlijst → ziet aanvragen + voorkeuren
   │  admin maakt waitlist_offers.row (status='pending', expires_at=72h)
   ▼
[2] waitlist_offers — e-mail naar ouder met decision_token-link
   │  ouder klikt accept → conversie:
   │     • members (status=aspirant) + member_roles=athlete
   │     • member_links (parent ↔ kind) als ouder ook nieuw
   │     • group_members (raakt enforce_group_max_members trigger)
   │     • waitlist_entries.status='converted', waitlist_offers.status='accepted'
   ▼
[3] member zit in een group → krijgt automatisch training_sessions (bestaand pad)
   │  trainer markeert attendance per sessie (bestaand)
   │  bij 'absent' → optioneel auto-grant makeup_credits.row (status='available')
   ▼
[4] ouder vraagt inhaalles aan via /t/[slug]/inhalen
   │  makeup_requests.row (status='requested', target_session_id=...)
   │  admin/trainer keurt goed → capacity-check → status='approved'
   │  bij approve: training_attendance-rij voor die makeup-sessie wordt aangemaakt
   ▼
[5] trainer registreert progress_scores in mobile-screen (4 taps max)
   │  per item: tap label uit Startend/Ontwikkelend/Groeiend/Sterk/Klaar
   ▼
[6] view milestone_readiness berekent percent_complete per (member, milestone)
   │  admin opent /tenant/diploma → readiness-lijst toont "kandidaten"
   │  admin maakt milestone_events.row (Afzwem-event, datum, capaciteit, examinator)
   │  admin nodigt kandidaten uit → milestone_event_invites (status='invited')
   ▼
[7] ouder bevestigt via decision_token → status='confirmed'
   │  op de dag: examinator markeert per invite 'attended' → 'completed' of 'extra_practice'
   ▼
[8] bij 'completed': certificates.row (awarded_at, awarded_by, optional pdf_object_path)
   │  notificatie + e-mail naar ouder + child
   ▼
[einde flow] member blijft in dezelfde group of stroomt door naar volgende module/groep
```

### Hoe blijft dit generiek?

| Stap | Zwemschool | Voetbal | Vechtsport | Dans |
|---|---|---|---|---|
| 1 | Wachtlijst voor lesgroepen | Wachtlijst voor selectieteam | Wachtlijst voor proefles | Wachtlijst voor cursus |
| 3 | Zwemles | Training | Mat-training | Choreografie-les |
| 4 | Inhaalles | Inhaaltraining | Inhaalles | Inhaalles |
| 5 | Borstcrawl-checkpoints | Skill-tracking (passen, schieten) | Banden-progressie | Choreografie-stappen |
| 6 | Afzwem-readiness | Selectie-readiness | Banden-examen-readiness | Voorstellings-readiness |
| 7 | Afzwemmen | Wedstrijd-selectie | Banden-examen | Toonmoment |
| 8 | Zwemdiploma | Selectie-bevestiging | Nieuwe band | Deelname-certificaat |

**Alleen labels en `progress_modules`-content wisselen per sector.** De flow zelf is identiek.

---

## 5. UX-plan per persona

### Platform-admin
* Beheert sector-defaults: nieuwe `progress_modules`-templates per `sector_template_key` (zwemschool krijgt "Zwem ABC", voetbal "Skill Tree Onder-12").
* Beheert default `scoring_labels` (die tenants kunnen overriden).
* Geen zwem-only schermen; alle CRUD via bestaande `/platform/sector-templates`-vlak.

### Tenant-admin (web, desktop-first)
* `/tenant/wachtlijst` — lijst met filter op voorkeur-keys, knop "Bied plek aan" → modal met groep/sessie-keuze.
* `/tenant/inhaallessen` — twee tabs (credits / verzoeken), bulk-approve.
* `/tenant/voortgang` — boomstructuur module → categorie → item, drag-sort, Zod-gevalideerde labels.
* `/tenant/diploma` — readiness-tabel + event-planner (datum, examinator, capaciteit).
* `/tenant/locaties` — resources-CRUD met optionele parent (zwembad → baan).

### Instructeur / trainer (mobile-first, **< 4 taps per voortgang-update**)
* Lijst van komende sessies (bestaande `/t/[slug]/schedule`).
* Tap sessie → leerlingen-grid (foto, naam).
* Tap leerling → tabbed sheet: Aanwezigheid · Voortgang · Notitie.
* Tap "Voortgang" → vorige scores + 1-tap label-pickers per item. Save = swipe down.
* Diploma-readiness-badge (Klaar / Bijna / In ontwikkeling) zichtbaar onder leerling-naam.

Concreet voor scoring: 1) sessie-tap, 2) leerling-tap, 3) item-tap (uit korte preset-lijst), 4) label-tap = klaar.

### Ouder / voogd (mobile-first)
* Bestaande `/t/[slug]/profile` krijgt twee tabs erbij:
  * **Voortgang** — kindkaart per kind, voortgangsbalk per module, alleen `visibility='member'` data.
  * **Diploma's** — behaalde + komende afzwem-events met RSVP-knop.
* `/t/[slug]/inhalen` — vrije credits + slot-selector.
* `/t/[slug]/wachtlijst/[token]` — public accept/decline-pagina (token in e-mail).

### Deelnemer (zelf, indien volwassen of 16+)
* Identiek aan ouder-tabs maar gefilterd op eigen `members.user_id`.

---

## 6. Permissies & privacy-plan

### Algemene regels
* Iedere nieuwe tabel heeft RLS aan met `using (public.has_tenant_access(tenant_id))` als baseline tenant-admin policy.
* Iedere tabel met "trainer-toegang" gebruikt het bestaande join-pattern uit `member_observations` (`group_members → members → member_roles role='trainer' OR tenant_member_roles → tenant_roles.is_trainer_role`).
* Iedere tabel met "ouder/zelf-toegang" gebruikt `member_links` + `members.user_id` zoals `obs_self_select` en `training_sessions_member_read`.
* Privé velden krijgen `visibility text not null default 'private' check (visibility in ('private','member'))`.
* Geen direct e-mail van ouders zonder `notification_events.email_enabled=true` toggle (analoog aan release-notes pad).

### Per persona

| Persona | Waitlists | Makeup credits/requests | Progress scores | Milestone events | Certificates |
|---|---|---|---|---|---|
| Platform-admin | — (alleen sector-templates beheer) | — | — | — | — |
| Tenant-admin | r/w alle eigen tenant | r/w alle eigen tenant | r/w alle eigen tenant | r/w alle eigen tenant | r/w alle eigen tenant |
| Trainer (in shared group) | r (eigen groep candidates) | r/w eigen groep | r/w eigen groep | r/w events waar zij examinator zijn | r (alleen lezen) |
| Ouder | r eigen kind via `member_links`; w via decision_token | r/w eigen kind | **r alleen `visibility='member'`** | r eigen kind invites; w alleen via decision_token | r eigen kind |
| Deelnemer (self) | — (geen self-aanmaak na conversie) | r/w eigen credit/request | r alleen `visibility='member'` van zichzelf | r eigen invites; w via decision_token | r eigen certificaten |
| Anonymous (publiek) | w insert op `waitlist_entries` (publieke wizard, rate-limited) | — | — | — | — |
| Decision_token holder | — | — | — | accept/decline op `milestone_event_invites` met token-match | — |

### Speciale aandacht
* **Medische/safety-info** hoort thuis op `members.notes` of een toekomstige `member_health_notes`-tabel met `visibility='private'`. **Niet** op `progress_scores.note` of `member_observations.body`. Dit valt buiten Fase B-D, maar de Zod-validatie van `progress_scores.note` moet vrije tekst toestaan zonder ze als veilig-voor-ouder te markeren.
* **Negatieve labels** zijn een hard taboe in de UI én in de Zod-validatie van `scoring_labels`. Platform-default-set bevat alleen positieve uitkomsten; tenant-overrides worden gevalideerd op de boolean `is_positive_outcome` en de UI weigert is_positive_outcome=false te tonen aan ouders.
* **Decision-tokens** voor waitlist-offers en milestone-event-invites: 32+ chars, eenmalig, `expires_at` verplicht, audit-log bij gebruik.
* **Minderjarigen**: alle ouder-toegang loopt via `member_links`. Geen aparte parent-tabel of `parent_id` op `members`.

---

## 7. Gefaseerd takenplan

> Volgorde is geadviseerd; per fase staan harde afhankelijkheden, parallel-mogelijkheden en migratie-volgorde. Geen fase mag Voetbalschool Houtrust regresseren — voor elke seed `where tenant_id in (select id from tenants where slug='houtrust')` filteren of de feature default-uit zetten.

### Fase A — Sector-terminology & sector-default progress-templates _(snel, risicoarm)_
* **A1.** Voeg de in §3.6 genoemde nieuwe terminology-keys toe aan `Terminology` + `defaults.ts` + `schema.ts` + `labels.ts` + alle drie de geseede sector-templates. Geen runtime-code raakt het nog. _Risico: laag._ Refereert: `sprint36_sector_templates.sql`, `sprint37_sector_template_sentences.sql`.
* **A2.** Seed `progress_modules`-defaults per sector (zwemschool: "Zwem ABC", voetbal: "Skill-tree O-12") in `sector_templates.default_modules_json` of een nieuwe kolom `progress_template_json`. Pas tenant-seed-RPC aan om bij creatie de default-progress-tree te clonen (idempotent op `(tenant_id, slug)`). _Mag parallel met A1._

### Fase B — Capacity-fundament _(blokkeert Fase D en G)_
* **B1.** Migreer `capacity_resources` + `session_resources` met `btree_gist`-extension. Idempotent. _Risico: medium — exclusion-constraint moet getest worden tegen bestaande sessies in Houtrust om geen valse conflicten te raisen. Mitigatie: load bestaande `training_sessions.location text` als label; resources blijven null tot tenant-admin ze koppelt._
* **B2.** Tenant-admin CRUD `/tenant/locaties` + sessie-form picker + conflict-warning (niet-blokkerend in MVP, alleen UI-melding).

### Fase C — Wachtlijst MVP _(blokkeert F)_
* **C1.** Migreer `waitlists` + `waitlist_entries` + `waitlist_preferences` + `waitlist_offers`. RLS public-insert + admin-all + token-accept (decision_token). Notification-source-keys + dedup-index uitbreiden (Sprint 41/43-pad). _Risico: medium — vergeet partial-index-predicate niet exact te matchen aan RPC `on conflict ... where`._
* **C2.** Publieke route `/t/[slug]/wachtlijst` + tenant-admin lijst + offer-modal + token-accept-route. Integratie met bestaande `members + member_links + group_members`-conversie via een nieuwe RPC (analoog aan `create_public_registration`).

### Fase D — Inhaallessen MVP _(afhankelijk van B voor capacity-check; mag parallel met C en E1)_
* **D1.** Migreer `makeup_credits` + `makeup_requests`. Optionele auto-grant trigger op `training_attendance` (default OFF voor Houtrust). RLS analoog aan `member_observations`.
* **D2.** Tenant-admin lijst + ouder-aanvraagformulier in user-shell. Approve-pad doet `pg_advisory_xact_lock` op `target_session_id`.

### Fase E — Voortgang fundament _(blokkeert F en G)_
* **E1.** Migreer `progress_modules` + `progress_categories` + `progress_items` + `scoring_labels` + `progress_scores`. Append-only event-log; RLS exact zoals `member_observations`. _Risico: laag — geen wijziging aan bestaande tabellen._
* **E2.** Tenant-admin tree-editor + trainer-mobile-screen (< 4 taps). Zod weigert `is_positive_outcome=false` labels.
* **E3.** View `progress_member_progress` + ouder/zelf-tab in user-shell met `visibility='member'`-filter.

### Fase F — Diploma-readiness & milestones _(afhankelijk van E)_
* **F1.** Migreer `milestones` + view `milestone_readiness`. Tenant-admin readiness-tabel + module-koppeling.

### Fase G — Afzwem-event planning _(afhankelijk van F en B)_
* **G1.** Migreer `milestone_events` + `milestone_event_invites`. Notification-sources + dedup. Examinator-rolflag (analoog aan `tenant_roles.is_trainer_role`).
* **G2.** Tenant-admin event-planner + ouder accept-route via decision_token + examinator mobile-screen.
* **G3.** Migreer `certificates`. Eerst zonder PDF-generator; later App Storage `pdf_object_path`.

### Fase H — Ouder/deelnemer-journey polish _(parallel met G2/G3)_
* **H1.** Voortgangsbalk per module op kind-kaart, badges-rij voor behaalde milestones, RSVP-knop voor komende events.

### Fase I — Certificaten + finetuning _(laatste)_
* **I1.** PDF-generator (templates per tenant), e-mail-attach, App Storage upload.
* **I2.** Performance: `progress_member_progress` materialized view + nightly refresh.

### Parallellisatie-overzicht
* **A1 // A2** — geen DB-conflict.
* **B // C // E1** — los van elkaar, verschillende tabellen. (B blokkeert pas downstream bij D en G; niet bij C of E.)
* **D** kan starten zodra B in productie is (capacity-check tegen `session_resources`).
* **F** wacht op E.
* **G** wacht op F en B.
* **H** kan al beginnen zodra E2 leeft (ouder-voortgang); rest komt later.
* **I** is laatste fase.

### Migratie-volgorde (productie)
A → B → (C // D // E in parallel-PR's, elk met eigen sprint*.sql) → F → G → H → I.

---

## Top-aanbevelingen (samenvatting)

1. **Bouw alles generiek, met sector-defaults via `sector_templates`.** Geen `swimming_*` of `football_*`-tabellen of -routes. Sector verandert alleen labels en seed-content, niet de kern.
2. **Hergebruik `member_observations` als blueprint** voor `progress_scores`, `makeup_requests` en alle nieuwe tabellen waar trainer + ouder + zelf elk hun eigen RLS-pad hebben. Dit patroon is al geverifieerd in productie (Sprint 35).
3. **Capaciteit eerst (Fase B), dan inhaal en afzwem.** Zonder `capacity_resources` blijft inhaal-approve en afzwem-event-planning gokwerk en gevoelig voor double-booking.
4. **Notification-dedup is heilig.** Iedere nieuwe `source`-key komt met een eigen `source_ref` op de unieke event-row-id, en de partial unique index + `on conflict ... where`-predicate moeten elkaar exact matchen (Sprint 41/43-Gotcha).
5. **Positieve taal staat in DB-validatie, niet alleen in UI.** `scoring_labels.is_positive_outcome` heeft een hard `check (is_positive_outcome = true)` op kolom-niveau, plus Zod-validatie aan de import-kant. Voorkom dat een tenant-admin per ongeluk "Onvoldoende" als label kan plakken — de DB weigert het.
