-- 회원가입 승인 게이트: 신규 가입자는 Staff 승인 전까지 대기(approved_at is null)

-- 1) 승인 플래그 컬럼
alter table public.profiles
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null;

-- 2) 기존 회원 전원 grandfather (락아웃 방지 — 반드시)
update public.profiles set approved_at = joined_at where approved_at is null;

-- 3) 신규 가입 트리거: admin_emails → team_member + 자동승인, 그 외 → member + 대기
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  v_is_admin := exists (select 1 from admin_emails where lower(email) = lower(new.email));
  insert into public.profiles (id, name, role, approved_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when v_is_admin then 'team_member' else 'member' end,
    case when v_is_admin then now() else null end
  );
  return new;
end $$;

-- 4) is_member(): 승인 조건 추가 (board posts/comments RLS가 이걸 씀 → 한 곳에서 하드닝)
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid()
      and role in ('member','team_member','organizer')
      and approved_at is not null);
$$;

-- 5) broad-authenticated read 정책을 is_member()로 교체
drop policy "events: read all" on public.events;
create policy "events: read all" on public.events
  for select using (public.is_member());

drop policy "notices: read published" on public.notices;
create policy "notices: read published" on public.notices
  for select using (public.is_member() and (published or public.is_admin()));

drop policy "surveys: read" on public.surveys;
create policy "surveys: read" on public.surveys
  for select using (public.is_member());

drop policy "badges: read" on public.badges;
create policy "badges: read" on public.badges
  for select using (public.is_member());

drop policy "places: read all" on public.places;
create policy "places: read all" on public.places
  for select using (public.is_member());

drop policy "meetings: read" on public.meetings;
create policy "meetings: read" on public.meetings
  for select using (public.is_member());

drop policy "groups: member read" on public.groups;
create policy "groups: member read" on public.groups
  for select to authenticated using (public.is_member());

drop policy "group_members: member read" on public.group_members;
create policy "group_members: member read" on public.group_members
  for select to authenticated using (public.is_member());

-- 6) member write 하드닝
drop policy "responses: own insert" on public.survey_responses;
create policy "responses: own insert" on public.survey_responses
  for insert with check (
    user_id = auth.uid() and public.is_member()
    and exists (select 1 from public.surveys s where s.id = survey_id and s.is_open)
  );

drop policy "inquiries: own insert" on public.inquiries;
create policy "inquiries: own insert" on public.inquiries
  for insert with check (user_id = auth.uid() and public.is_member());

-- register_for_event: 승인 조건 추가 (나머지 로직 원문 유지)
create or replace function public.register_for_event(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_confirmed int;
  v_status text;
  v_role text;
  v_approved timestamptz;
begin
  select role, approved_at into v_role, v_approved
    from profiles where id = auth.uid() and status = 'active';
  if v_role is null or v_role = 'applicant' or v_approved is null then
    raise exception 'NOT_MEMBER';
  end if;
  select capacity into v_capacity from events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if exists (select 1 from event_registrations where event_id = p_event_id and user_id = auth.uid()) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  select count(*) into v_confirmed from event_registrations where event_id = p_event_id and status = 'confirmed';
  v_status := case when v_capacity is null or v_confirmed < v_capacity then 'confirmed' else 'waitlisted' end;
  insert into event_registrations (event_id, user_id, status) values (p_event_id, auth.uid(), v_status);
  return v_status;
end $$;

-- 7) 승인 RPC (Staff 전용)
create or replace function public.admin_approve_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update profiles set approved_at = now(), approved_by = auth.uid()
    where id = p_user and approved_at is null;
  perform public.log_audit('approve_member', p_user::text, '{}'::jsonb);
end $$;
revoke execute on function public.admin_approve_member(uuid) from public, anon;
grant execute on function public.admin_approve_member(uuid) to authenticated;

-- 8) 방어: staff로 승격되면 자동 승인 (admin_set_role 재정의 — 원문 + approved_at 보정)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('organizer', 'team_member', 'member', 'applicant') then
    raise exception 'INVALID_INPUT';
  end if;
  if p_role = 'organizer' and exists (
    select 1 from profiles where role = 'organizer' and id <> p_user
  ) then
    raise exception 'ORGANIZER_EXISTS';
  end if;
  update profiles set role = p_role where id = p_user;
  if p_role in ('team_member','organizer') then
    update profiles set approved_at = coalesce(approved_at, now()) where id = p_user;
  end if;
  perform public.log_audit('set_role', p_user::text, jsonb_build_object('role', p_role));
end $$;
