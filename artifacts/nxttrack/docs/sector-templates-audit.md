# Sector templates & tenant terminology — audit + POC

**Sprint 36 · status**: implemented (audit + datamodel + migratie + resolver + POC)
**Scope**: voorbereiding op multi-sector NXTTRACK (voetbal, zwemmen, generiek, …) zonder data­migratie of role-renames.
**Out of scope**: progress templates, LVS, opruimen `members.player_type`, platform-admin UI voor templates, marketing/email/notification labels.

---

## 1. Probleemstelling

NXTTRACK is gestart als voetbalschool-product (Voetbalschool Houtrust). Daardoor zit voetbal-bias verspreid door:

* **UI-strings** (sidebar "Trainingen", page-titles "Leden", dashboard "Players").
* **Datamodel** (`members.player_type` check `('player','goalkeeper')`).
* **Sector-defaults** (homepage modules, navigatie-volgorde).

Voor groei naar zwemscholen, atletiek, dans, etc. moeten labels en defaults per tenant configureerbaar zijn — zonder iedere bestaande pagina te touchen of bestaande tenants te breken.

---

## 2. Auditbevindingen

### 2.1 Findings — risico-classificatie

| # | Locatie | Bevinding | Risico bij multi-sector | Klasse |
|---|---|---|---|---|
| F1 | `members.player_type` (DB check) | Hardcoded `'player' \| 'goalkeeper'` | Zwemschool kan geen role-types kiezen | **Hoog** (out-of-scope sprint 36) |
| F2 | Sidebar `tenant-sidebar.tsx` (4 labels) | "Leden / Groepen / Trainingen / Lidmaatschappen" hardcoded NL | Zwemles ziet "Trainingen" i.p.v. "Zwemlessen" | **Midden** (POC opgelost) |
| F3 | Dashboard `tenant/page.tsx` `COMING_SOON` | "Players / Trainers / Attendance / Development tracking" hardcoded EN | Mismatch met sectorterminologie + taal | **Midden** (POC opgelost) |
| F4 | Page-titles (`members/groups/trainings`) | NL hardcoded | Cosmetisch maar zichtbaar voor admins | **Midden** (POC opgelost) |
| F5 | `members/page.tsx` `ROLE_LABELS` | `athlete: "Speler"` | Voetbal-bias in rol-tooling | **Laag** (volgende sprint) |
| F6 | `permissions/catalog.ts` group-label "Leden & Groepen" | Hardcoded NL | Cosmetisch in role-editor | **Laag** |
| F7 | `notifications/event-labels.ts` | "Nieuwe training", "Trainingsverslag" | Mail-onderwerpen blijven voetbal-tone | **Midden** (out-of-scope sprint 36) |
| F8 | Marketing-site `lib/marketing/site-data.ts` | Apex-domein content | Apex is niet tenant-scoped → terminologie n.v.t. | **N.v.t.** |
| F9 | Email-templates `email-templates/*` | Per-tenant overrides bestaan al | Reeds tenant-scoped, geen risico | **Geen** |
| F10 | Homepage modules `tenant_modules` | Voetbal-defaults bij seed | Nieuwe sector wil andere modules | **Midden** (default_modules_json voorbereid, niet uitgerold) |
| F11 | Schedule UI `(tenant)/schedule/...` | "training-reminder", "manage" labels | Admin-UI woordkeus | **Midden** |
| F12 | Onboarding wizard | NL voetbal-tone in copy | Product-eerste indruk | **Midden** (volgende sprint) |
| F13 | Audit-log entries | `actor_action` = `"add_player"` etc. | Logregels zijn machine-keys, niet UI | **Geen** (intern) |

### 2.2 Mapping — tekstconcept → terminologie-key

13 concepten geselecteerd voor de eerste resolver-versie. Iedere key heeft een singular en (waar relevant) plural variant. Dit zijn de 13 rijen die nu in de `Terminology` interface en de seed-templates staan:

