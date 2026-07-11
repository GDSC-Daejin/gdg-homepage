-- 역할 개편: admin → organizer(오거나이저·1명) / team_member(팀 멤버·다수)
-- 포지션 추가: frontend / backend / designer

-- 1) role 제약 교체 + 기존 admin 데이터 이관
alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = 'team_member' where role = 'admin';
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('organizer', 'team_member', 'member', 'applicant'));

-- 오거나이저는 전체에서 단 1명만 (하드 백스톱)
create unique index profiles_single_organizer
  on public.profiles (role) where role = 'organizer';

-- 2) position 컬럼 (본인이 온보딩/프로필에서 직접 선택 → 컬럼 권한 부여)
alter table public.profiles
  add column position text
  check (position is null or position in ('frontend', 'backend', 'designer'));
grant update (position) on public.profiles to authenticated;

-- 3) 관리자 판정: organizer + team_member
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('organizer', 'team_member')
  );
$$;

-- 4) 신규 가입 시 admin 이메일 → team_member (organizer는 수동 승격)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when exists (
        select 1 from admin_emails where lower(email) = lower(new.email)
      ) then 'team_member'
      else 'applicant'
    end
  );
  return new;
end $$;

-- 5) 역할 변경 RPC: 새 enum + 오거나이저 중복 차단
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
  perform public.log_audit('set_role', p_user::text, jsonb_build_object('role', p_role));
end $$;

-- 6) 포지션 변경 RPC (관리자용)
create or replace function public.admin_set_position(p_user uuid, p_position text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_position not in ('frontend', 'backend', 'designer') then
    raise exception 'INVALID_INPUT';
  end if;
  update profiles set position = p_position where id = p_user;
  perform public.log_audit('set_position', p_user::text, jsonb_build_object('position', p_position));
end $$;

revoke execute on function public.admin_set_position(uuid, text) from public, anon;
grant execute on function public.admin_set_position(uuid, text) to authenticated;
