# NXTTRACK — Functionaliteit-overzicht voor tenant admins

> Versie: mei 2026 — bedoeld voor de eerste tenant admins van Voetbalschool Houtrust.
> Dit document beschrijft de huidige live-functionaliteit, gegroepeerd in drie lagen:
> 1. Publieke kant (zonder login, marketing van NXTTRACK zelf)
> 2. Ingelogde leden (atleet / ouder / trainer) op je clubomgeving
> 3. Tenant admin (clubbeheer)
>
> Platform-admin (NXTTRACK-team intern) is bewust weggelaten.

---

## 1. Publieke kant — `nxttrack.nl`

Dit is de etalage van NXTTRACK zelf. Hier komt iemand die het platform nog niet kent. Je tenant-omgeving is hier los van: jouw club zit op `voetbalschool-houtrust.nxttrack.nl` (en straks eventueel op je eigen domein).

| Pagina | URL | Wat staat er |
|---|---|---|
| Homepage | `/` | Hero met USP's, overzicht van de 6 kernmodules, sectoren, "Hoe werkt het" stappenplan, CTA's naar contact en features. |
| Features overzicht | `/features` | Lijst met alle modules, doorklikbaar. |
| Leerlingvolgsysteem | `/features/leerlingvolgsysteem` | Uitleg over voortgang, niveaus, certificering. |
| Certificaten | `/features/certificaten` | Diploma's en badges digitaal uitreiken. |
| Clubfeed | `/features/clubfeed` | Uitleg sociale tijdlijn van de club. |
| Communicatie | `/features/communicatie` | Berichten, notificaties, nieuwsbrieven. |
| Ledenbeheer | `/features/ledenbeheer` | Profielen, gezinnen, rollen, groepen. |
| Gamification | `/features/gamification` | Punten, badges, prestaties. |
| Voor wie | `/voor-wie` + sub-pagina's | Doelgroep-pagina's: zwemscholen, sportverenigingen, academies, dansscholen, sportscholen. |
| Prijzen | `/prijzen` | Pakketten en tarieven. |
| Over ons | `/over-ons` | Missie en team. |
| Contact | `/contact` | Aanvraagformulier (kennismakingsgesprek). |
| Roadmap | `/roadmap` | Wat komt er nog. |
| Privacy / Voorwaarden | `/privacy`, `/voorwaarden` | Juridisch. |
| Login | `/login` | Centraal inlogscherm. |

**Wat een tenant admin hier doet:** in principe niets — dit is voor nieuwe geïnteresseerden. Je gebruikt deze pagina's hooguit om iemand het platform uit te leggen.

---

## 2. Ingelogde leden — `voetbalschool-houtrust.nxttrack.nl`

Dit is de clubomgeving die jouw atleten, ouders en trainers zien. De look-and-feel (kleuren, logo, naam) wordt door de tenant admin ingesteld.

### 2.1 Algemeen / navigatie

- **Subdomein per club**: `voetbalschool-houtrust.nxttrack.nl` (later evt. eigen domein).
- **Profielmenu rechtsboven**: initialen-button → dropdown met "Mijn profiel", "Mijn instellingen", "Uitloggen". Tenant admins zien hier ook **"Admin dashboard"** als snelkoppeling naar de beheersomgeving.
- **Notificatie-bel** en **Berichten-bel** met ongelezen-tellers.
- **Mobile-first**: de hele app is geoptimaliseerd voor telefoon en kan als PWA op het beginscherm worden gezet (instructies via Mijn profiel).

### 2.2 Home / Dashboard — `/`

De landingspagina van de club. Wordt door de tenant admin opgebouwd met **modules** (zie 3.4 Homepage Builder). Standaard zie je:

- **"Today" blok** voor ingelogde leden — vandaag training? aankomende events?
- **Nieuwstegels** — laatste clubnieuws.
- **CTA's** — bv. "Vraag proefles aan" of "Schrijf je in".
- Modules die de admin toevoegt (sponsors, sociale feed, agenda-preview, etc.).

### 2.3 Social Feed — `/feed`

Centrale tijdlijn van de club.

