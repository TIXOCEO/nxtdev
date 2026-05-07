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
| F1 | `members.player_type` (DB check) | Hardcoded `'player' \| 'goalkeeper'` | Zwemschool kan geen role-types kiezen | **Hoog** (sprint 38: check gedropt, kolom open) |
| F2 | Sidebar `tenant-sidebar.tsx` (4 labels) | "Leden / Groepen / Trainingen / Lidmaatschappen" hardcoded NL | Zwemles ziet "Trainingen" i.p.v. "Zwemlessen" | **Midden** (POC opgelost) |
| F3 | Dashboard `tenant/page.tsx` `COMING_SOON` | "Players / Trainers / Attendance / Development tracking" hardcoded EN | Mismatch met sectorterminologie + taal | **Midden** (POC opgelost) |
| F4 | Page-titles (`members/groups/trainings`) | NL hardcoded | Cosmetisch maar zichtbaar voor admins | **Midden** (POC opgelost) |
| F5 | `members/page.tsx` `ROLE_LABELS` | `athlete: "Speler"` | Voetbal-bias in rol-tooling | **Laag** (sprint 38: athlete/parent/trainer uit terminology) |
| F6 | `permissions/catalog.ts` group-label "Leden & Groepen" | Hardcoded NL | Cosmetisch in role-editor | **Laag** |
| F7 | `notifications/event-labels.ts` | "Nieuwe training", "Trainingsverslag" | Mail-onderwerpen blijven voetbal-tone | **Midden** (sprint 38: training_*/attendance_* sector-aware) |
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
* Backfill: **alleen Voetbalschool Houtrust** (`where slug='houtrust' and sector_template_key is null`) krijgt `'football_school'` toegewezen, zodat de UI voor Houtrust tekstueel exact gelijk blijft. Alle overige bestaande tenants blijven `NULL` en de resolver valt voor hen terug op de `generic` template — veilig omdat die alle keys vult.

### 3.3 Resolver-architectuur

* Server: `getTenantTerminology(tenantId)` in `src/lib/terminology/resolver.ts`. Eén Supabase-call die zowel het sector-template als de generic-fallback ophaalt; per request gememoiseerd via `React.cache()`.
* Fallback-keten (mag nooit throwen):
  1. `tenant.settings_json.terminology_overrides` (per tenant)
  2. `sector_templates[tenant.sector_template_key].terminology_json`
  3. `sector_templates['generic'].terminology_json`
  4. Hardcoded `DEFAULT_TERMINOLOGY` (generic-equivalent)
* Validatie: ingestie van zowel sector-template-JSON als per-tenant overrides loopt door `safeParseTerminology` (Zod `TerminologySchema` in `terminology/schema.ts`) — onbekende keys worden gestript, lege of niet-string waardes vallen weg. De parse is *safe*: bij parse-error blijft de baseline ongewijzigd, dus de UI crasht nooit op vervuilde data. De pure resolver-kern (`resolveTerminology` in `terminology/merge.ts`) staat los van de Supabase-laag zodat tests en een toekomstige platform-admin preview hem zonder server-context kunnen gebruiken.
* Client: `<TerminologyProvider value={…}>` (gezet in `(tenant)/tenant/layout.tsx`) + `useTerminology()` hook → werkt voor zowel client- als server-componenten zonder per-prop drilling.

---

## 4. Migratie

Bestand: `artifacts/nxttrack/supabase/sprint36_sector_templates.sql`

* Volledig idempotent (`if not exists`, `on conflict (key) do nothing`, FK opnieuw aangehecht).
* Seed van `football_school`, `swimming_school`, `generic` (alleen 1e run).
* Backfill `update tenants set sector_template_key='football_school' where sector_template_key is null and slug='houtrust';` (Houtrust-only).
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
| Memberships page-title | Abonnementen | **Lidmaatschappen** (sprint 37 — `program_plural` is single source of truth, sidebar+title gelijk) | Lespakketten |
| Dashboard "Coming soon" — Players | "Players" (EN) | **Sporters** | Leerlingen |
| Dashboard "Coming soon" — Trainers | "Trainers" (EN) | **Trainers** | Zweminstructeurs |

