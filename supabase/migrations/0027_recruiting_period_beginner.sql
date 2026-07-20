-- 모집 설정 개선: 지원기간(시작~종료일) + 비기너 포지션 추가
-- 모집중 판정 = is_open(수동 스위치) AND 오늘(KST)이 [apply_start, apply_end] 범위 안
-- 종료일이 지나면 자동 종료 (RLS에서도 강제)

-- 1) 지원기간 컬럼
alter table public.recruiting_settings
  add column apply_start date,
  add column apply_end date;

-- 2) 비기너 포지션: CHECK 제약 갱신 (신입 대상, 진입장벽 낮은 파트)
alter table public.profiles drop constraint profiles_position_check;
alter table public.profiles
  add constraint profiles_position_check
  check (position is null or position in ('frontend', 'backend', 'designer', 'beginner'));

alter table public.applications drop constraint applications_position_check;
alter table public.applications
  add constraint applications_position_check
  check (position in ('frontend', 'backend', 'designer', 'beginner'));

-- 3) 포지션 변경 RPC: beginner 허용
create or replace function public.admin_set_position(p_user uuid, p_position text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_position not in ('frontend', 'backend', 'designer', 'beginner') then
    raise exception 'INVALID_INPUT';
  end if;
  update profiles set position = p_position where id = p_user;
  perform public.log_audit('set_position', p_user::text, jsonb_build_object('position', p_position));
end $$;

-- 4) 모집 설정 저장 RPC: 지원기간 파라미터 추가 + beginner 허용 (시그니처 변경 → drop 후 재생성)
drop function if exists public.admin_update_recruiting_settings(text, boolean, text[]);
create function public.admin_update_recruiting_settings(
  p_season text, p_is_open boolean, p_open_positions text[],
  p_apply_start date, p_apply_end date
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_season = '' or exists (
    select 1 from unnest(p_open_positions) x
    where x not in ('frontend', 'backend', 'designer', 'beginner')
  ) then
    raise exception 'INVALID_INPUT';
  end if;
  if p_apply_start is not null and p_apply_end is not null and p_apply_end < p_apply_start then
    raise exception 'INVALID_INPUT';
  end if;
  update recruiting_settings
    set season = p_season,
        is_open = p_is_open,
        open_positions = p_open_positions,
        apply_start = p_apply_start,
        apply_end = p_apply_end,
        updated_at = now()
    where id = 1;
  perform public.log_audit('update_recruiting_settings', 'recruiting', jsonb_build_object(
    'season', p_season, 'is_open', p_is_open, 'open_positions', p_open_positions,
    'apply_start', p_apply_start, 'apply_end', p_apply_end));
end $$;

revoke execute on function public.admin_update_recruiting_settings(text, boolean, text[], date, date) from public, anon;
grant execute on function public.admin_update_recruiting_settings(text, boolean, text[], date, date) to authenticated;

-- 5) anon insert 정책: 지원기간 범위도 DB에서 강제 (종료일 지나면 자동 마감)
drop policy "applications: anon insert" on public.applications;
create policy "applications: anon insert"
  on public.applications for insert to anon
  with check (
    applicant_id is null
    and exists (
      select 1 from public.recruiting_settings rs
      where rs.id = 1
        and rs.is_open
        and rs.season = applications.season
        and applications.position = any(rs.open_positions)
        and (rs.apply_start is null or (now() at time zone 'Asia/Seoul')::date >= rs.apply_start)
        and (rs.apply_end is null or (now() at time zone 'Asia/Seoul')::date <= rs.apply_end)
    )
  );
