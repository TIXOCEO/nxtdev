# Onboarding test-checklist (Sprint 23 → Sprint G)

Manueel uit te voeren rookproef voor de complete onboarding-rebuild.
Vereist: een live Supabase met de migraties uit `supabase/README.md`
geladen, één testtenant (bv. `houtrust`), één platform-admin account
en een verse e-mail-inbox voor invites.

Tip: voer elke stap uit in een **incognito-tab** zodat sessies niet
overlappen, en log na iedere mutatie ook in als tenant-admin om de
admin-zijde te verifiëren.

---

## 1. Publieke ouder-registratie met kind
- Open `/t/{slug}/inschrijven`.
- Kies "Ouder", vul gegevens in, voeg minimaal één kind toe.
- Verzend, check inbox van het opgegeven e-mailadres.
- Verwacht: invite-mail met set-wachtwoord-link.
- Zet wachtwoord, login → redirect naar `/t/{slug}/profile`.
- Verwacht: tab **Kinderen** toont het opgegeven kind, geen IBAN-velden.

## 2. Publieke ouder-registratie via koppelcode
- Genereer als tenant-admin een koppelcode op een bestaand minor-lid
  (`/tenant/members/[id]` → "Genereer koppelcode" naast het kind).
- Open `/t/{slug}/inschrijven`, kies "Ouder", vink "ik koppel via code",
  plak de code, vul ouder-gegevens in.
- Verzend → invite-mail → wachtwoord → login.
- Verwacht: het bestaande kind staat nu onder tab **Kinderen** zonder
  dubbele member-rij.

## 3. Publieke volwassen sporter-registratie
- `/t/{slug}/inschrijven` → "Volwassen sporter".
- Verwacht: geen IBAN/initialen/voorletters/rekeninghouder veld.
- Voltooi flow → invite → login → profielpagina toont **Sport**-tab
  met read-only ATH-code.

## 4. Publieke trainer/staf-registratie (optioneel)
- Zet `tenants.settings_json.public_staff_registration_enabled = true`.
- `/t/{slug}/inschrijven` → trainer of staf opties verschijnen.
- Voltooi → ontvang trainer/staf-invite-template, login werkt.
- Met flag uit: opties zijn niet zichtbaar.

## 5. Admin handmatig lid toevoegen (zonder invite)
- `/tenant/members` → "Voeg toe" → kies type, geen e-mail.
- Lid verschijnt in lijst, status `prospect`, geen invite verstuurd.

## 6. Admin invite voor minor met auto-link naar ouder
- `/tenant/members` → "Voeg toe" → kies "Minor + ouder invite",
  vul ouder-e-mail in.
- Verwacht: minor-member aangemaakt, parent-invite met
  `child_member_id` verstuurd.
- Open invite-link in incognito → één formulier (naam + wachtwoord),
  geen koppelcode-stap → na submit redirect naar
  `/t/{slug}/login?next=/t/{slug}/profile`.
- Login als ouder → kind staat al gekoppeld in **Kinderen**-tab.

## 7. Admin profiel bewerken (Sprint F)
- `/tenant/members/[id]` → bewerk first/last/birth/adres/notes/lid sinds.
- Wijzig status van `active` → `paused` → opslaan.
- Verwacht: full_name update via DB-trigger, audit-shim regel in console
  (Sprint G: log naar audit-tabel zodra geïmplementeerd).

## 8. Archiveer + heractiveer lid
- `/tenant/members/[id]` → "Archiveer lid" → bevestig.
- Verwacht: gele banner verschijnt, lid verdwijnt uit `/tenant/members`,
  verschijnt onder `?status=archived`-toggle.
- Klik "Heractiveer" → status terug naar `active`, archived_at = null.
- Bewerk via formulier: zet status archived → other, verifieer dat
  archived_at automatisch wordt geleegd (Sprint F regressie-bescherming).

## 9. Ontkoppel ouder ↔ kind
- Detail-pagina van een ouder → klik "Ontkoppel" naast een kind.
- Verwacht: koppeling verdwijnt aan beide kanten zonder de members
  zelf te verwijderen.

## 10. IBAN mask + reveal-flow
- Login als sporter (account_type=athlete, member.user_id gevuld).
- `/t/{slug}/profile?tab=financieel` → vul IBAN + tenaamstelling +
  payment_method (rekening) → opslaan.
- Verwacht: IBAN getoond als `NL00 •••• •••• ••XX`.
- Klik "Toon (30s)" → volledig IBAN zichtbaar, audit-shim logt
  `financial.reveal`, na 30s automatisch terug naar mask.

## 11. Tenant-admin bekijkt IBAN van lid
- Login als tenant-admin met permissie `members.financial.view`.
- `/tenant/members/[id]` → sectie "Financieel" verschijnt → mask
  zichtbaar → reveal werkt eveneens (audit-log).
- Login als gebruiker zonder die permissie → sectie verschijnt niet.

## 12. Payment method toevoegen + archiveren
- `/tenant/settings/betaalmogelijkheden` → "Voeg toe" met type
  `rekening` → IBAN-veld verplicht, mod-97 validatie blokkeert
  ongeldige IBANs.
- Voeg type `contant` en `incasso` toe (geen IBAN nodig).
- Archiveer een methode → verschijnt onder "Gearchiveerd";
  verdwijnt uit ledenkeuze in `/t/{slug}/profile?tab=financieel`.
- Heractiveer → terug in keuzelijst.

## 13. Staff/trainer separation
- Maak twee invites: één `trainer_account`, één `staff_account`.
- Verwacht: beide gebruiken `staff_invite`-template met
  `{{function_label}}` = trainer/staf.
- Acceptatie-formulier: enkel naam + wachtwoord, geen
  player/keeper-keuze, geen kids-stap.
- Na login krijgt het account automatisch de juiste systeemrol
  ("Trainer" of "Staf") via `sync_staff_trainer_role` trigger.

## 14. Tenant-isolatie
- Maak in tenant A een lid + payment_method + financial_details.
- Login bij tenant B als admin → `/tenant/members` toont **niets** uit
  tenant A; betaalmogelijkheden-pagina toont alleen tenant B-rijen.
- Probeer via DevTools een server action met `tenant_id` van tenant A
  vanuit tenant B-context aan te roepen → `assertTenantAccess` blokkeert.
- RLS-test: log in als tenant B en query `member_financial_details` →
  geen rijen van tenant A zichtbaar.

---

## Smoke
- `pnpm --filter @workspace/nxttrack exec tsc --noEmit` → groen.
- `pnpm --filter @workspace/nxttrack run build` → groen.
- Browser-console bij elke route: geen errors of unhandled rejections.
