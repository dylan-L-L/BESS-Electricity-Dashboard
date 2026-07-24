-- Published topic fields are immutable. The application first returns the
-- parent record to pending_review before replacing child fields, so direct
-- table writes cannot silently change public conclusions after review.

create or replace function public.validate_china_province_topic_field()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_record_id uuid;
  parent_topic public.province_topic_id;
  parent_review_status public.review_status;
begin
  target_record_id := case
    when tg_op = 'DELETE' then old.record_id
    else new.record_id
  end;

  select record.topic_id, record.review_status
    into parent_topic, parent_review_status
    from public.china_province_topic_records as record
    where record.id = target_record_id;

  if parent_topic is null then
    raise exception 'Province topic parent record does not exist'
      using errcode = '23503';
  end if;

  if parent_review_status = 'published' then
    raise exception 'Published topic fields are immutable; save the parent as a draft first'
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE'
    and not public.is_valid_china_province_topic_field(parent_topic, new.field_key)
  then
    raise exception 'Field % does not belong to topic %', new.field_key, parent_topic
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists china_province_topic_fields_validate
  on public.china_province_topic_fields;

create trigger china_province_topic_fields_validate
before insert or update or delete on public.china_province_topic_fields
for each row execute function public.validate_china_province_topic_field();
