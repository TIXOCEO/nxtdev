-- Sprint 76 — Release notes v0.33.0 (idempotent).
insert into public.platform_releases
  (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.33.0',
  'minor',
  'Vrijgekomen plekken — automatische signalering',
  'Wanneer ergens een plek vrijkomt (lid verlaat een groep of admin verhoogt de capaciteit), genereert NXTTRACK automatisch een signaal voor tenant-admins met het aantal wachtende kandidaten. Afhandeling gebeurt vanuit een nieuwe pagina onder Intake.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Nieuwe pagina "Vrijgekomen plekken" onder Intake met openstaande signalen, top-wachtlijst-kandidaten per groep en directe links naar de placement-assistent.',
      'Database-trigger op group_members en groups detecteert vrijkomende plekken automatisch (één signaal per groep per dag).'
    ),
    'improved', jsonb_build_array(
      'Stats-kaart op /tenant/intake heeft een 7e tegel met het aantal openstaande signalen.',
      'Tenant-admins kunnen signalen markeren als "afgehandeld" of "wegklikken" wanneer ze niet meer relevant zijn.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Houtrust-veilig: zonder wachtlijst-submissions ontstaan er nooit signalen.',
      'Triggers zijn exception-tolerant — een mislukte signaalregistratie kan nooit een ledenmutatie rollbacken.'
    )
  ),
  'published',
  now()
)
on conflict (version) do update
  set status       = excluded.status,
      published_at = coalesce(public.platform_releases.published_at, excluded.published_at);
