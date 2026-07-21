create extension if not exists pgcrypto;

create table public.attendance_attempts (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempts int not null default 0 check (attempts >= 0),
  last_attempt timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.attendance_attempts enable row level security;
revoke all on table public.attendance_attempts from anon, authenticated;

create or replace function public.check_attendance(p_event_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_attempts int;
  v_last_attempt timestamptz;
begin
  if not exists (
    select 1 from event_registrations
    where event_id = p_event_id and user_id = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'NOT_REGISTERED';
  end if;

  select attempts, last_attempt into v_attempts, v_last_attempt
  from attendance_attempts
  where event_id = p_event_id and user_id = auth.uid()
  for update;

  if found and v_attempts >= 5 and v_last_attempt > now() - interval '10 minutes' then
    raise exception 'TOO_MANY_ATTEMPTS';
  end if;

  if found and v_last_attempt <= now() - interval '10 minutes' then
    delete from public.attendance_attempts
    where event_id = p_event_id and user_id = auth.uid();
  end if;

  select code into v_code from event_codes where event_id = p_event_id;
  if v_code is null then raise exception 'NO_CODE_ISSUED'; end if;

  if v_code <> upper(trim(p_code)) then
    insert into attendance_attempts (event_id, user_id, attempts, last_attempt)
    values (p_event_id, auth.uid(), 1, now())
    on conflict (event_id, user_id) do update
      set attempts = public.attendance_attempts.attempts + 1,
          last_attempt = excluded.last_attempt;
    raise exception 'INVALID_CODE';
  end if;

  if exists (
    select 1 from attendances where event_id = p_event_id and user_id = auth.uid()
  ) then
    raise exception 'ALREADY_CHECKED';
  end if;

  insert into attendances (event_id, user_id) values (p_event_id, auth.uid());
  delete from public.attendance_attempts
  where event_id = p_event_id and user_id = auth.uid();
end $$;

create or replace function public.admin_set_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/', 'XY'), 1, 6));
  insert into event_codes (event_id, code) values (p_event_id, v_code)
    on conflict (event_id) do update set code = excluded.code, updated_at = now();
  perform public.log_audit('issue_code', p_event_id::text, '{}'::jsonb);
  return v_code;
end $$;