- Posts bekijken, **liken**, **reageren**.
- Zelf posten (mits toegestaan in de rol-instellingen).
- **Mute**-status: een lid dat zich misdraagt kan door admin gemuted worden — dan alleen-lezen.
- Detailweergave per post op `/feed/[id]`.

### 2.4 Agenda — `/schedule`

Trainingen en events.

- Kalenderweergave per dag/week.
- Detailpagina per training (`/schedule/[id]`) met tijd, locatie, trainer, deelnemers.
- **RSVP**: aanwezig / afwezig melden.

### 2.5 Nieuws — `/nieuws`

Clublbericht-feed (officiële mededelingen, los van de social feed).

- Lijstweergave + detail per bericht.

### 2.6 Berichten — `/messages`

Direct messaging tussen leden onderling, en tussen leden en trainers/admins.

- **Inbox** met threads.
- Bestaande thread openen: `/messages/[id]`.
- Nieuw bericht starten: `/messages/new`.
- Ongelezen-teller in de header.

### 2.7 Mijn profiel — `/profile`

- Naam, email, foto.
- **Rollen** binnen deze tenant (atleet, ouder, trainer, admin).
- **Mijn groepen** (welke teams/lessen).
- **Gekoppelde kinderen** (voor ouders).
- PWA-installatiestatus + push-notificatie status.

### 2.8 Mijn instellingen — `/instellingen`

- Notificatievoorkeuren per kanaal (email, push, in-app) en per type event.

### 2.9 Koppel kind — `/koppel-kind`

Voor ouders. De ouder krijgt van de admin (of via een uitnodigings-mail) een **unieke koppelcode** waarmee het kind aan het ouderaccount wordt gehangen. Daarna ziet de ouder de voortgang/agenda van het kind.

### 2.10 Inschrijven & proefles

- **Inschrijven** — `/inschrijven`: volledig aanmeldformulier voor nieuwe leden.
- **Proefles** — `/proefles`: korter formulier voor een proefles-aanvraag.

Beide formulieren landen bij de admin in **Registraties** (zie 3.7).

### 2.11 Custom pagina's — `/p/...`

Pagina's die jij als admin zelf aanmaakt — bijvoorbeeld "Clubreglement", "Tarieven 2026", "Routebeschrijving". Deze zijn vrij in te delen via de pagina-editor.

---

## 3. Tenant admin — `nxttrack.nl/tenant`

> **Belangrijk**: het admin-paneel woont op het apex-domein, niet op je tenant-subdomein. Je komt hier via de "Admin dashboard"-link in je profielmenu, of rechtstreeks via `https://nxttrack.nl/tenant`. Vereist een rol met admin-permissie.

### 3.1 Dashboard — `/tenant`

- Statistieken: aantal nieuwsberichten, recente registraties, aankomende trainingen.
- Snelkoppelingen naar veelgebruikte beheer-secties.

### 3.2 Ledenbeheer — `/tenant/members`

- Lijst van alle leden binnen de tenant (zoeken/filteren op rol).
- Detailpagina per lid (`/tenant/members/[id]`):
  - Profielgegevens bewerken
  - Rollen toekennen/intrekken (atleet, ouder, trainer, admin, etc.)
  - Wachtwoord-reset starten
  - Gezinslid koppelen (ouder-kind)
- **Lid toevoegen**: handmatig of via uitnodigings-email.
- **Lid verwijderen** (soft-delete).

### 3.3 Groepen — `/tenant/groups`

- Trainingsgroepen / teams aanmaken.
- Leden toevoegen aan een groep met een **rol binnen die groep** (bv. trainer / atleet / assistent).
- Een lid kan in meerdere groepen zitten met verschillende rollen.

### 3.4 Trainingen — `/tenant/trainings`

- Trainingssessies plannen (datum, tijd, locatie, groep, trainer).
- Per training een **presentielijst** (`/tenant/trainings/[id]/attendance`): wie was er.
- **Herinneringen** sturen naar deelnemers (push + email).

### 3.5 Communicatie

