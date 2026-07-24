-- China provincial seven-topic ledger.
--
-- This is intentionally separate from signals (events) and market_metrics
-- (generic numeric observations). A record is the reviewed province/topic
-- publication unit; its child rows are the field cards shown by the public
-- atlas, including explicit missing-data and evidence states.

create type public.province_topic_id as enum (
  'trading-rules',
  'storage-capacity-compensation',
  'ancillary-services',
  'fourth-regulatory-cycle-grid-cost',
  'storage-operating-costs',
  'green-power-direct-connection',
  'retail-rules'
);

create type public.province_topic_legal_status as enum (
  'draft',
  'consultation',
  'published',
  'effective',
  'suspended',
  'superseded',
  'other'
);

create type public.province_topic_operational_status as enum (
  'not_started',
  'simulation',
  'trial',
  'continuous',
  'suspended',
  'unknown'
);

create type public.province_topic_field_coverage_status as enum (
  'available',
  'not_covered',
  'not_published',
  'not_applicable',
  'stale',
  'conflicting'
);

create table public.china_province_topic_records (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on update cascade on delete restrict,
  topic_id public.province_topic_id not null,
  title text,
  summary text,
  legal_status public.province_topic_legal_status,
  operational_status public.province_topic_operational_status,
  valid_from date,
  valid_to date,
  as_of_date date,
  source_url text,
  source_name text,
  source_published_at date,
  reviewer_note text,
  review_status public.review_status not null default 'pending_review',
  published_at timestamptz,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_by uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint china_province_topic_dates_valid check (
    valid_from is null or valid_to is null or valid_from <= valid_to
  ),
  constraint china_province_topic_published_fields_required check (
    review_status <> 'published'
    or (
      nullif(btrim(title), '') is not null
      and legal_status is not null
      and as_of_date is not null
      and nullif(btrim(source_url), '') is not null
      and nullif(btrim(source_name), '') is not null
      and nullif(btrim(reviewer_note), '') is not null
      and reviewer_id is not null
      and reviewed_at is not null
      and published_at is not null
    )
  ),
  constraint china_province_topic_published_source_is_http check (
    review_status <> 'published'
    or source_url ~* '^https?://'
  )
);

create table public.china_province_topic_fields (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.china_province_topic_records(id)
    on update cascade on delete cascade,
  field_key text not null,
  value_text text,
  value_numeric numeric,
  unit text,
  coverage_status public.province_topic_field_coverage_status not null
    default 'not_covered',
  applicability text,
  source_url text,
  source_name text,
  source_locator text,
  evidence_excerpt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint china_province_topic_field_key_not_blank check (
    btrim(field_key) <> ''
  ),
  constraint china_province_topic_field_sort_order_nonnegative check (
    sort_order >= 0
  ),
  constraint china_province_topic_field_available_requires_value check (
    coverage_status <> 'available'
    or nullif(btrim(value_text), '') is not null
  ),
  unique (record_id, field_key)
);

comment on table public.china_province_topic_records is
  'Reviewed publication snapshots for the China province x seven-topic atlas. Not a Signal or generic Metric.';
comment on column public.china_province_topic_fields.value_text is
  'Original display value. A real numeric zero is stored as 0; missing data remains NULL with an explicit coverage_status.';
comment on column public.china_province_topic_fields.source_locator is
  'Field-level evidence locator such as page, table, row/column, article section, or paragraph.';

create index china_province_topic_records_admin_idx
  on public.china_province_topic_records (review_status, updated_at desc);
create index china_province_topic_records_public_idx
  on public.china_province_topic_records (region_id, topic_id, published_at desc)
  where review_status = 'published' and published_at is not null;
create index china_province_topic_fields_record_idx
  on public.china_province_topic_fields (record_id, sort_order, field_key);

create trigger china_province_topic_records_set_updated_at
before update on public.china_province_topic_records
for each row execute function public.set_updated_at();

create trigger china_province_topic_fields_set_updated_at
before update on public.china_province_topic_fields
for each row execute function public.set_updated_at();