| # | Sleutel | Concept | Voorbeeld voetbal | Voorbeeld zwemmen | Voorbeeld generiek |
|---|---|---|---|---|---|
| 1 | `member_singular` / `_plural` | Roster-lid (any role) | Lid / Leden | Lid / Leden | Lid / Leden |
| 2 | `participant_singular` / `_plural` | Sportende deelnemer (athlete) | Sporter / Sporters | Leerling / Leerlingen | Deelnemer / Deelnemers |
| 3 | `guardian_singular` / `_plural` | Ouder-figuur | Ouder / Ouders | Ouder/verzorger / Ouders/verzorgers | Ouder/verzorger / Ouders/verzorgers |
| 4 | `instructor_singular` / `_plural` | Coach/instructeur | Trainer / Trainers | Zweminstructeur / Zweminstructeurs | Begeleider / Begeleiders |
| 5 | `group_singular` / `_plural` | Team / lesgroep | Groep / Groepen | Lesgroep / Lesgroepen | Groep / Groepen |
| 6 | `session_singular` / `_plural` | Trainings-event | Training / Trainingen | Zwemles / Zwemlessen | Sessie / Sessies |
| 7 | `program_singular` / `_plural` | Lidmaatschapsplan | Lidmaatschap / Lidmaatschappen | Lespakket / Lespakketten | Programma / Programma's |
| 8 | `attendance_label` | Aanwezigheid-koppel | Aanwezigheid | Lesaanwezigheid | Aanwezigheid |
| 9 | `registration_singular` / `_plural` | Externe inschrijving | Inschrijving / Inschrijvingen | Aanmelding / Aanmeldingen | Aanmelding / Aanmeldingen |
| 10 | `certificate_singular` / `_plural` | Diploma/certificaat | Certificaat / Certificaten | Zwemdiploma / Zwemdiploma's | Certificaat / Certificaten |
| 11 | (gereserveerd v1.1) `event_label` | Niet-trainings event (toernooi/wedstrijd) | Wedstrijd | Wedstrijd | Evenement |
| 12 | (gereserveerd v1.1) `assessment_label` | Voortgangs­meting | Skill-test | Diploma-toets | Beoordeling |
| 13 | (gereserveerd v1.1) `season_label` | Seizoen / cohort | Seizoen | Cursusjaar | Periode |

> Rij 11–13 zijn al benoemd zodat het schema weet waar het naartoe groeit; ze zitten **nog niet** in `Terminology` om de POC stabiel te houden.

---

## 3. Datamodelvoorstel

### 3.1 Nieuwe tabel `public.sector_templates`

```sql
key                  text primary key            -- 'football_school' | 'swimming_school' | 'generic' | …
name                 text not null               -- "Voetbalschool"
description          text                        -- omschrijving voor UI later
terminology_json     jsonb not null              -- partial Terminology (overrides op generic)
default_modules_json jsonb not null              -- gereserveerd voor sector-default homepage-modules
is_active            boolean not null default true
created_at, updated_at  -- standaard
```

* RLS: `select` voor authenticated, schrijven enkel via `is_platform_admin()`.
* Templates zijn **read-only voor tenants** — ze passen *overrides* toe via `tenants.settings_json`.

### 3.2 `public.tenants` uitbreiding

* **Nieuwe kolom**: `sector_template_key text references public.sector_templates(key) on delete set null`.
* **Geen** `terminology_overrides` kolom — die leeft als sub-key in de bestaande `tenants.settings_json` (`settings_json -> 'terminology_overrides'`). Reden: voorkomt schemabreuk en houdt overrides bij eventueel verwijderde keys safe (zacht negeren).
* Backfill: alle bestaande tenants → `'football_school'` (Houtrust + andere) zodat UI tekstueel gelijk blijft.

### 3.3 Resolver-architectuur

* Server: `getTenantTerminology(tenantId)` in `src/lib/terminology/resolver.ts`. Eén Supabase-call die zowel het sector-template als de generic-fallback ophaalt; per request gememoiseerd via `React.cache()`.
* Fallback-keten (mag nooit throwen):
  1. `tenant.settings_json.terminology_overrides` (per tenant)
  2. `sector_templates[tenant.sector_template_key].terminology_json`
  3. `sector_templates['generic'].terminology_json`
  4. Hardcoded `DEFAULT_TERMINOLOGY` (generic-equivalent)
* Validatie: `mergeIntoTerminology` accepteert alleen niet-lege strings; vervuilde JSON-data leidt tot stille val-back i.p.v. UI-crash. Een Zod-schema is bewust **niet** in de hot path geplaatst om geen extra failmode toe te voegen — types staan in `terminology/types.ts`, validatie gebeurt impliciet door key-set + type-guard. Voor toekomstige platform-admin UI komt er wel een Zod-schema (`TerminologySchema`) bij CRUD-mutaties.
* Client: `<TerminologyProvider value={…}>` (gezet in `(tenant)/tenant/layout.tsx`) + `useTerminology()` hook → werkt voor zowel client- als server-componenten zonder per-prop drilling.

---

## 4. Migratie

Bestand: `artifacts/nxttrack/supabase/sprint36_sector_templates.sql`

* Volledig idempotent (`if not exists`, `on conflict (key) do nothing`, FK opnieuw aangehecht).
* Seed van `football_school`, `swimming_school`, `generic` (alleen 1e run).
* Backfill `tenants.sector_template_key = 'football_school' where … is null;`.
* Geen role-renames, geen kolomwijzigingen op bestaande tabellen behalve de toegevoegde nullable kolom + FK + index.

**Volgorde op productie**: na alle Sprint 35-files. Daarna één keer `pnpm drizzle-kit push:pg` of de Supabase-SQL-runner (`sprint36_sector_templates.sql`).

---

## 5. POC — wat er nu dynamisch is

