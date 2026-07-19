-- 면접 일정 시스템: interview_slots + applications.interview_token + RPC

-- 1) 매직링크 토큰
alter table public.applications
  add column interview_token uuid unique;

-- 2) 슬롯 테이블 (슬롯=예약 통합)
create table public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  starts_at timestamptz not null,
  duration_min int not null default 30 check (duration_min > 0),
  application_id uuid references public.applications(id) on delete set null,
  interviewer_id uuid references public.profiles(id) on delete set null,
  meet_uri text,
  meet_code text,
  status text not null default 'open'
    check (status in ('open', 'booked', 'completed', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_slots_season_status on public.interview_slots (season, status);
create index interview_slots_application on public.interview_slots (application_id);
create unique index interview_slots_one_per_application
  on public.interview_slots (application_id) where application_id is not null;

alter table public.interview_slots enable row level security;
create policy "interview_slots: admin read"
  on public.interview_slots for select using (public.is_admin());

-- 3) 어드민: 슬롯 일괄 생성
create or replace function public.admin_create_interview_slots(
  p_season text, p_starts_at timestamptz[], p_duration_min int
) returns void language plpgsql security definer set search_path = public as $$
declare v_ts timestamptz;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_season = '' or coalesce(array_length(p_starts_at, 1), 0) = 0
     or p_duration_min <= 0 then
    raise exception 'INVALID_INPUT';
  end if;
  foreach v_ts in array p_starts_at loop
    insert into interview_slots (season, starts_at, duration_min)
    values (p_season, v_ts, p_duration_min);
  end loop;
  perform public.log_audit('create_interview_slots', 'interview',
    jsonb_build_object('season', p_season, 'count', array_length(p_starts_at, 1)));
end $$;
revoke execute on function public.admin_create_interview_slots(text, timestamptz[], int) from public, anon;
grant execute on function public.admin_create_interview_slots(text, timestamptz[], int) to authenticated;

-- 4) 어드민: 면접관 배정
create or replace function public.admin_assign_interviewer(
  p_slot uuid, p_interviewer uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update interview_slots set interviewer_id = p_interviewer, updated_at = now()
    where id = p_slot;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('assign_interviewer', p_slot::text,
    jsonb_build_object('interviewer', p_interviewer));
end $$;
revoke execute on function public.admin_assign_interviewer(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_interviewer(uuid, uuid) to authenticated;

-- 5) 어드민: 면접 링크 토큰 발급 (선택 지원자에게, 없으면 생성)
create or replace function public.admin_send_interview_invites(
  p_application_ids uuid[]
) returns table(application_id uuid, token uuid, email text, applicant_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update applications a
    set interview_token = coalesce(a.interview_token, gen_random_uuid())
    where a.id = any(p_application_ids) and a.status = 'pending';
  perform public.log_audit('send_interview_invites', 'interview',
    jsonb_build_object('count', array_length(p_application_ids, 1)));
  return query
    select a.id, a.interview_token, a.email, a.applicant_name
    from applications a
    where a.id = any(p_application_ids)
      and a.status = 'pending'
      and a.interview_token is not null;
end $$;
revoke execute on function public.admin_send_interview_invites(uuid[]) from public, anon;
grant execute on function public.admin_send_interview_invites(uuid[]) to authenticated;

-- 6) 지원자: 면접 컨텍스트 조회 (익명, 토큰 기반)
create or replace function public.get_interview_context(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_app applications%rowtype;
  v_booked jsonb;
  v_open jsonb;
begin
  select * into v_app from applications where interview_token = p_token;
  if v_app.id is null then raise exception 'INVALID_TOKEN'; end if;

  select to_jsonb(s) into v_booked
    from (select id, starts_at, duration_min, meet_uri
          from interview_slots where application_id = v_app.id) s;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at), '[]'::jsonb) into v_open
    from (select id, starts_at, duration_min
          from interview_slots
          where season = v_app.season and status = 'open') s;

  return jsonb_build_object(
    'application_id', v_app.id,
    'applicant_name', v_app.applicant_name,
    'season', v_app.season,
    'booked_slot', v_booked,
    'open_slots', v_open
  );
end $$;
revoke execute on function public.get_interview_context(uuid) from public;
grant execute on function public.get_interview_context(uuid) to anon, authenticated;

-- 7) 지원자: 슬롯 원자적 예약 (익명)
create or replace function public.book_interview_slot(p_token uuid, p_slot uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_application uuid;
  v_season text;
  v_booked uuid;
begin
  select id, season into v_application, v_season
    from applications where interview_token = p_token;
  if v_application is null then raise exception 'INVALID_TOKEN'; end if;
  if exists (select 1 from interview_slots where application_id = v_application) then
    raise exception 'ALREADY_BOOKED';
  end if;
  update interview_slots
    set application_id = v_application, status = 'booked', updated_at = now()
    where id = p_slot and status = 'open' and season = v_season
    returning id into v_booked;
  if v_booked is null then raise exception 'SLOT_TAKEN'; end if;
  return v_booked;
exception
  when unique_violation then raise exception 'ALREADY_BOOKED';
end $$;
revoke execute on function public.book_interview_slot(uuid, uuid) from public;
grant execute on function public.book_interview_slot(uuid, uuid) to anon, authenticated;
