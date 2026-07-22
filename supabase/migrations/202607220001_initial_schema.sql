-- Grid Ledger immediate MVP schema.
-- The public read surface is enforced in the database through row-level security.

create type public.region_type as enum (
  'global',
  'country',
  'province'
);

create type public.review_status as enum (
  'ai_draft',
  'pending_review',
  'published',
  'rejected'
);

create type public.normalized_status as enum (
  'draft',
  'consultation',
  'filed',
  'approved',
  'effective',
  'suspended',
  'other'
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  code text,
  name_zh text not null,
  name_en text,
  region_type public.region_type not null,
  parent_id uuid references public.regions(id) on update cascade on delete restrict,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regions_slug_not_blank check (btrim(slug) <> ''),
  constraint regions_name_zh_not_blank check (btrim(name_zh) <> ''),
  constraint regions_global_has_no_parent check (
    region_type <> 'global' or parent_id is null
  ),
  constraint regions_not_own_parent check (parent_id is null or parent_id <> id)
);

create unique index regions_code_unique
  on public.regions (code)
  where code is not null;

create index regions_parent_id_idx on public.regions (parent_id);
create index regions_type_idx on public.regions (region_type);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.regions(id) on update cascade on delete restrict,
  signal_type text not null default 'policy',
  title text,
  summary text,
  category text,
  original_status text,
  normalized_status public.normalized_status,
  event_date date,
  effective_date date,
  impact_channel text,
  impact_direction text,
  impact_level text,
  source_url text,
  source_name text,
  reviewer_note text,
  review_status public.review_status not null default 'pending_review',
  published_at timestamptz,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_by uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signals_signal_type_not_blank check (btrim(signal_type) <> ''),
  constraint signals_published_fields_required check (
    review_status <> 'published'
    or (
      region_id is not null
      and nullif(btrim(title), '') is not null
      and nullif(btrim(summary), '') is not null
      and nullif(btrim(source_url), '') is not null
      and normalized_status is not null
      and nullif(btrim(reviewer_note), '') is not null
      and reviewer_id is not null
      and reviewed_at is not null
      and published_at is not null
    )
  ),
  constraint signals_published_source_is_http check (
    review_status <> 'published'
    or source_url ~* '^https?://'
  )
);

comment on column public.signals.reviewer_id is
  'Auth user UUID in normal operation. Demo seed values use a fixed non-auth UUID and are explicitly labelled DEMO.';
comment on column public.signals.created_by is
  'Auth user UUID when available; intentionally not a foreign key so local/demo seed data does not create fake auth users.';

create index signals_region_id_idx on public.signals (region_id);
create index signals_public_feed_idx
  on public.signals (region_id, published_at desc)
  where review_status = 'published';
create index signals_review_queue_idx
  on public.signals (review_status, updated_at desc);
create index signals_normalized_status_idx on public.signals (normalized_status);

create table public.market_metrics (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on update cascade on delete restrict,
  metric_key text not null,
  label text not null,
  value numeric,
  unit text,
  period_label text,
  as_of_date date,
  source_url text,
  source_name text,
  notes text,
  is_demo boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_metrics_key_not_blank check (btrim(metric_key) <> ''),
  constraint market_metrics_label_not_blank check (btrim(label) <> '')
);

comment on column public.market_metrics.value is
  'Nullable by design. Missing or unavailable data must remain NULL and must never be coerced to zero.';

create index market_metrics_region_id_idx on public.market_metrics (region_id);
create index market_metrics_public_idx
  on public.market_metrics (region_id, metric_key, as_of_date desc)
  where is_published = true;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger regions_set_updated_at
before update on public.regions
for each row execute function public.set_updated_at();

create trigger signals_set_updated_at
before update on public.signals
for each row execute function public.set_updated_at();

create trigger market_metrics_set_updated_at
before update on public.market_metrics
for each row execute function public.set_updated_at();

create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

comment on function public.is_admin() is
  'Authorization helper. Admin status is trusted only from JWT app_metadata, never user-editable user_metadata.';

create function public.bind_signal_reviewer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.review_status = 'published' then
    if auth.uid() is not null then
      if not public.is_admin() then
        raise exception 'Only an administrator can publish a signal'
          using errcode = '42501';
      end if;

      -- Never trust reviewer identity or timestamps supplied by a client.
      new.reviewer_id = auth.uid();
      new.reviewed_at = now();
      if tg_op = 'INSERT' then
        new.published_at = now();
      elsif old.review_status <> 'published' then
        new.published_at = now();
      else
        new.published_at = coalesce(old.published_at, now());
      end if;
    elsif current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception 'Published signals require an authenticated reviewer'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.bind_signal_reviewer() is
  'Binds published reviewer identity and review time to the authenticated admin; trusted seed/service roles retain explicit fixture values.';

create trigger signals_bind_reviewer
before insert or update on public.signals
for each row execute function public.bind_signal_reviewer();

alter table public.regions enable row level security;
alter table public.signals enable row level security;
alter table public.market_metrics enable row level security;

create policy regions_public_read
on public.regions
for select
to anon, authenticated
using (true);

create policy regions_admin_write
on public.regions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy signals_published_read
on public.signals
for select
to anon, authenticated
using (
  review_status = 'published'
  and published_at is not null
);

create policy signals_admin_all
on public.signals
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy market_metrics_public_read
on public.market_metrics
for select
to anon, authenticated
using (is_published = true);

create policy market_metrics_admin_all
on public.market_metrics
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.regions, public.market_metrics to anon, authenticated;
grant select (
  id,
  region_id,
  signal_type,
  title,
  summary,
  category,
  original_status,
  normalized_status,
  event_date,
  effective_date,
  impact_channel,
  impact_direction,
  impact_level,
  source_url,
  source_name,
  reviewer_note,
  review_status,
  published_at,
  is_demo,
  created_at,
  updated_at
) on public.signals to anon;
grant select on public.signals to authenticated;
grant insert, update, delete on public.regions, public.signals, public.market_metrics to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
