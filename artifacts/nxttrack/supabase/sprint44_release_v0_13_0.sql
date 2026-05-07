-- Sprint 44 — Publiceer release v0.13.0 in `platform_releases`.
-- Idempotent op `version` (insert ... on conflict do nothing).
-- Bevat samengevatte changelog van Task #71 (notificatie-dedup),
-- Task #72 (groepenpagina revamp) en Task #73 (dedup uitbreiding),
-- plus de productie-hotfix sprint40 (news_posts seo_* kolommen).

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values
  ('0.13.0', 'minor',
   'Groepenbeheer 2.0 + geen dubbele meldingen meer',
   'De groepenpagina is volledig vernieuwd: tabel met zoek/sort/paginatie, een maximum aantal personen per groep, lid toevoegen via autocomplete (naam/e-mail/athlete-code), CSV import en export, en snelacties per rij. Tegelijk is achter de schermen vastgezet dat één gebeurtenis nooit meer kan leiden tot meerdere identieke meldingen — niet bij training-create, niet bij herinneringen, niet bij nieuws of lidmaatschappen.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Vernieuwde groepenpagina `/tenant/groups`: tabel met zoeken op naam, sorteerbare kolommen, paginatie en de kolom "leden / max" zodat je in één oogopslag ziet hoe vol een groep zit.',
       'Per groep een maximum aantal personen instelbaar (optioneel). Toevoegen wordt automatisch geblokkeerd zodra de grens bereikt is — ook bij gelijktijdige acties van twee admins.',
       'Lid toevoegen via een autocomplete-zoekveld (voornaam, achternaam, e-mail én athlete-code) in plaats van een lange dropdown.',
       'Nieuwe athlete-code per lid: zichtbaar in de zoekresultaten en bruikbaar als primaire match in CSV-imports.',
       'Vernieuwde groep-detailpagina met tabs Atleten / Trainers / Overig, elk met eigen filter, sortering en paginatie.',
       'CSV-export per groep (kolommen: member_id, athlete_code, voornaam, achternaam, e-mail, role, joined_at).',
       'CSV-import in groepen met preview-tabel en per-rij fallback athlete_code → e-mail → member_id; onbekende of dubbele rijen worden expliciet gerapporteerd, niets wordt stilzwijgend overgeslagen.',
       'Snelacties op elke groepsrij: lid bekijken (profiel), verwijderen uit groep (met bevestiging) en direct lid toevoegen vanuit het overzicht.',
       'Audit-log entries voor toevoegen en verwijderen van groepsleden — inclusief bron-markering bij CSV-imports.'
     ),
     'improved', jsonb_build_array(
       'Eén "Nieuwe sessie"-melding levert ook echt één bericht in je inbox op, zelfs bij dubbel-klik of een retry op de server.',
       'Trainings-herinneringen kunnen niet meer dubbel verstuurd worden als de herinnerings-cron twee keer dezelfde sessie ziet.',
       'Dezelfde dedup-bescherming is uitgebreid naar nieuws-publicaties, lidmaatschap-toewijzingen, geaccepteerde uitnodigingen en trainer-aanwezigheidsupdates.',
       'OG-afbeeldingen voor publieke nieuwsberichten vallen nu netjes terug op tenant-logo of `/opengraph.jpg` als er geen eigen post-cover is — voorkomt lege previews bij delen op Facebook/WhatsApp.'
     ),
     'fixed', jsonb_build_array(
       'Tenant-pagina viel om met "column news_posts.seo_title does not exist" op installaties waar de SEO-kolommen nooit zijn aangemaakt — opgelost via idempotente migratie.',
       'Groepenoverzicht toont per groep nu ook een correcte "X / Y leden"-badge in plaats van alleen een totaal.'
     ),
     'admin', jsonb_build_array(
       'SQL-migraties die deze release vereist (in deze volgorde, allemaal idempotent): sprint40_news_seo_columns.sql, sprint41_notification_dedup.sql, sprint42_groups_revamp.sql, sprint43_notification_dedup_extra.sql, sprint44_release_v0_13_0.sql.',
       'Notificatie-dedup werkt op de combinatie (tenant_id, source, source_ref). De RPC `create_notification_with_recipients` doet bij een conflict een lookup-or-insert: een tweede call retourneert het bestaande id zonder fout en zonder extra recipients.',
       'Groepslimiet wordt op database-niveau bewaakt door de constraint trigger `enforce_group_max_members` op `group_members` — pre-checks blijven in de server-action staan voor nette foutmeldingen, maar de DB heeft het laatste woord.',
       'Geen nieuwe environment variables in deze release.'
     )
   ),
   'published', now())
on conflict (version) do nothing;