| Plaats | Voor (Houtrust) | Na (football_school) | Na (swimming_school) |
|---|---|---|---|
| Sidebar item "Leden" | Leden | **Leden** (gelijk) | Leden |
| Sidebar item "Groepen" | Groepen | **Groepen** | Lesgroepen |
| Sidebar item "Trainingen" | Trainingen | **Trainingen** | Zwemlessen |
| Sidebar item "Lidmaatschappen" | Lidmaatschappen | **Lidmaatschappen** | Lespakketten |
| Sidebar group-label | "Leden & groepen" / "Planning & lidmaatschap" | **gelijk** | "Leden & lesgroepen" / "Planning & lespakket" |
| Members page-title | Leden | **Leden** | Leden |
| Groups page-title | Groepen | **Groepen** | Lesgroepen |
| Trainings page-title | Trainingen | **Trainingen** | Zwemlessen |
| Memberships page-title | Abonnementen | **Abonnementen** (via terminology key `program_page_title`) | Lespakketten |
| Dashboard "Coming soon" — Players | "Players" (EN) | **Sporters** | Leerlingen |
| Dashboard "Coming soon" — Trainers | "Trainers" (EN) | **Trainers** | Zweminstructeurs |

**Scope-grenzen om regressie te voorkomen**:

* Alléén korte koplabels (page-title + sidebar-item + dashboard-card-label) zijn dynamisch via de resolver.
* Lopende NL-zinnen (page-`description`s zoals *"Maak teams of trainingsgroepen aan en koppel leden eraan."*, *"Beheer ouders, sporters, trainers en staf van deze vereniging."*, *"Plan trainingen voor groepen, beheer status en aanwezigheid."*, *"Definieer lidmaatschapsabonnementen voor deze vereniging."*) en knop-teksten (*"Nieuwe training"*) blijven **hardcoded NL**, omdat machinaal componeren met `toLowerCase()` snel rare grammatica oplevert (capitalisatie, lidwoorden, samenstellingen). Deze worden in een vervolgsprint via aparte volzin-keys per sector ingevuld.
* Memberships-page-title is dynamisch via een **aparte** key `program_page_title` (apart van `program_plural`) zodat football_school exact "Abonnementen" toont terwijl de sidebar `program_plural`="Lidmaatschappen" gebruikt — de bestaande NL-discrepantie blijft daarmee bewust ongewijzigd. Een vervolgsprint kan deze samenvoegen (zie §7).

> **Houtrust-regressie**: alle zichtbare strings die vóór sprint 36 NL waren blijven exact gelijk. De **enige** zichtbare wijziging voor Houtrust is dat het dashboard "Coming soon"-blok nu de label *"Sporters"* toont (in plaats van *"Players"*) — dit is een impliciete NL-isering en wordt in de release-notes benoemd.

---

## 6. Geweigerde alternatieven

* **Eigen `tenants.terminology_overrides jsonb` kolom** — verworpen. `settings_json` bestaat al en is een logische thuis. Voorkomt extra migratie + soft-deprecation als overrides verschuiven.
* **i18n via `next-intl`** — verworpen voor sprint 36. Termen zijn niet alleen taal- maar sector-afhankelijk; een `nl.json` per tenant is overkill en moeilijk versiebeheer.
* **Per-rij overrides in de catalog (PERMISSION_CATALOG)** — verworpen. Permissions zijn machine-keys; alleen labels in de role-editor zouden moeten dynamisch worden, en die zijn `Laag` risico.

---

## 7. Vervolgstappen (niet in deze sprint)

1. Platform-admin CRUD-UI voor `sector_templates` + tenant-template-keuze met override-editor (Zod-schema dan wel verplicht).
2. `default_modules_json` uitrollen in de homepage-seed flow.
3. `members.player_type` opheffen of per-sector configureerbaar maken.
4. Sector-aware notification subjecten.
5. Onboarding wizard taal-/sector-aware copy.
6. Page-title consistency: "Abonnementen" vs sidebar "Lidmaatschappen" via één key oplossen (introduceer `program_plural_long` óf hernoem allebei).

---

## 8. Release-notes draft (v0.12.0 — niet geseed)

> ### Voorbereiding op multi-sector — fundament gelegd
>
> **Voor admins**
> - Achter de schermen kan NXTTRACK nu sector-templates herkennen (voetbalschool, zwemschool, generiek). Bestaande verenigingen zijn automatisch gekoppeld aan de voetbalschool-template — er verandert tekstueel niets.
> - Het dashboard-blok "Coming soon" gebruikt vanaf nu Nederlandse termen ("Sporters" / "Trainers") in plaats van Engelse.
>
> **Verbeterd**
> - Sidebar- en pagina-koppen halen hun labels uit een centrale terminologie-laag, zodat zwem- en andere academies straks hun eigen woordenschat krijgen.
>
> **Nieuw**
> - Nieuwe tabel `sector_templates` + per-tenant `sector_template_key` veld.
