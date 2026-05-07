-- Sprint 40 — Hotfix: zorg dat news_posts de seo_* kolommen heeft.
-- Sprint 15 voegde deze al toe via sprint15.sql, maar niet elke
-- productie-DB heeft die migratie ooit gezien. Dit bestand is
-- idempotent en mag op elke DB worden uitgevoerd.
--
-- Effect na uitrol: per-post SEO overrides (seo_title / seo_description
-- / seo_image_url / seo_noindex) gaan voorrang krijgen boven de
-- post-cover en de tenant-default in de OG-metadata. Tot deze migratie
-- gedraaid is blijven die kolommen genegeerd; pages crashen niet.

alter table public.news_posts add column if not exists seo_title       text;
alter table public.news_posts add column if not exists seo_description text;
alter table public.news_posts add column if not exists seo_image_url   text;
alter table public.news_posts add column if not exists seo_noindex     boolean not null default false;
