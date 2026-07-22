-- Grid Ledger GL-MVP-002 import staging pipeline.
-- AI output remains private in these tables until an authenticated administrator
-- approves an item through the dedicated database RPC.

create type public.import_input_type as enum (
  'url',
  'pdf',
  'excel'
);

create type public.import_job_status as enum (
  'pending',
  'processing',
  'review',
  'completed',
  'partial_failed',
  'failed'
);

create type public.import_target_type as enum (
  'signal',
  'market_metric',
  'unknown'
);

create type public.import_item_review_status as enum (
  'ai_draft',
  'pending_review',
  'approved',
  'rejected',
  'import_failed'
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  input_type public.import_input_type not null,
  input_name text not null,
  input_metadata jsonb not null default '{}'::jsonb,
  source_url text,
  normalized_url text,
  canonical_url text,
  original_filename text,
  source_mime_type text,
  original_size_bytes bigint,
  storage_path text,
  extracted_storage_path text,
  extracted_text text,
  file_hash text,
  content_hash text,
  duplicate_of_job_id uuid references public.import_jobs(id) on update cascade on delete restrict,
  status public.import_job_status not null default 'pending',
  total_items integer not null default 0,
  successful_items integer not null default 0,
  failed_items integer not null default 0,
  failure_stage text,
  error_code text,
  error_message text,
  technical_error text,
  retryable boolean not null default false,
  retry_count integer not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint import_jobs_name_not_blank check (
    nullif(btrim(input_name), '') is not null
  ),
  constraint import_jobs_metadata_is_object check (
    jsonb_typeof(input_metadata) = 'object'
  ),
  constraint import_jobs_input_identity check (
    (
      input_type = 'url'
      and source_url ~* '^https?://'
    )
    or (
      input_type in ('pdf', 'excel')
      and nullif(btrim(original_filename), '') is not null
    )
  ),
  constraint import_jobs_normalized_url_is_http check (
    normalized_url is null or normalized_url ~* '^https?://'
  ),
  constraint import_jobs_canonical_url_is_http check (
    canonical_url is null or canonical_url ~* '^https?://'
  ),
  constraint import_jobs_mime_type_not_blank check (
    source_mime_type is null or nullif(btrim(source_mime_type), '') is not null
  ),
  constraint import_jobs_size_nonnegative check (
    original_size_bytes is null
    or original_size_bytes between 0 and 26214400
  ),
  constraint import_jobs_file_hash_format check (
    file_hash is null or file_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint import_jobs_content_hash_format check (
    content_hash is null or content_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint import_jobs_counts_nonnegative check (
    total_items >= 0
    and successful_items >= 0
    and failed_items >= 0
    and successful_items + failed_items <= total_items
  ),
  constraint import_jobs_retry_count_nonnegative check (retry_count >= 0),
  constraint import_jobs_not_self_duplicate check (
    duplicate_of_job_id is null or duplicate_of_job_id <> id
  )
);

comment on table public.import_jobs is
  'Private durable state for one URL, PDF, XLSX, or CSV import attempt.';
comment on column public.import_jobs.input_metadata is
  'Non-secret parser metadata such as selected worksheet and confirmed header mapping.';
comment on column public.import_jobs.extracted_text is
  'Bounded plain text extracted by server code. Original binaries remain in private Storage.';
comment on column public.import_jobs.file_hash is
  'Lowercase SHA-256 of the original uploaded bytes.';
comment on column public.import_jobs.content_hash is
  'Lowercase SHA-256 of normalized extracted content, computed before any AI call.';
comment on column public.import_jobs.created_by is
  'Supabase Auth user UUID. Kept without an auth.users foreign key, matching the MVP audit-column convention.';

create unique index import_jobs_url_content_unique
  on public.import_jobs (
    (coalesce(canonical_url, normalized_url, source_url)),
    content_hash
  )
  where input_type = 'url'
    and content_hash is not null
    and duplicate_of_job_id is null;

create unique index import_jobs_file_hash_unique
  on public.import_jobs (input_type, file_hash)
  where input_type in ('pdf', 'excel')
    and file_hash is not null
    and duplicate_of_job_id is null;

create index import_jobs_queue_idx
  on public.import_jobs (status, created_at);
create index import_jobs_created_by_idx
  on public.import_jobs (created_by, created_at desc);
create index import_jobs_duplicate_of_idx
  on public.import_jobs (duplicate_of_job_id)
  where duplicate_of_job_id is not null;
create index import_jobs_normalized_url_idx
  on public.import_jobs (normalized_url)
  where normalized_url is not null;

create table public.import_items (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on update cascade on delete restrict,
  item_index integer not null,
  target_type public.import_target_type not null default 'unknown',
  source_location jsonb not null default '{}'::jsonb,
  sheet_name text,
  source_row_number integer,
  source_part integer not null default 1,
  raw_row_hash text,
  raw_data jsonb not null default '{}'::jsonb,
  extracted_text text,
  ai_result jsonb,
  draft_data jsonb,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric(5, 4),
  warnings jsonb not null default '[]'::jsonb,
  ai_provider text,
  ai_model text,
  ai_response_id text,
  prompt_version text,
  schema_version text,
  review_status public.import_item_review_status not null default 'ai_draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_note text,
  approved_signal_id uuid unique references public.signals(id) on update cascade on delete restrict,
  approved_market_metric_id uuid unique references public.market_metrics(id) on update cascade on delete restrict,
  approved_record_id uuid generated always as (
    coalesce(approved_signal_id, approved_market_metric_id)
  ) stored,
  failure_stage text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_items_index_positive check (item_index > 0),
  constraint import_items_source_part_positive check (source_part > 0),
  constraint import_items_source_row_positive check (
    source_row_number is null or source_row_number > 0
  ),
  constraint import_items_raw_row_hash_format check (
    raw_row_hash is null or raw_row_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint import_items_source_location_is_object check (
    jsonb_typeof(source_location) = 'object'
  ),
  constraint import_items_raw_data_is_object check (
    jsonb_typeof(raw_data) = 'object'
  ),
  constraint import_items_ai_result_is_object check (
    ai_result is null or jsonb_typeof(ai_result) = 'object'
  ),
  constraint import_items_draft_data_is_object check (
    draft_data is null or jsonb_typeof(draft_data) = 'object'
  ),
  constraint import_items_evidence_is_array check (
    jsonb_typeof(evidence) = 'array'
  ),
  constraint import_items_warnings_is_array check (
    jsonb_typeof(warnings) = 'array'
  ),
  constraint import_items_confidence_range check (
    confidence is null or confidence between 0 and 1
  ),
  constraint import_items_review_payload_required check (
    review_status not in ('pending_review', 'approved')
    or (
      ai_result is not null
      and draft_data is not null
    )
  ),
  constraint import_items_review_audit_required check (
    review_status not in ('approved', 'rejected')
    or (
      reviewed_by is not null
      and reviewed_at is not null
      and nullif(btrim(reviewer_note), '') is not null
    )
  ),
  constraint import_items_failure_message_required check (
    review_status <> 'import_failed'
    or nullif(btrim(error_message), '') is not null
  ),
  constraint import_items_approved_target_matches check (
    (
      review_status = 'approved'
      and (
        (
          target_type = 'signal'
          and approved_signal_id is not null
          and approved_market_metric_id is null
        )
        or (
          target_type = 'market_metric'
          and approved_market_metric_id is not null
          and approved_signal_id is null
        )
      )
    )
    or (
      review_status <> 'approved'
      and approved_signal_id is null
      and approved_market_metric_id is null
    )
  )
);

comment on table public.import_items is
  'Private AI-generated import candidates. Approval atomically creates one formal record.';
comment on column public.import_items.ai_result is
  'Initial schema-validated structured result (AI for URL/PDF, deterministic confirmed mapping for Excel); administrator edits belong in draft_data.';
comment on column public.import_items.draft_data is
  'Current administrator-editable, storage-shaped candidate used by the approval RPC.';
comment on column public.import_items.approved_record_id is
  'Convenience projection over the two type-safe foreign keys; clients cannot set it directly.';

create unique index import_items_job_item_unique
  on public.import_items (import_job_id, item_index);

create unique index import_items_excel_position_unique
  on public.import_items (
    import_job_id,
    sheet_name,
    source_row_number,
    source_part
  )
  where sheet_name is not null and source_row_number is not null;

create index import_items_review_queue_idx
  on public.import_items (review_status, updated_at desc);
create index import_items_job_review_idx
  on public.import_items (import_job_id, review_status);
create index import_items_raw_row_hash_idx
  on public.import_items (raw_row_hash)
  where raw_row_hash is not null;

create trigger import_jobs_set_updated_at
before update on public.import_jobs
for each row execute function public.set_updated_at();

create trigger import_items_set_updated_at
before update on public.import_items
for each row execute function public.set_updated_at();

create function public.bind_import_job_creator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      if not public.is_admin() then
        raise exception 'Only an administrator can create an import job'
          using errcode = '42501';
      end if;
      new.created_by = auth.uid();
    elsif new.created_by is null then
      raise exception 'Import jobs require a creator'
        using errcode = '23502';
    end if;
  elsif new.created_by is distinct from old.created_by then
    raise exception 'Import job creator is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger import_jobs_bind_creator
before insert or update on public.import_jobs
for each row execute function public.bind_import_job_creator();

create function public.recalculate_import_job_counts(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_successful integer;
  v_failed integer;
  v_ai_drafts integer;
  v_pending_review integer;
  v_expected_total integer;
  v_next_status public.import_job_status;
begin
  select
    count(*)::integer,
    count(*) filter (
      where review_status in ('pending_review', 'approved', 'rejected')
    )::integer,
    count(*) filter (where review_status = 'import_failed')::integer,
    count(*) filter (where review_status = 'ai_draft')::integer,
    count(*) filter (where review_status = 'pending_review')::integer
  into
    v_total,
    v_successful,
    v_failed,
    v_ai_drafts,
    v_pending_review
  from public.import_items
  where import_job_id = p_job_id;

  select greatest(total_items, v_total)
  into v_expected_total
  from public.import_jobs
  where id = p_job_id;

  if not found then
    return;
  end if;

  if v_expected_total = 0 then
    update public.import_jobs
    set
      total_items = 0,
      successful_items = 0,
      failed_items = 0
    where id = p_job_id;
    return;
  end if;

  v_next_status := case
    when v_ai_drafts > 0
      or v_successful + v_failed < v_expected_total
      then 'processing'::public.import_job_status
    when v_pending_review > 0 then 'review'::public.import_job_status
    when v_failed = v_expected_total then 'failed'::public.import_job_status
    when v_failed > 0 then 'partial_failed'::public.import_job_status
    else 'completed'::public.import_job_status
  end;

  update public.import_jobs
  set
    total_items = v_expected_total,
    successful_items = v_successful,
    failed_items = v_failed,
    status = v_next_status,
    started_at = case
      when v_next_status = 'processing' then coalesce(started_at, now())
      else started_at
    end,
    completed_at = case
      when v_next_status in ('completed', 'partial_failed', 'failed')
        then coalesce(completed_at, now())
      else null
    end
  where id = p_job_id;
end;
$$;

create function public.refresh_import_job_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.import_job_id is distinct from new.import_job_id then
    perform public.recalculate_import_job_counts(old.import_job_id);
  end if;

  if tg_op = 'DELETE' then
    perform public.recalculate_import_job_counts(old.import_job_id);
    return old;
  end if;

  perform public.recalculate_import_job_counts(new.import_job_id);
  return new;
end;
$$;

create trigger import_items_refresh_job_counts
after insert or update or delete on public.import_items
for each row execute function public.refresh_import_job_counts();

revoke all on function public.recalculate_import_job_counts(uuid) from public;
revoke all on function public.refresh_import_job_counts() from public;

alter table public.import_jobs enable row level security;
alter table public.import_items enable row level security;

create policy import_jobs_admin_select
on public.import_jobs
for select
to authenticated
using ((select public.is_admin()));

create policy import_jobs_admin_insert
on public.import_jobs
for insert
to authenticated
with check (
  (select public.is_admin())
  and created_by = auth.uid()
);

create policy import_jobs_admin_update
on public.import_jobs
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy import_items_admin_select
on public.import_items
for select
to authenticated
using ((select public.is_admin()));

create policy import_items_admin_insert
on public.import_items
for insert
to authenticated
with check ((select public.is_admin()));

create policy import_items_admin_update
on public.import_items
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on public.import_jobs, public.import_items from anon;
grant select, insert, update on public.import_jobs, public.import_items to authenticated;
