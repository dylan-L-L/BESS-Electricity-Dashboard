-- Private source-artifact bucket for GL-MVP-002.
-- Original files and extracted artifacts are never exposed through a public URL.

insert into storage.buckets (
  id,
  name
)
values (
  'grid-ledger-imports',
  'grid-ledger-imports'
)
on conflict (id) do update
set
  name = excluded.name;

-- Hosted and current local Storage schemas expose these bucket-level controls.
-- Older local projects created while Storage was disabled may only have id/name;
-- config.toml still enforces the same global 25 MiB ceiling until Storage upgrades
-- its internal schema on the next service start.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'public'
  ) then
    execute $sql$
      update storage.buckets
      set public = false
      where id = 'grid-ledger-imports'
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    execute $sql$
      update storage.buckets
      set file_size_limit = 26214400
      where id = 'grid-ledger-imports'
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    execute $sql$
      update storage.buckets
      set allowed_mime_types = array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv',
        'text/html',
        'text/plain',
        'application/json'
      ]::text[]
      where id = 'grid-ledger-imports'
    $sql$;
  end if;
end;
$$;

drop policy if exists import_storage_admin_read on storage.objects;
drop policy if exists import_storage_admin_insert on storage.objects;

create policy import_storage_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'grid-ledger-imports'
  and (select public.is_admin())
);

create policy import_storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'grid-ledger-imports'
  and (select public.is_admin())
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on column public.import_jobs.storage_path is
  'Private grid-ledger-imports object path. Expected layout: {auth.uid()}/{job_id}/{filename}.';
