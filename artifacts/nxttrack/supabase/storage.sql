-- ─────────────────────────────────────────────────────────
-- NXTTRACK — Storage Bucket: tenant-media
-- Run AFTER schema.sql (depends on is_platform_admin /
-- is_tenant_admin helper functions).
-- Path convention: <tenant_id>/<filename>
-- ─────────────────────────────────────────────────────────

-- 1. Bucket
insert into storage.buckets (id, name, public)
values ('tenant-media', 'tenant-media', true)
on conflict (id) do nothing;

-- Helper: true iff `name` starts with a valid UUID followed by '/...'.
-- Guards the ::uuid cast in the policies below from raising on bad paths.
create or replace function public.tenant_media_first_segment_uuid(name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
begin
  first_segment := split_part(name, '/', 1);
  if first_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return first_segment::uuid;
end;
$$;

-- 2. Policies on storage.objects
drop policy if exists "tenant_media_public_read"   on storage.objects;
drop policy if exists "tenant_media_admin_insert"  on storage.objects;
drop policy if exists "tenant_media_admin_update"  on storage.objects;
drop policy if exists "tenant_media_admin_delete"  on storage.objects;

-- Public can read all files in the bucket
create policy "tenant_media_public_read"
  on storage.objects for select
  using (bucket_id = 'tenant-media');

-- Tenant admins (or platform admin) can upload to their tenant folder.
-- The first path segment must be a valid UUID equal to a tenant they manage.
create policy "tenant_media_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'tenant-media'
    and auth.role() = 'authenticated'
    and public.tenant_media_first_segment_uuid(name) is not null
    and (
      public.is_platform_admin()
      or public.is_tenant_admin( public.tenant_media_first_segment_uuid(name) )
    )
  );

create policy "tenant_media_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'tenant-media'
    and public.tenant_media_first_segment_uuid(name) is not null
    and (
      public.is_platform_admin()
      or public.is_tenant_admin( public.tenant_media_first_segment_uuid(name) )
    )
  );

create policy "tenant_media_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tenant-media'
    and public.tenant_media_first_segment_uuid(name) is not null
    and (
      public.is_platform_admin()
      or public.is_tenant_admin( public.tenant_media_first_segment_uuid(name) )
    )
  );
