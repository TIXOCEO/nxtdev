-- ──────────────────────────────────────────────────────────
-- Sprint 47 — Zwemschool-terminologie + sector-progress-template-kolom
--
-- 1. Voegt nieuwe terminology-keys toe aan de drie geseede sector
--    templates (waitlist, makeup, milestone, certificate-context).
-- 2. Voegt `sector_templates.progress_template_json jsonb` toe — wordt
--    door fase E (sprint51) ingelezen om bij tenant-creatie een
--    voortgangsboom te clonen. Default lege array → géén Houtrust-
--    regressie omdat football_school leeg blijft.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

alter table public.sector_templates
  add column if not exists progress_template_json jsonb not null default '[]'::jsonb;

-- Generic — neutrale termen
update public.sector_templates
   set terminology_json = terminology_json
       || jsonb_build_object(
            'waitlist_singular',         'Wachtlijst-aanvraag',
            'waitlist_plural',           'Wachtlijst-aanvragen',
            'waitlist_page_description', 'Beheer aanvragen die op een vrije plek wachten.',
            'makeup_singular',           'Inhaalsessie',
            'makeup_plural',             'Inhaalsessies',
            'makeup_credit_singular',    'Inhaalcredit',
            'makeup_credit_plural',      'Inhaalcredits',
            'milestone_singular',        'Mijlpaal',
            'milestone_plural',          'Mijlpalen',
            'milestone_event_singular',  'Mijlpaal-event',
            'milestone_event_plural',    'Mijlpaal-events',
            'progress_module_singular',  'Voortgangsmodule',
            'progress_module_plural',    'Voortgangsmodules',
            'capacity_resource_singular','Capaciteit',
            'capacity_resource_plural',  'Capaciteiten'
          )
 where key = 'generic';

-- Football_school — termen blijven leeg/zelfde als generic; we voegen alleen
-- veilige defaults toe zodat oude UI niet leeg valt. Geen Houtrust-regressie.
update public.sector_templates
   set terminology_json = terminology_json
       || jsonb_build_object(
            'waitlist_singular',         'Wachtlijst-aanmelding',
            'waitlist_plural',           'Wachtlijst-aanmeldingen',
            'waitlist_page_description', 'Spelers die op een vrije plek wachten.',
            'makeup_singular',           'Inhaaltraining',
            'makeup_plural',             'Inhaaltrainingen',
            'makeup_credit_singular',    'Inhaalcredit',
            'makeup_credit_plural',      'Inhaalcredits',
            'milestone_singular',        'Stap',
            'milestone_plural',          'Stappen',
            'milestone_event_singular',  'Selectiedag',
            'milestone_event_plural',    'Selectiedagen',
            'progress_module_singular',  'Ontwikkelingsdoel',
            'progress_module_plural',    'Ontwikkelingsdoelen',
            'capacity_resource_singular','Veld',
            'capacity_resource_plural',  'Velden'
          )
 where key = 'football_school';

-- Swimming_school — kerntermen voor het hele zwemschool-fundament.
update public.sector_templates
   set terminology_json = terminology_json
       || jsonb_build_object(
            'waitlist_singular',         'Wachtlijst-plaatsing',
            'waitlist_plural',           'Wachtlijst-plaatsingen',
            'waitlist_page_description', 'Leerlingen die wachten op een vrije plek in een lesgroep.',
            'makeup_singular',           'Inhaalles',
            'makeup_plural',             'Inhaallessen',
            'makeup_credit_singular',    'Inhaal-tegoed',
            'makeup_credit_plural',      'Inhaal-tegoeden',
            'milestone_singular',        'Diploma-onderdeel',
            'milestone_plural',          'Diploma-onderdelen',
            'milestone_event_singular',  'Afzwemmoment',
            'milestone_event_plural',    'Afzwemmomenten',
            'progress_module_singular',  'Diploma',
            'progress_module_plural',    'Diploma''s',
            'capacity_resource_singular','Bad of baan',
            'capacity_resource_plural',  'Baden en banen'
          )
 where key = 'swimming_school';

-- Optionele zwemschool-progress-template seed (ZwemABC) — alleen als nog leeg.
update public.sector_templates
   set progress_template_json = jsonb_build_array(
         jsonb_build_object(
           'slug', 'zwem-a',
           'name', 'Zwemdiploma A',
           'description', 'Basisvaardigheden voor zelfredzaamheid in en rond het water.',
           'sort_order', 1,
           'categories', jsonb_build_array(
             jsonb_build_object(
               'slug', 'watergewenning',
               'name', 'Watergewenning',
               'description', 'Vertrouwd raken met water op het gezicht en onder water.',
               'sort_order', 1,
               'items', jsonb_build_array(
                 jsonb_build_object('slug','gezicht-onderwater','name','Gezicht onder water','sort_order',1),
                 jsonb_build_object('slug','uitademen-onderwater','name','Uitademen onder water','sort_order',2),
                 jsonb_build_object('slug','drijven-rugligging','name','Drijven in rugligging','sort_order',3)
               )
             ),
             jsonb_build_object(
               'slug', 'borstcrawl',
               'name', 'Borstcrawl-basis',
               'description', 'Beenslag, armslag en zijwaartse ademhaling.',
               'sort_order', 2,
               'items', jsonb_build_array(
                 jsonb_build_object('slug','beenslag-borstcrawl','name','Beenslag borstcrawl','sort_order',1),
                 jsonb_build_object('slug','armslag-borstcrawl','name','Armslag borstcrawl','sort_order',2),
                 jsonb_build_object('slug','adem-borstcrawl','name','Ademhaling borstcrawl','sort_order',3)
               )
             ),
             jsonb_build_object(
               'slug', 'rugcrawl',
               'name', 'Rugcrawl-basis',
               'description', 'Rugligging combineren met been- en armslag.',
               'sort_order', 3,
               'items', jsonb_build_array(
                 jsonb_build_object('slug','beenslag-rugcrawl','name','Beenslag rugcrawl','sort_order',1),
                 jsonb_build_object('slug','armslag-rugcrawl','name','Armslag rugcrawl','sort_order',2)
               )
             )
           )
         )
       )
 where key = 'swimming_school'
   and (progress_template_json is null or progress_template_json = '[]'::jsonb);

-- football_school + generic blijven leeg → géén Houtrust-regressie en
-- generieke tenants krijgen geen impliciete voortgangsboom.
