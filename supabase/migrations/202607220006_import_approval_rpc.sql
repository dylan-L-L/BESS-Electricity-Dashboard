-- Atomic human approval for GL-MVP-002 import candidates.
-- Approval writes an unpublished formal record and the audit link in one
-- transaction. It never publishes AI output directly.

create function public.guard_import_item_approval()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trusted_writer boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
  v_bind_rejection boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.review_status = 'approved' and not v_trusted_writer then
      raise exception 'Use approve_import_item() to approve an import item'
        using errcode = '42501';
    end if;
    v_bind_rejection := new.review_status = 'rejected';
  else
    if old.review_status in ('approved', 'rejected') and not v_trusted_writer then
      raise exception 'Reviewed import items are immutable'
        using errcode = '42501';
    end if;

    if new.review_status = 'approved'
      and old.review_status is distinct from 'approved'
      and not v_trusted_writer
    then
      raise exception 'Use approve_import_item() to approve an import item'
        using errcode = '42501';
    end if;
    v_bind_rejection := new.review_status = 'rejected'
      and old.review_status is distinct from 'rejected';
  end if;

  if v_bind_rejection and auth.uid() is not null then
    if not public.is_admin() then
      raise exception 'Only an administrator can reject an import item'
        using errcode = '42501';
    end if;
    new.reviewed_by = auth.uid();
    new.reviewed_at = now();
  end if;

  return new;
end;
$$;

create trigger import_items_guard_approval
before insert or update on public.import_items
for each row execute function public.guard_import_item_approval();

