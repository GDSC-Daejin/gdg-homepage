-- 면접 취소·변경·참석·노쇼 관리

alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('waiting', 'pending', 'accepted', 'rejected', 'no_show')),
  add column interview_change_count int not null default 0
    check (interview_change_count >= 0);

alter table public.interview_slots
  add column interview_result text
    check (interview_result is null or interview_result in ('attended', 'no_show'));

create table public.interview_booking_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  slot_id uuid not null references public.interview_slots(id) on delete cascade,
  new_slot_id uuid references public.interview_slots(id) on delete set null,
  action text not null check (action in (
    'booked', 'rescheduled', 'canceled_by_applicant', 'canceled_by_admin',
    'attended', 'no_show'
  )),
  actor_type text not null check (actor_type in ('applicant', 'admin', 'system')),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index interview_booking_events_application
  on public.interview_booking_events (application_id, created_at desc);

alter table public.interview_booking_events enable row level security;
create policy "interview_booking_events: admin read"
  on public.interview_booking_events for select using (public.is_admin());

-- 지원자 화면에서 현재 예약과 변경 가능 여부를 함께 보여준다.
create or replace function public.get_interview_context(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_app applications%rowtype;
  v_booked jsonb;
  v_open jsonb;
begin
  select * into v_app from applications where interview_token = p_token;
  if v_app.id is null then raise exception 'INVALID_TOKEN'; end if;

  select jsonb_build_object(
    'id', s.id,
    'starts_at', s.starts_at,
    'duration_min', s.duration_min,
    'meet_uri', s.meet_uri,
    'interview_result', s.interview_result,
    'can_cancel', v_app.status = 'pending'
      and s.starts_at > now() + interval '24 hours',
    'can_reschedule', v_app.status = 'pending'
      and s.starts_at > now() + interval '24 hours'
      and v_app.interview_change_count < 1
  ) into v_booked
    from interview_slots s
    where s.application_id = v_app.id and s.status = 'booked';

  select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at), '[]'::jsonb) into v_open
    from (
      select id, starts_at, duration_min
      from interview_slots
      where season = v_app.season and status = 'open' and starts_at > now()
    ) s;

  return jsonb_build_object(
    'application_id', v_app.id,
    'applicant_name', v_app.applicant_name,
    'season', v_app.season,
    'booked_slot', v_booked,
    'open_slots', v_open,
    'can_book', v_app.status = 'pending' and v_app.interview_change_count < 1
  );
end $$;