**Scope-grenzen om regressie te voorkomen**:

* Alléén korte koplabels (page-title + sidebar-item + dashboard-card-label) zijn dynamisch via de resolver.
* **Sprint 37 update**: lopende NL-zinnen (page-`description`s en knop-/sectie-titels zoals *"Nieuwe training"*, *"Nieuw lidmaatschap"*, *"Nieuwe groep"*) zijn nu wél sector-aware via aparte volzin-keys — zie §9.
* Het dashboard-`Coming soon`-blok leest naast de label ook de **hint** uit terminology (`dashboard_participants_hint`, `dashboard_instructors_hint`).
* De memberships-page-titel gebruikt vanaf sprint 37 dezelfde key als de sidebar (`program_plural`); de losstaande `program_page_title`-key is verwijderd. Houtrust-zichtbare wijziging: page-titel "Abonnementen" → **"Lidmaatschappen"** (gelijk aan sidebar).

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
6. ~~Page-title consistency: "Abonnementen" vs sidebar "Lidmaatschappen" via één key oplossen~~ → **opgelost in sprint 37** door `program_page_title` te schrappen en `program_plural` als single source te gebruiken.

---

## 9. Sprint 37 — Sector-aware volzin-strings

`Terminology` is uitgebreid met negen volzin-keys die per sector een eigen formulering kunnen krijgen, geseed in `sprint37_sector_template_sentences.sql` (jsonb-merge, idempotent):

| Key | football_school | swimming_school | generic |
|---|---|---|---|
| `members_page_description` | Beheer ouders, sporters, trainers en staf van deze vereniging. | Beheer ouders, leerlingen, instructeurs en staf van deze zwemschool. | Beheer ouders, deelnemers, begeleiders en staf van deze academie. |
| `groups_page_description` | Maak teams of trainingsgroepen aan en koppel leden eraan. | Maak lesgroepen aan en koppel leerlingen eraan. | Maak groepen aan en koppel deelnemers eraan. |
| `groups_new_form_title` | Nieuwe groep | Nieuwe lesgroep | Nieuwe groep |
| `trainings_page_description` | Plan trainingen voor groepen, beheer status en aanwezigheid. | Plan zwemlessen voor lesgroepen, beheer status en lesaanwezigheid. | Plan sessies voor groepen, beheer status en aanwezigheid. |
| `trainings_new_button` | Nieuwe training | Nieuwe zwemles | Nieuwe sessie |
| `memberships_page_description` | Definieer lidmaatschappen voor deze vereniging. | Definieer lespakketten voor deze zwemschool. | Definieer programma's voor deze academie. |
| `memberships_new_form_title` | Nieuw lidmaatschap | Nieuw lespakket | Nieuw programma |
| `dashboard_participants_hint` | Beheer sporters en teams. | Beheer leerlingen en lesgroepen. | Beheer deelnemers en groepen. |
| `dashboard_instructors_hint` | Trainersbestand en koppelingen. | Instructeursbestand en koppelingen. | Begeleidersbestand en koppelingen. |

`DEFAULT_TERMINOLOGY` mirrort de generic-waarden zodat de hardcoded TS-fallback nooit leeg of `undefined` is. Pages onder `(tenant)/tenant/{members,groups,trainings,memberships}/page.tsx` en `(tenant)/tenant/page.tsx` lezen deze keys nu uit de resolver — geen hardcoded NL meer voor deze strings.

**Houtrust-regressie**: page-titel "Abonnementen" → **"Lidmaatschappen"** (consolidatie met sidebar). Verder geen tekstuele wijzigingen — football_school is bewust met dezelfde formulering geseed als de oude hardcoded NL-strings.

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
