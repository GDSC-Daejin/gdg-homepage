alter table public.events
  alter column starts_at drop not null,
  add column event_date date,
  add column start_time time,
  add column end_time time;

update public.events
set
  event_date = (starts_at at time zone 'Asia/Seoul')::date,
  start_time = (starts_at at time zone 'Asia/Seoul')::time,
  end_time = case when ends_at is null then null else (ends_at at time zone 'Asia/Seoul')::time end;
