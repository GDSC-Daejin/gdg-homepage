-- 테이블
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  student_no text not null default '',
  major text not null default '',
  phone text not null default '',
  interests text[] not null default '{}',
  role text not null default 'applicant' check (role in ('admin','member','applicant')),
  status text not null default 'active' check (status in ('active','dormant','withdrawn')),
  joined_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  season text not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (applicant_id, season)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('session','study','devfest')),
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  location text not null default '',
  speaker text not null default '',
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 출석 코드는 회원에게 숨겨야 하므로 별도 테이블 (admin RLS only)
create table public.event_codes (
  event_id uuid primary key references public.events(id) on delete cascade,
  code text not null,
  updated_at timestamptz not null default now()
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('confirmed','waitlisted')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS: 전 테이블 enable
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.events enable row level security;
alter table public.event_codes enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendances enable row level security;

create policy "profiles: self read"  on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- role/status는 컬럼 권한으로 봉인: 본인이어도 못 바꿈 (admin은 RPC 경유)
revoke update on public.profiles from authenticated;
grant update (name, student_no, major, phone, interests) on public.profiles to authenticated;

create policy "applications: own"        on public.applications for select using (applicant_id = auth.uid() or public.is_admin());
create policy "applications: own insert" on public.applications for insert with check (applicant_id = auth.uid());

create policy "events: read all"   on public.events for select using (auth.uid() is not null);
create policy "events: admin all"  on public.events for all using (public.is_admin()) with check (public.is_admin());

create policy "event_codes: admin only" on public.event_codes for all using (public.is_admin()) with check (public.is_admin());

create policy "registrations: own or admin" on public.event_registrations for select using (user_id = auth.uid() or public.is_admin());
create policy "attendances: own or admin"   on public.attendances for select using (user_id = auth.uid() or public.is_admin());
-- registrations/attendances 쓰기는 아래 security definer 함수로만 수행

-- 이벤트 신청 (정원 경합 원자 처리)
create or replace function public.register_for_event(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_confirmed int;
  v_status text;
  v_role text;
begin
  select role into v_role from profiles where id = auth.uid() and status = 'active';
  if v_role is null or v_role = 'applicant' then raise exception 'NOT_MEMBER'; end if;
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

-- 신청 취소 + 대기열 자동 승격
create or replace function public.cancel_registration(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was text;
begin
  perform 1 from events where id = p_event_id for update;
  delete from event_registrations where event_id = p_event_id and user_id = auth.uid()
    returning status into v_was;
  if v_was is null then raise exception 'NOT_REGISTERED'; end if;
  if v_was = 'confirmed' then
    update event_registrations set status = 'confirmed'
    where id = (
      select id from event_registrations
      where event_id = p_event_id and status = 'waitlisted'
      order by created_at limit 1
    );
  end if;
end $$;

-- 출석 체크
create or replace function public.check_attendance(p_event_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  select code into v_code from event_codes where event_id = p_event_id;
  if v_code is null then raise exception 'NO_CODE_ISSUED'; end if;
  if v_code <> upper(trim(p_code)) then raise exception 'INVALID_CODE'; end if;
  if not exists (select 1 from event_registrations
                 where event_id = p_event_id and user_id = auth.uid() and status = 'confirmed') then
    raise exception 'NOT_REGISTERED';
  end if;
  if exists (select 1 from attendances where event_id = p_event_id and user_id = auth.uid()) then
    raise exception 'ALREADY_CHECKED';
  end if;
  insert into attendances (event_id, user_id) values (p_event_id, auth.uid());
end $$;

-- admin 전용 RPC (전부 첫 줄에서 is_admin() 검사, 아니면 raise exception 'FORBIDDEN')
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('admin','member','applicant') then raise exception 'INVALID_INPUT'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active','dormant','withdrawn') then raise exception 'INVALID_INPUT'; end if;
  update profiles set status = p_status where id = p_user;
end $$;

create or replace function public.admin_review_application(p_application uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_applicant uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('accepted','rejected') then raise exception 'INVALID_INPUT'; end if;
  update applications set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_application returning applicant_id into v_applicant;
  if v_applicant is null then raise exception 'NOT_FOUND'; end if;
  if p_status = 'accepted' then
    update profiles set role = 'member' where id = v_applicant and role = 'applicant';
  end if;
end $$;

create or replace function public.admin_set_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into event_codes (event_id, code) values (p_event_id, v_code)
    on conflict (event_id) do update set code = excluded.code, updated_at = now();
  return v_code;
end $$;
