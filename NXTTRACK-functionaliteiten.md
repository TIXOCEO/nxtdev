# NXTTRACK — Overzicht van alle functionaliteiten

_Bijgewerkt: 3 mei 2026_

Dit document beschrijft alle functies die op dit moment beschikbaar zijn in het NXTTRACK-platform, gegroepeerd per type gebruiker. Elke functie staat met de bijbehorende route en een korte omschrijving.

---

## 1. Publieke gebruikers (bezoekers en ingelogde leden)

Deze functies zijn bereikbaar onder `/t/<club-slug>/...` en worden gebruikt door bezoekers van de clubsite en door ingelogde leden, ouders, atleten en trainers.

### Publieke navigatie

| Functie | Route | Omschrijving |
|---|---|---|
| **Homepage (modulair)** | `/t/[slug]` | Dynamische clubpagina opgebouwd uit configureerbare modules (zie hieronder). |
| **Custom pagina's** | `/t/[slug]/p/[...path]` | Door de admin aangemaakte tekstpagina's (bv. "Over ons", "Contact"). |
| **Login** | `/t/[slug]/login` | Inlogpagina voor leden van de club. |
| **Registreren** | `/t/[slug]/register` | Aanmaken van een nieuw gebruikersaccount voor deze club. |
| **Inschrijven** | `/t/[slug]/inschrijven` | Aanvraagformulier voor een officieel lidmaatschap. |
| **Proefles aanvragen** | `/t/[slug]/proefles` | Korte aanvraag voor een gratis proefles. |
| **Uitnodiging accepteren** | `/t/[slug]/invite/[token]` | Activatielanding voor een uitnodigingslink. |
| **Koppel kind** | `/t/[slug]/koppel-kind` | Ouders koppelen het account van hun minderjarige kind. |

### Homepage-modules (door tenant-admin in/uit te schakelen)

| Module | Omschrijving |
|---|---|
| **Hero slider** | Diavoorstelling met grote afbeeldingen, koppen en call-to-action-knoppen. |
| **Nieuws** | Recente clubberichten in een grid of lijst. |
| **Sponsors** | Logo's van sponsoren in een raster of carrousel. |
| **Events / trainingen** | Lijst met aankomende activiteiten en sessies. |
| **Persoonlijk dashboard** | Blok dat alleen ingelogde leden zien — eerstvolgende training, ongelezen meldingen, enz. |
| **Social feed** | Recente community-berichten direct op de startpagina. |

### Communicatie en sociaal

| Functie | Route | Omschrijving |
|---|---|---|
| **Nieuws (overzicht)** | `/t/[slug]/nieuws` | Chronologisch overzicht van alle gepubliceerde clubberichten. |
| **Nieuws (artikel)** | `/t/[slug]/nieuws/[postSlug]` | Volledige weergave van één artikel met tekst en media. |
| **Social feed** | `/t/[slug]/feed` | Community-tijdlijn waar leden posts plaatsen, liken en reageren. |
| **Berichtencentrum** | `/t/[slug]/messages` | Privé-inbox voor 1-op-1- en groepsgesprekken. |
| **Nieuw bericht** | `/t/[slug]/messages/new` | Start een nieuw gesprek met een ander lid of een trainer. |
| **Notificaties** | `/t/[slug]/notifications` | Overzicht van alle persoonlijke meldingen (RSVP-herinneringen, nieuws, berichten, enz.). |

### Activiteiten

| Functie | Route | Omschrijving |
|---|---|---|
| **Agenda / planning** | `/t/[slug]/schedule` | Centraal overzicht van alle aankomende trainingen en evenementen. |
| **Sessiedetail + RSVP** | `/t/[slug]/schedule/[id]` | Details van één sessie waar leden hun aanwezigheid kunnen doorgeven. |

### Persoonlijke omgeving (ingelogd)

| Functie | Route | Omschrijving |
|---|---|---|
| **Profiel** | `/t/[slug]/profile` | Persoonlijke gegevens, foto en lidmaatschapsstatus inzien. |
| **Instellingen** | `/t/[slug]/instellingen` | Voorkeursinstellingen: thema (licht/donker/systeem), notificaties per kanaal, taal. |
| **Themavoorkeur** | (binnen instellingen) | Per gebruiker te kiezen lichte of donkere weergave. **Standaard staat deze nu op licht.** |

---

## 2. Tenant-admins (clubbeheerders)

Bereikbaar onder `/tenant/...`. Beheerders van één specifieke club zien hier alle beheertools voor hun vereniging.

### Hoofdmenu

| Functie | Route | Omschrijving |
|---|---|---|
| **Dashboard** | `/tenant` | Overzicht met kerncijfers en snelkoppelingen naar alle beheertaken. |

### Leden en groepen

| Functie | Route | Omschrijving |
|---|---|---|
| **Leden** | `/tenant/members` | Volledige ledenlijst met zoeken, filteren en bewerken. |
| **Inschrijvingen** | `/tenant/registrations` | Behandel binnenkomende lidmaatschapsaanvragen (goedkeuren / afwijzen). |
| **Groepen & teams** | `/tenant/groups` | Trainingsgroepen aanmaken, leden en trainers toewijzen. |
| **Uitnodigingen** | `/tenant/invites` | Verstuur en beheer uitnodigingslinks voor nieuwe leden of trainers. |