create function public.is_valid_china_province_topic_field(
  requested_topic public.province_topic_id,
  requested_field text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case requested_topic
    when 'trading-rules' then requested_field = any (array[
      'spot_day_ahead_rule',
      'spot_real_time_rule',
      'ancillary_trading_rule',
      'retail_trading_rule'
    ])
    when 'storage-capacity-compensation' then requested_field = any (array[
      'compensation_amount',
      'assessment_mechanism',
      'subsidy_duration',
      'equivalent_conversion_coefficient'
    ])
    when 'ancillary-services' then requested_field = any (array[
      'service_products',
      'storage_eligibility',
      'compensation_standard',
      'settlement_and_assessment'
    ])
    when 'fourth-regulatory-cycle-grid-cost' then requested_field = any (array[
      'grid_capacity_tariff',
      'grid_demand_tariff',
      'line_loss_rate',
      'voltage_scope_and_period'
    ])
    when 'storage-operating-costs' then requested_field = any (array[
      'cost_item',
      'cost_standard',
      'pricing_basis',
      'applicable_scope'
    ])
    when 'green-power-direct-connection' then requested_field = any (array[
      'policy_status',
      'eligible_projects',
      'approval_and_filing',
      'source_load_storage_requirements',
      'effective_date'
    ])
    when 'retail-rules' then requested_field = any (array[
      'retail_access_rule',
      'floating_upper_ratio',
      'floating_lower_ratio',
      'pricing_benchmark',
      'settlement_rule'
    ])
    else false
  end;
$$;

create function public.expected_china_province_topic_field_count(
  requested_topic public.province_topic_id
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case requested_topic
    when 'green-power-direct-connection' then 5
    when 'retail-rules' then 5
    else 4
  end;
$$;

create function public.validate_china_province_topic_field()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_topic public.province_topic_id;
begin
  select record.topic_id
    into parent_topic
    from public.china_province_topic_records as record
    where record.id = new.record_id;

  if parent_topic is null then
    raise exception 'Province topic parent record does not exist'
      using errcode = '23503';
  end if;

  if not public.is_valid_china_province_topic_field(parent_topic, new.field_key) then
    raise exception 'Field % does not belong to topic %', new.field_key, parent_topic
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger china_province_topic_fields_validate
before insert or update on public.china_province_topic_fields
for each row execute function public.validate_china_province_topic_field();

create function public.prepare_china_province_topic_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_china_province boolean;
  actual_field_count integer;
  expected_field_count integer;
  invalid_field_count integer;
begin
  select exists (
    select 1
      from public.regions as province
      join public.regions as country on country.id = province.parent_id
      where province.id = new.region_id
        and province.region_type = 'province'
        and country.region_type = 'country'
        and country.code = 'CN'
  ) into is_china_province;

  if not is_china_province then
    raise exception 'China province topic records require a province whose parent code is CN'
      using errcode = '23514';
  end if;

  if new.review_status = 'published' then
    if tg_op = 'INSERT' then
      raise exception 'Create the topic draft and its fields before publishing'
        using errcode = '23514';
    end if;

    select count(*)
      into actual_field_count
      from public.china_province_topic_fields
      where record_id = new.id;
    expected_field_count :=
      public.expected_china_province_topic_field_count(new.topic_id);

    if actual_field_count <> expected_field_count then
      raise exception 'Topic % requires % explicit field rows; found %',
        new.topic_id, expected_field_count, actual_field_count
        using errcode = '23514';
    end if;

    select count(*)
      into invalid_field_count
      from public.china_province_topic_fields
      where record_id = new.id
        and (
          not public.is_valid_china_province_topic_field(new.topic_id, field_key)
          or (
            coverage_status = 'available'
            and (
              nullif(btrim(value_text), '') is null
            )
          )
          or (
            (
              nullif(btrim(value_text), '') is not null
              or value_numeric is not null
            )
            and (
              source_url !~* '^https?://'
              or nullif(btrim(source_name), '') is null
              or nullif(btrim(source_locator), '') is null
            )
          )
        );

    if invalid_field_count > 0 then
      raise exception 'Topic fields are incomplete or do not have field-level evidence'
        using errcode = '23514';
    end if;

    if auth.uid() is not null then
      if not public.is_admin() then
        raise exception 'Only an administrator can publish a province topic record'
          using errcode = '42501';
      end if;

      new.reviewer_id = auth.uid();
      new.reviewed_at = now();
      if old.review_status <> 'published' then
        new.published_at = now();
      else
        new.published_at = coalesce(old.published_at, now());
      end if;
    elsif current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception 'Published province topic records require an authenticated reviewer'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger china_province_topic_records_prepare
before insert or update on public.china_province_topic_records
for each row execute function public.prepare_china_province_topic_record();

alter table public.china_province_topic_records enable row level security;
alter table public.china_province_topic_fields enable row level security;

create policy china_province_topic_records_public_read
on public.china_province_topic_records
for select
to anon, authenticated
using (
  review_status = 'published'
  and published_at is not null
);

create policy china_province_topic_records_admin_all
on public.china_province_topic_records
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy china_province_topic_fields_public_read
on public.china_province_topic_fields
for select
to anon, authenticated
using (
  exists (
    select 1
      from public.china_province_topic_records as record
      where record.id = record_id
        and record.review_status = 'published'
        and record.published_at is not null
  )
);

create policy china_province_topic_fields_admin_all
on public.china_province_topic_fields
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select (
  id,
  region_id,
  topic_id,
  title,
  summary,
  legal_status,
  operational_status,
  valid_from,
  valid_to,
  as_of_date,
  source_url,
  source_name,
  source_published_at,
  reviewer_note,
  review_status,
  published_at,
  reviewed_at,
  is_demo,
  created_at,
  updated_at
) on public.china_province_topic_records to anon;
grant select on public.china_province_topic_fields to anon;

grant select, insert, update, delete
  on public.china_province_topic_records, public.china_province_topic_fields
  to authenticated;
grant execute on function public.is_valid_china_province_topic_field(
  public.province_topic_id,
  text
) to anon, authenticated;
grant execute on function public.expected_china_province_topic_field_count(
  public.province_topic_id
) to anon, authenticated;
