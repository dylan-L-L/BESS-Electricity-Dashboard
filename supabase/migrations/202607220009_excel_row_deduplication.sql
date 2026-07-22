-- Narrow Excel row deduplication for updated copies of the same named source
-- workbook. This deliberately does not add a global uniqueness constraint:
-- another workbook, target type, sheet, or row position remains independent.

alter table public.import_jobs
add column workbook_source_key text generated always as (
  case
    when input_type = 'excel' then lower(btrim(original_filename))
    else null
  end
) stored;

comment on column public.import_jobs.workbook_source_key is
  'Exact original Excel/CSV filename after outer-whitespace and case normalization. Used only to scope conservative cross-job row deduplication.';

create index import_jobs_workbook_source_key_idx
  on public.import_jobs (workbook_source_key, created_at desc)
  where workbook_source_key is not null;

create or replace function public.find_excel_row_duplicates(
  p_current_job_id uuid,
  p_target_type public.import_target_type,
  p_sheet_name text,
  p_rows jsonb
)
returns table (
  requested_row_number integer,
  requested_raw_row_hash text,
  historical_job_id uuid,
  historical_item_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an administrator can check Excel row duplicates'
      using errcode = '42501';
  end if;

  if p_target_type not in ('signal', 'market_metric') then
    raise exception 'Excel row deduplication requires a concrete target type'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_sheet_name), '') is null then
    raise exception 'Excel row deduplication requires a sheet name'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Excel row deduplication accepts an array of at most 500 rows'
      using errcode = '22023';
  end if;

  return query
  with requested as (
    select
      candidate.source_row_number,
      candidate.raw_row_hash,
      candidate.raw_data
    from jsonb_to_recordset(p_rows) as candidate(
      source_row_number integer,
      raw_row_hash text,
      raw_data jsonb
    )
    where candidate.source_row_number > 0
      and candidate.raw_row_hash ~ '^[0-9a-f]{64}$'
      and jsonb_typeof(candidate.raw_data) = 'object'
  ),
  matches as (
    select
      requested.source_row_number,
      requested.raw_row_hash,
      historical_job.id as historical_job_id,
      historical_item.id as historical_item_id,
      historical_job.created_at,
      historical_item.created_at as item_created_at
    from public.import_jobs as current_job
    join public.import_jobs as historical_job
      on historical_job.input_type = 'excel'
      and historical_job.workbook_source_key = current_job.workbook_source_key
      and historical_job.id <> current_job.id
    join public.import_items as historical_item
      on historical_item.import_job_id = historical_job.id
      and historical_item.target_type = p_target_type
      and historical_item.sheet_name = p_sheet_name
      and historical_item.source_part = 1
      and historical_item.review_status <> 'import_failed'
    join requested
      on requested.source_row_number = historical_item.source_row_number
      -- JSONB equality is the collision-safe check and also makes historical
      -- rows written with the pre-v1 insertion-order hash compatible.
      and requested.raw_data = historical_item.raw_data
    where current_job.id = p_current_job_id
      and current_job.input_type = 'excel'
      and current_job.workbook_source_key is not null
  )
  select distinct on (matches.source_row_number, matches.raw_row_hash)
    matches.source_row_number,
    matches.raw_row_hash,
    matches.historical_job_id,
    matches.historical_item_id
  from matches
  order by
    matches.source_row_number,
    matches.raw_row_hash,
    matches.created_at desc,
    matches.item_created_at desc;
end;
$$;

revoke all on function public.find_excel_row_duplicates(
  uuid,
  public.import_target_type,
  text,
  jsonb
) from public, anon;

grant execute on function public.find_excel_row_duplicates(
  uuid,
  public.import_target_type,
  text,
  jsonb
) to authenticated;