### Activiteiten

| Functie | Route | Omschrijving |
|---|---|---|
| **Trainingen** | `/tenant/trainings` | Periodieke trainingen en losse sessies plannen. |
| **Aanwezigheid** | `/tenant/trainings/[id]/attendance` | Aanwezigheid per sessie registreren door de trainer. |

### Communicatie

| Functie | Route | Omschrijving |
|---|---|---|
| **Nieuws** | `/tenant/news` | Clubberichten schrijven, bewerken en publiceren met rich-text editor. |
| **Alerts** | `/tenant/communication/alerts` | Belangrijke meldingen die als banner bovenaan de site verschijnen. |
| **Meldingen (push)** | `/tenant/notifications` | Overzicht van geconfigureerde push-events en handmatige verzending via `/tenant/notifications/new`. |
| **E-mail templates** | `/tenant/email-templates` | Bewerk de tekst en HTML van elke automatische e-mail (welkom, herinnering, RSVP-bevestiging, …) met een rich-text editor en live voorbeeld. |
| **Nieuwsbrieven** | `/tenant/newsletters` | Stel een eigen nieuwsbrief op met de rich-text editor en verstuur direct naar **alle leden** of **specifieke groepen**. Inclusief test-verzending, voorbeeldweergave en verzendlogboek. |
| **Social moderatie** | `/tenant/social-moderation` | Posts en reacties uit de social feed bekijken, verbergen of verwijderen; leden tijdelijk dempen. |

### Inhoud en uitstraling

| Functie | Route | Omschrijving |
|---|---|---|
| **Homepage builder** | `/tenant/homepage` | Sleep-en-zet editor om de modulaire opbouw van de publieke startpagina te configureren. |
| **Custom pagina's (CMS)** | `/tenant/pages` | Beheer van de menu-structuur en losse inhoudspagina's (bv. "Geschiedenis", "Reglement"). |
| **Media wall** | `/tenant/media-wall` | Foto's en video's uploaden en ordenen voor de publieke galerij. |
| **Sponsors** | `/tenant/sponsors` | Sponsorprofielen aanmaken, logo's en zichtbaarheid beheren. |

### Instellingen

| Functie | Route | Omschrijving |
|---|---|---|
| **Algemeen** | `/tenant/settings` | Naam, contactgegevens, slug en algemene clubinstellingen. |
| **E-mail instellingen** | `/tenant/settings` (sectie e-mail) | Afzendernaam, reply-to, e-mails aan/uit, herinneringsbeleid. |
| **Thema & branding** | `/tenant/settings/themes` | Kies of pas een thema aan: kleuren, logo, accent — voor licht- en donkermodus apart. |
| **SEO** | `/tenant/settings` (sectie SEO) | Metatitel, beschrijving, social-share-afbeelding per pagina. |
| **Social feed-instellingen** | `/tenant/settings/social-feed` | Wie mag posten, beleid voor minderjarigen, mute-instellingen. |
| **Rollen & rechten** | `/tenant/settings` (sectie rechten) | Bepalen welke rollen welke acties mogen uitvoeren. |

---

## 3. Platform-admins (NXTTRACK superusers)

Bereikbaar onder `/platform/...`. Alleen voor beheerders van het hele platform — overstijgt individuele clubs.

| Functie | Route | Omschrijving |
|---|---|---|
| **Platform-dashboard** | `/platform` | Globaal overzicht van clubs, gebruikers en systeemstatus. |
| **Tenants beheren** | `/platform/tenants` | Clubs aanmaken, opschorten, status wijzigen, eigenaar instellen. |
| **Globale thema's** | `/platform/themes` | Basistemplates en kleurschema's beheren die door alle clubs gekozen kunnen worden. |
| **E-mail logs** | `/platform/email/logs` | Inzage in elke verzonden mail: ontvanger, onderwerp, status, foutmelding. |
| **Push-service** | `/platform/push` | Monitoring en beheer van de centrale push-notificatie-infrastructuur. |
| **Profielfoto's** | `/platform/profile-pictures` | Globale opslag- en moderatieconfiguratie voor avatars. |
| **Systeemadmins** | `/platform/settings/admins` | Andere platform-superusers toevoegen of verwijderen. |

---

## Recent toegevoegd (sprint 20)

- **Branded e-mail-wrap**: elke uitgaande mail toont nu automatisch het logo van de club bovenaan en een footer met website-info en de uitschrijf-tekst onderaan — geen technische instelling meer nodig.
- **Rich-text editor (TipTap)** voor zowel e-mailtemplates als nieuwsbrieven, met directe voorbeeldweergave.
- **Nieuwsbrief-systeem v1**: concepten opslaan, test versturen, direct verzenden naar alle leden of geselecteerde groepen, status-tracking per nieuwsbrief.
- **Lichte modus standaard**: nieuwe gebruikers zien voortaan de lichte weergave; ze kunnen zelf nog kiezen voor donker of automatisch via Instellingen → Weergave.