-- 지원자의 최초 예약 또는 취소 후 1회 재예약.
create or replace function public.book_interview_slot(p_token uuid, p_slot uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_app applications%rowtype;
  v_slot interview_slots%rowtype;
  v_had_cancel boolean;
  v_action text := 'booked';
begin
  select * into v_app from applications where interview_token = p_token for update;
  if v_app.id is null or v_app.status <> 'pending' then raise exception 'INVALID_TOKEN'; end if;
  if exists (select 1 from interview_slots where application_id = v_app.id and status = 'booked') then
    raise exception 'ALREADY_BOOKED';
  end if;

  select exists (
    select 1 from interview_booking_events
    where application_id = v_app.id and action = 'canceled_by_applicant'
  ) into v_had_cancel;
  if v_had_cancel then
    if v_app.interview_change_count >= 1 then raise exception 'CHANGE_LIMIT'; end if;
    v_action := 'rescheduled';
  end if;

  select * into v_slot from interview_slots where id = p_slot for update;
  if v_slot.id is null or v_slot.status <> 'open'
     or v_slot.season <> v_app.season or v_slot.starts_at <= now() then
    raise exception 'SLOT_TAKEN';
  end if;

  update interview_slots
    set application_id = v_app.id, status = 'booked', interview_result = null, updated_at = now()
    where id = v_slot.id;

  if v_had_cancel then
    update applications
      set interview_change_count = interview_change_count + 1
      where id = v_app.id;
  end if;

  insert into interview_booking_events (application_id, slot_id, action, actor_type)
  values (v_app.id, v_slot.id, v_action, 'applicant');
  return v_slot.id;
exception
  when unique_violation then raise exception 'ALREADY_BOOKED';
end $$;

-- 지원자 취소: 24시간 전까지만 가능하며 슬롯은 다시 연다.
create or replace function public.cancel_interview_booking(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_app applications%rowtype;
  v_slot interview_slots%rowtype;
begin
  select * into v_app from applications where interview_token = p_token for update;
  if v_app.id is null or v_app.status <> 'pending' then raise exception 'INVALID_TOKEN'; end if;
  select * into v_slot from interview_slots
    where application_id = v_app.id and status = 'booked' for update;
  if v_slot.id is null then raise exception 'NOT_BOOKED'; end if;
  if v_slot.starts_at <= now() + interval '24 hours' then raise exception 'CANCEL_DEADLINE'; end if;

  update interview_slots
    set application_id = null, status = 'open', meet_uri = null, meet_code = null,
        calendar_event_id = null, interview_result = null, updated_at = now()
    where id = v_slot.id;
  insert into interview_booking_events (application_id, slot_id, action, actor_type)
  values (v_app.id, v_slot.id, 'canceled_by_applicant', 'applicant');

  return jsonb_build_object(
    'application_id', v_app.id,
    'slot_id', v_slot.id,
    'calendar_event_id', v_slot.calendar_event_id,
    'starts_at', v_slot.starts_at,
    'email', v_app.email,
    'applicant_name', v_app.applicant_name
  );
end $$;

-- 지원자 변경: 기존 예약은 유지한 채 새 슬롯을 먼저 확보한다.
create or replace function public.reschedule_interview_booking(p_token uuid, p_new_slot uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_app applications%rowtype;
  v_old interview_slots%rowtype;
  v_new interview_slots%rowtype;
begin
  select * into v_app from applications where interview_token = p_token for update;
  if v_app.id is null or v_app.status <> 'pending' then raise exception 'INVALID_TOKEN'; end if;
  if v_app.interview_change_count >= 1 then raise exception 'CHANGE_LIMIT'; end if;
  select * into v_old from interview_slots
    where application_id = v_app.id and status = 'booked' for update;
  if v_old.id is null then raise exception 'NOT_BOOKED'; end if;
  if v_old.starts_at <= now() + interval '24 hours' then raise exception 'CHANGE_DEADLINE'; end if;

  select * into v_new from interview_slots where id = p_new_slot for update;
  if v_new.id is null or v_new.id = v_old.id or v_new.status <> 'open'
     or v_new.season <> v_app.season or v_new.starts_at <= now() then
    raise exception 'SLOT_TAKEN';
  end if;

  update interview_slots
    set application_id = null, status = 'open', meet_uri = null, meet_code = null,
        calendar_event_id = null, interview_result = null, updated_at = now()
    where id = v_old.id;
  update interview_slots
    set application_id = v_app.id, interviewer_id = v_old.interviewer_id,
        status = 'booked', interview_result = null, updated_at = now()
    where id = v_new.id;
  update applications
    set interview_change_count = interview_change_count + 1
    where id = v_app.id;
  insert into interview_booking_events (application_id, slot_id, new_slot_id, action, actor_type)
  values (v_app.id, v_old.id, v_new.id, 'rescheduled', 'applicant');

  return jsonb_build_object(
    'application_id', v_app.id,
    'old_slot_id', v_old.id,
    'old_calendar_event_id', v_old.calendar_event_id,
    'new_slot_id', v_new.id,
    'starts_at', v_new.starts_at,
    'email', v_app.email,
    'applicant_name', v_app.applicant_name
  );
end $$;

create or replace function public.admin_cancel_interview_booking(p_slot uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_slot interview_slots%rowtype;
  v_app applications%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_slot from interview_slots where id = p_slot and status = 'booked' for update;
  if v_slot.id is null then raise exception 'NOT_BOOKED'; end if;
  select * into v_app from applications where id = v_slot.application_id;

  update interview_slots
    set application_id = null, status = 'open', meet_uri = null, meet_code = null,
        calendar_event_id = null, interview_result = null, updated_at = now()
    where id = v_slot.id;
  insert into interview_booking_events (application_id, slot_id, action, actor_type, actor_id)
  values (v_app.id, v_slot.id, 'canceled_by_admin', 'admin', auth.uid());

  return jsonb_build_object(
    'application_id', v_app.id,
    'slot_id', v_slot.id,
    'calendar_event_id', v_slot.calendar_event_id,
    'starts_at', v_slot.starts_at,
    'email', v_app.email,
    'applicant_name', v_app.applicant_name
  );
end $$;

create or replace function public.admin_reschedule_interview_booking(p_slot uuid, p_new_slot uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_old interview_slots%rowtype;
  v_new interview_slots%rowtype;
  v_app applications%rowtype;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_old from interview_slots where id = p_slot and status = 'booked' for update;
  if v_old.id is null then raise exception 'NOT_BOOKED'; end if;
  select * into v_new from interview_slots where id = p_new_slot for update;
  if v_new.id is null or v_new.id = v_old.id or v_new.status <> 'open'
     or v_new.season <> v_old.season or v_new.starts_at <= now() then
    raise exception 'SLOT_TAKEN';
  end if;
  select * into v_app from applications where id = v_old.application_id;

  update interview_slots
    set application_id = null, status = 'open', meet_uri = null, meet_code = null,
        calendar_event_id = null, interview_result = null, updated_at = now()
    where id = v_old.id;
  update interview_slots
    set application_id = v_old.application_id, interviewer_id = v_old.interviewer_id,
        status = 'booked', interview_result = null, updated_at = now()
    where id = v_new.id;
  insert into interview_booking_events (application_id, slot_id, new_slot_id, action, actor_type, actor_id)
  values (v_app.id, v_old.id, v_new.id, 'rescheduled', 'admin', auth.uid());

  return jsonb_build_object(
    'application_id', v_app.id,
    'old_slot_id', v_old.id,
    'old_calendar_event_id', v_old.calendar_event_id,
    'new_slot_id', v_new.id,
    'starts_at', v_new.starts_at,
    'email', v_app.email,
    'applicant_name', v_app.applicant_name
  );
end $$;

create or replace function public.admin_mark_interview_outcome(p_slot uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_slot interview_slots%rowtype;
  v_app_status text;
  v_action text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_result not in ('attended', 'no_show') then raise exception 'INVALID_OUTCOME'; end if;
  select * into v_slot from interview_slots where id = p_slot and status = 'booked' for update;
  if v_slot.id is null then raise exception 'NOT_BOOKED'; end if;
  if v_slot.starts_at > now() then raise exception 'INTERVIEW_NOT_STARTED'; end if;
  select status into v_app_status from applications where id = v_slot.application_id;
  if p_result = 'no_show' and v_app_status <> 'pending' then raise exception 'INVALID_INPUT'; end if;

  v_action := p_result;
  update interview_slots
    set status = 'completed', interview_result = p_result, updated_at = now()
    where id = v_slot.id;
  insert into interview_booking_events (application_id, slot_id, action, actor_type, actor_id)
  values (v_slot.application_id, v_slot.id, v_action, 'admin', auth.uid());

  if p_result = 'no_show' then
    update applications
      set status = 'no_show', reviewed_by = auth.uid(), reviewed_at = now()
      where id = v_slot.application_id;
  end if;
end $$;

revoke execute on function public.cancel_interview_booking(uuid) from public;
revoke execute on function public.reschedule_interview_booking(uuid, uuid) from public;
revoke execute on function public.admin_cancel_interview_booking(uuid) from public, anon;
revoke execute on function public.admin_reschedule_interview_booking(uuid, uuid) from public, anon;
revoke execute on function public.admin_mark_interview_outcome(uuid, text) from public, anon;
grant execute on function public.cancel_interview_booking(uuid) to anon, authenticated;
grant execute on function public.reschedule_interview_booking(uuid, uuid) to anon, authenticated;
grant execute on function public.admin_cancel_interview_booking(uuid) to authenticated;
grant execute on function public.admin_reschedule_interview_booking(uuid, uuid) to authenticated;
grant execute on function public.admin_mark_interview_outcome(uuid, text) to authenticated;