create function public.approve_import_item(
  p_item_id uuid,
  p_target_type public.import_target_type,
  p_draft_data jsonb,
  p_reviewer_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.import_items%rowtype;
  v_input_type public.import_input_type;
  v_region_id uuid;
  v_signal_type text;
  v_title text;
  v_summary text;
  v_source_url text;
  v_normalized_status_text text;
  v_normalized_status public.normalized_status;
  v_event_date_text text;
  v_effective_date_text text;
  v_event_date date;
  v_effective_date date;
  v_metric_key text;
  v_metric_label text;
  v_metric_unit text;
  v_metric_value numeric;
  v_metric_as_of_text text;
  v_metric_as_of_date date;
  v_record_id uuid;
  v_has_required_evidence boolean;
  v_field_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator authentication required'
      using errcode = '42501';
  end if;

  select *
  into v_item
  from public.import_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Import item not found'
      using errcode = 'P0002';
  end if;

  -- Repeated clicks are safe and return the record created by the first commit.
  if v_item.review_status = 'approved' then
    return jsonb_build_object(
      'import_item_id', v_item.id,
      'target_type', v_item.target_type,
      'record_id', v_item.approved_record_id,
      'already_approved', true
    );
  end if;

  if v_item.review_status <> 'pending_review' then
    raise exception 'Import item is not pending review'
      using errcode = '55000';
  end if;

  if p_target_type is null or p_target_type not in ('signal', 'market_metric') then
    raise exception 'Approval target must be signal or market_metric'
      using errcode = '22023';
  end if;

  if p_draft_data is null or jsonb_typeof(p_draft_data) <> 'object' then
    raise exception 'Approved draft_data must be a JSON object'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_reviewer_note), '') is null then
    raise exception 'Human reviewer note is required'
      using errcode = '22023';
  end if;

  select input_type
  into v_input_type
  from public.import_jobs
  where id = v_item.import_job_id;

  if not found then
    raise exception 'Import job not found'
      using errcode = 'P0002';
  end if;

  if jsonb_array_length(v_item.evidence) = 0 then
    raise exception 'At least one evidence record is required'
      using errcode = '22023';
  end if;

  if v_input_type = 'pdf' then
    select exists (
      select 1
      from jsonb_array_elements(v_item.evidence) as evidence_entry(value)
      where jsonb_typeof(value) = 'object'
        and jsonb_typeof(value -> 'page') = 'number'
        and (value ->> 'page')::numeric >= 1
        and (value ->> 'page')::numeric = trunc((value ->> 'page')::numeric)
    )
    into v_has_required_evidence;

    if not v_has_required_evidence then
      raise exception 'PDF approval requires evidence with a positive page number'
        using errcode = '22023';
    end if;
  elsif v_input_type = 'excel' then
    if nullif(btrim(v_item.sheet_name), '') is null
      or v_item.source_row_number is null
      or v_item.source_row_number <= 0
    then
      raise exception 'Excel approval requires worksheet name and original row number'
        using errcode = '22023';
    end if;

    select exists (
      select 1
      from jsonb_array_elements(v_item.evidence) as evidence_entry(value)
      where jsonb_typeof(value) = 'object'
        and value ->> 'sheet' = v_item.sheet_name
        and jsonb_typeof(value -> 'row') = 'number'
        and (value ->> 'row')::numeric = v_item.source_row_number
    )
    into v_has_required_evidence;

    if not v_has_required_evidence then
      raise exception 'Excel approval evidence must match the worksheet and original row number'
        using errcode = '22023';
    end if;
  end if;

  if jsonb_typeof(p_draft_data -> 'region_id') is distinct from 'string' then
    raise exception 'region_id must be a UUID string'
      using errcode = '22023';
  end if;

  select id
  into v_region_id
  from public.regions
  where id::text = nullif(btrim(p_draft_data ->> 'region_id'), '');

  if v_region_id is null then
    raise exception 'A valid region_id is required'
      using errcode = '23503';
  end if;

  if p_target_type = 'signal' then
    foreach v_field_name in array array[
      'title',
      'summary',
      'source_url',
      'normalized_status'
    ]
    loop
      if jsonb_typeof(p_draft_data -> v_field_name) is distinct from 'string' then
        raise exception 'Signal field % must be a string', v_field_name
          using errcode = '22023';
      end if;
    end loop;

    foreach v_field_name in array array[
      'signal_type',
      'category',
      'original_status',
      'event_date',
      'effective_date',
      'impact_channel',
      'impact_direction',
      'impact_level',
      'source_name'
    ]
    loop
      if p_draft_data ? v_field_name
        and p_draft_data -> v_field_name <> 'null'::jsonb
        and jsonb_typeof(p_draft_data -> v_field_name) <> 'string'
      then
        raise exception 'Signal field % must be a string or null', v_field_name
          using errcode = '22023';
      end if;
    end loop;

    v_signal_type := coalesce(
      nullif(btrim(p_draft_data ->> 'signal_type'), ''),
      'policy'
    );
    if v_signal_type not in ('policy', 'market') then
      raise exception 'signal_type must be policy or market'
        using errcode = '22023';
    end if;

    v_title := nullif(btrim(p_draft_data ->> 'title'), '');
    if v_title is null then
      raise exception 'Signal title is required'
        using errcode = '22023';
    end if;

    v_summary := nullif(btrim(p_draft_data ->> 'summary'), '');
    if v_summary is null then
      raise exception 'Signal summary is required'
        using errcode = '22023';
    end if;

    v_source_url := nullif(btrim(p_draft_data ->> 'source_url'), '');
    if v_source_url is null or v_source_url !~* '^https?://[^[:space:]]+$' then
      raise exception 'Signal source_url must use HTTP or HTTPS'
        using errcode = '22023';
    end if;

    v_normalized_status_text := nullif(
      btrim(p_draft_data ->> 'normalized_status'),
      ''
    );
    if v_normalized_status_text is null
      or v_normalized_status_text not in (
        'draft',
        'consultation',
        'filed',
        'approved',
        'effective',
        'suspended',
        'other'
      )
    then
      raise exception 'Signal normalized_status is invalid'
        using errcode = '22023';
    end if;
    v_normalized_status := v_normalized_status_text::public.normalized_status;

    v_event_date_text := nullif(btrim(p_draft_data ->> 'event_date'), '');
    if v_event_date_text is not null then
      if v_event_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'event_date must use YYYY-MM-DD'
          using errcode = '22023';
      end if;
      begin
        v_event_date := v_event_date_text::date;
      exception when others then
        raise exception 'event_date is not a valid calendar date'
          using errcode = '22023';
      end;
    end if;

    v_effective_date_text := nullif(btrim(p_draft_data ->> 'effective_date'), '');
    if v_effective_date_text is not null then
      if v_effective_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'effective_date must use YYYY-MM-DD'
          using errcode = '22023';
      end if;
      begin
        v_effective_date := v_effective_date_text::date;
      exception when others then
        raise exception 'effective_date is not a valid calendar date'
          using errcode = '22023';
      end;
    end if;

    insert into public.signals (
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
      reviewer_id,
      reviewed_at,
      created_by,
      is_demo
    )
    values (
      v_region_id,
      v_signal_type,
      v_title,
      v_summary,
      nullif(btrim(p_draft_data ->> 'category'), ''),
      nullif(btrim(p_draft_data ->> 'original_status'), ''),
      v_normalized_status,
      v_event_date,
      v_effective_date,
      nullif(btrim(p_draft_data ->> 'impact_channel'), ''),
      nullif(btrim(p_draft_data ->> 'impact_direction'), ''),
      nullif(btrim(p_draft_data ->> 'impact_level'), ''),
      v_source_url,
      nullif(btrim(p_draft_data ->> 'source_name'), ''),
      null,
      'pending_review',
      null,
      null,
      null,
      auth.uid(),
      false
    )
    returning id into v_record_id;

    update public.import_items
    set
      target_type = 'signal',
      draft_data = p_draft_data,
      review_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reviewer_note = btrim(p_reviewer_note),
      approved_signal_id = v_record_id,
      approved_market_metric_id = null
    where id = v_item.id;
  else
    foreach v_field_name in array array['metric_key', 'label', 'unit']
    loop
      if jsonb_typeof(p_draft_data -> v_field_name) is distinct from 'string' then
        raise exception 'Market metric field % must be a string', v_field_name
          using errcode = '22023';
      end if;
    end loop;

    foreach v_field_name in array array[
      'period_label',
      'as_of_date',
      'source_url',
      'source_name',
      'notes'
    ]
    loop
      if p_draft_data ? v_field_name
        and p_draft_data -> v_field_name <> 'null'::jsonb
        and jsonb_typeof(p_draft_data -> v_field_name) <> 'string'
      then
        raise exception 'Market metric field % must be a string or null', v_field_name
          using errcode = '22023';
      end if;
    end loop;

    v_metric_key := nullif(btrim(p_draft_data ->> 'metric_key'), '');
    if v_metric_key is null then
      raise exception 'Market metric metric_key is required'
        using errcode = '22023';
    end if;

    v_metric_label := nullif(btrim(p_draft_data ->> 'label'), '');
    if v_metric_label is null then
      raise exception 'Market metric label is required'
        using errcode = '22023';
    end if;

    if jsonb_typeof(p_draft_data -> 'value') is distinct from 'number' then
      raise exception 'Market metric value must be a number and cannot be inferred from null'
        using errcode = '22023';
    end if;
    v_metric_value := (p_draft_data ->> 'value')::numeric;

    v_metric_unit := nullif(btrim(p_draft_data ->> 'unit'), '');
    if v_metric_unit is null then
      raise exception 'Market metric unit is required'
        using errcode = '22023';
    end if;

    v_source_url := nullif(btrim(p_draft_data ->> 'source_url'), '');
    if v_source_url is not null and v_source_url !~* '^https?://[^[:space:]]+$' then
      raise exception 'Market metric source_url must use HTTP or HTTPS when provided'
        using errcode = '22023';
    end if;

    v_metric_as_of_text := nullif(btrim(p_draft_data ->> 'as_of_date'), '');
    if v_metric_as_of_text is not null then
      if v_metric_as_of_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'as_of_date must use YYYY-MM-DD'
          using errcode = '22023';
      end if;
      begin
        v_metric_as_of_date := v_metric_as_of_text::date;
      exception when others then
        raise exception 'as_of_date is not a valid calendar date'
          using errcode = '22023';
      end;
    end if;

    insert into public.market_metrics (
      region_id,
      metric_key,
      label,
      value,
      unit,
      period_label,
      as_of_date,
      source_url,
      source_name,
      notes,
      is_demo,
      is_published
    )
    values (
      v_region_id,
      v_metric_key,
      v_metric_label,
      v_metric_value,
      v_metric_unit,
      nullif(btrim(p_draft_data ->> 'period_label'), ''),
      v_metric_as_of_date,
      v_source_url,
      nullif(btrim(p_draft_data ->> 'source_name'), ''),
      nullif(btrim(p_draft_data ->> 'notes'), ''),
      false,
      false
    )
    returning id into v_record_id;

    update public.import_items
    set
      target_type = 'market_metric',
      draft_data = p_draft_data,
      review_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reviewer_note = btrim(p_reviewer_note),
      approved_signal_id = null,
      approved_market_metric_id = v_record_id
    where id = v_item.id;
  end if;

  return jsonb_build_object(
    'import_item_id', v_item.id,
    'target_type', p_target_type,
    'record_id', v_record_id,
    'already_approved', false
  );
end;
$$;

comment on function public.approve_import_item(uuid, public.import_target_type, jsonb, text) is
  'Admin-only atomic approval. Creates a pending Signal or unpublished Market Metric and records type-safe provenance.';

revoke all on function public.guard_import_item_approval() from public;
revoke all on function public.approve_import_item(uuid, public.import_target_type, jsonb, text) from public, anon;
grant execute on function public.approve_import_item(uuid, public.import_target_type, jsonb, text) to authenticated;
