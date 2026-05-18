-- ──────────────────────────────────────────────────────────
-- pgTAP-test voor Sprint 82 review-token unique-index.
--
-- Vereist de pgtap-extensie (zit standaard in Supabase). Run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f artifacts/nxttrack/supabase/tests/sprint82_review_token_unique.sql
--
-- Verifieert dat de partial unique index
-- `intake_submissions_review_token_hash_uq` (zoals aangelegd in
-- sprint82_smart_intake.sql) drie kernregels naleeft:
--
--   1) bestaat als unique + partial (predicate review_token_hash
--      is not null).
--   2) duplicaat hash → unique_violation (replay onmogelijk).
--   3) NULL-hash mag co-existeren naast andere NULL-hashes
--      (partial-predicate sluit NULL uit).
--   4) Na vrijgeven van een hash (op NULL) mag dezelfde hash
--      opnieuw worden toegekend aan een andere submission —
--      exact wat chooseProposedSlot / confirmWaitlistChoice doet.
--
-- Alle wijzigingen worden binnen één transactie gedaan en aan
-- het eind teruggerold; er blijft niets in de database staan.
-- ──────────────────────────────────────────────────────────

begin;

create extension if not exists pgtap;

select plan(7);

-- (0) Index-object bestaat, is unique en is partial. ----------------
select has_index(
  'public', 'intake_submissions',
  'intake_submissions_review_token_hash_uq',
  'partial unique index op review_token_hash moet bestaan'
);

select is(
  (select indisunique
     from pg_index i
     join pg_class c on c.oid = i.indexrelid
    where c.relname = 'intake_submissions_review_token_hash_uq'),
  true,
  'index is unique'
);

select isnt(
  (select pg_get_expr(indpred, indrelid)
     from pg_index i
     join pg_class c on c.oid = i.indexrelid
    where c.relname = 'intake_submissions_review_token_hash_uq'),
  null,
  'index is partial (heeft een predicate)'
);

-- Setup: kale tenant + 4 submissions die we ophalen in losse stappen.
-- Geen `do $$` blocks meer want pgTAP runt zelf binnen de transactie.
insert into public.tenants (id, slug, name)
  values (
    '11111111-1111-1111-1111-111111111111',
    'sprint82-pgtap-' || substr(gen_random_uuid()::text, 1, 8),
    'Sprint82 pgTAP test'
  );

insert into public.intake_submissions (id, tenant_id, status, review_token_hash, review_token_expires_at)
  values (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'submitted',
    encode(sha256('token-aaa'::bytea), 'hex'),
    now() + interval '7 days'
  );

-- (1) Tweede submission met dezelfde hash MOET unique_violation gooien.
select throws_ok(
  $$ insert into public.intake_submissions (id, tenant_id, status, review_token_hash, review_token_expires_at)
       values (
         '33333333-3333-3333-3333-333333333333',
         '11111111-1111-1111-1111-111111111111',
         'submitted',
         encode(sha256('token-aaa'::bytea), 'hex'),
         now() + interval '7 days'
       ) $$,
  '23505',
  null,
  'duplicaat review_token_hash → unique_violation (replay onmogelijk)'
);

-- (2) Meerdere NULL-hashes mogen co-existeren (partial-predicate
--     sluit NULL uit). Zonder deze eigenschap zou élke gewone
--     submission een hash moeten hebben — onmogelijk te runnen.
insert into public.intake_submissions (id, tenant_id, status, review_token_hash)
  values
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'submitted', null),
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'submitted', null);

select is(
  (select count(*)::int from public.intake_submissions
    where tenant_id = '11111111-1111-1111-1111-111111111111'
      and review_token_hash is null),
  2,
  'meerdere NULL review_token_hash co-existeren'
);

-- (3) Single-use recycling: hash op NULL zetten geeft hem vrij voor
--     hergebruik op een andere submission (= exact wat chooseProposedSlot
--     doet zodra de aanvrager een slot heeft gekozen).
update public.intake_submissions
   set review_token_hash = null,
       review_token_expires_at = null
 where id = '22222222-2222-2222-2222-222222222222';

select lives_ok(
  $$ update public.intake_submissions
        set review_token_hash = encode(sha256('token-aaa'::bytea), 'hex'),
            review_token_expires_at = now() + interval '7 days'
      where id = '44444444-4444-4444-4444-444444444444' $$,
  'hash mag hergebruikt worden nadat de eerdere submission hem heeft vrijgegeven'
);

-- (4) Een tweede onafhankelijke hash mag óók naast de eerste leven.
select lives_ok(
  $$ update public.intake_submissions
        set review_token_hash = encode(sha256('token-bbb'::bytea), 'hex'),
            review_token_expires_at = now() + interval '7 days'
      where id = '55555555-5555-5555-5555-555555555555' $$,
  'tweede onafhankelijke hash mag naast eerste bestaan'
);

select * from finish();

rollback;