- **Alerts** — `/tenant/communication/alerts`: belangrijke melding bovenin de app voor alle leden (bv. "Training afgelast door regen").
- **Nieuwsbrieven** — `/tenant/newsletters`: opstellen en versturen van mass-mailings (werkt via SMTP / SendGrid).
- **E-mail templates** — `/tenant/email-templates`: aanpassen van automatische mails (welkom, wachtwoord-reset, registratie-bevestiging, etc.).

### 3.6 Content & CMS

- **Homepage Builder** — `/tenant/homepage`: bouw je clublanding pagina met modules (hero, nieuws-feed, social feed, agenda-preview, CTA, sponsors, custom HTML, etc.). Drag-and-drop volgorde.
- **Pagina's** — `/tenant/pages`: custom pagina's aanmaken en beheren (komt op `/p/...` op je subdomein).
- **Menuvolgorde** — `/tenant/pages/menu`: navigatie-indeling van de publieke kant.
- **Media wall** — `/tenant/media-wall`: foto's en video's uploaden voor gebruik door de hele app.
- **Sponsoren** — `/tenant/sponsors`: sponsorlogo's beheren met linkjes; te tonen via een sponsor-module op de homepage.

### 3.7 Registraties — `/tenant/registrations`

Inkomende aanmeldingen (proefles + inschrijving).

- Lijst met status: **Nieuw**, **In behandeling**, **Geaccepteerd**, **Afgewezen**.
- Per registratie de volledige formulierdata bekijken.
- **Omzetten naar lid** (1-klik): er wordt een account aangemaakt en de juiste rol toegekend.

### 3.8 Social moderatie — `/tenant/social-moderation`

- Gerapporteerde posts/comments bekijken.
- Lid **muten** (alleen-lezen) of **unmuten**.
- Posts verwijderen.

### 3.9 Instellingen — `/tenant/settings`

- **Algemeen**: tenant-naam, logo, adres, contactgegevens.
- **Thema** — `/tenant/settings/themes`: kleuren, accentkleur, lettertypes — direct preview.
- **Rollen** — `/tenant/settings/roles`: welke permissies heeft welke rol (posten op feed, registraties beheren, leden uitnodigen, etc.).
- **E-mail / SMTP**: server-instellingen voor uitgaande mail (of SendGrid).
- **Push-notificaties**: instellingen voor mobile push.
- **SEO**: meta-titel/omschrijving voor je publieke pagina's.
- **Social feed instellingen** — `/tenant/settings/social-feed`: feed aan/uit, wie mag posten, modering aan/uit, beperkingen voor minderjarige atleten.

---

## 4. Rollen & permissies (samenvatting)

| Rol | Wat zie/doe je |
|---|---|
| **Atleet** | Eigen profiel, agenda, trainingen, RSVP, social feed lezen + (mits toegestaan) posten, berichten, gekoppelde club-content. |
| **Ouder** | Idem, plus inzicht in gekoppelde kinderen (agenda, voortgang, registraties). |
| **Trainer** | Idem als atleet, plus presentie invoeren bij eigen trainingen, broadcast-post naar de groep, eigen training-deelnemers zien. |
| **Tenant admin** | Volledig beheerpaneel zoals beschreven in sectie 3. |

> Permissies zijn per tenant fijn-instelbaar via Instellingen → Rollen.

---

## 5. Wat is er **nog niet** of **deels** klaar

Wees hier eerlijk in naar je leden — beter nu communiceren dan teleurstellen:

- **Gamification (badges, punten, leaderboards)** — concept staat, UI volgt.
- **Diplomas / certificaten digitaal uitreiken** — basis is er, eind-flow nog niet 100%.
- **Eigen domein per tenant** — technisch mogelijk, vereist DNS-instelling (zie aparte handleiding).
- **iOS/Android native app** — voorlopig PWA (web-app op beginscherm).
- **Outbound mail** — werkt; vereist juiste DNS-records voor optimale aflevering (SPF/DKIM).

---

## 6. Hulp nodig?

- Tenant admin-vragen: contact via `nxttrack.nl/contact` of het interne admin-supportkanaal.
- Bug of suggestie? Maak een melding via Berichten naar de platform-beheerder.

— Einde document —
