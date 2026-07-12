-- 모집 설정 + 지원 파트 + 심사 메모

create table public.recruiting_settings (
  id int primary key default 1 check (id = 1),
  season text not null,
  is_open boolean not null default false,
  open_positions text[] not null default '{frontend,backend,designer}',
  updated_at timestamptz not null default now()
);
alter table public.recruiting_settings enable row level security;
create policy "recruiting: public read" on public.recruiting_settings for select using (true);
insert into public.recruiting_settings (id, season) values (1, '2026-2');

-- 쓰기 정책은 만들지 않음 (쓰기는 RPC로만)

create or replace function public.admin_update_recruiting_settings(
  p_season text, p_is_open boolean, p_open_positions text[]
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_season = '' or exists (
    select 1 from unnest(p_open_positions) x where x not in ('frontend', 'backend', 'designer')
  ) then
    raise exception 'INVALID_INPUT';
  end if;
  update recruiting_settings
    set season = p_season,
        is_open = p_is_open,
        open_positions = p_open_positions,
        updated_at = now()
    where id = 1;
  perform public.log_audit('update_recruiting_settings', 'recruiting', jsonb_build_object('season', p_season, 'is_open', p_is_open, 'open_positions', p_open_positions));
end $$;

revoke execute on function public.admin_update_recruiting_settings(text, boolean, text[]) from public, anon;
grant execute on function public.admin_update_recruiting_settings(text, boolean, text[]) to authenticated;

alter table public.applications
  add column position text check (position in ('frontend', 'backend', 'designer')),
  add column review_note text not null default '';
-- position은 null 허용 — 기존 데이터 "미지정"

create or replace function public.admin_set_application_note(p_application uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update applications set review_note = p_note where id = p_application;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('note_application', p_application::text, jsonb_build_object('note', left(p_note, 300)));
end $$;

revoke execute on function public.admin_set_application_note(uuid, text) from public, anon;
grant execute on function public.admin_set_application_note(uuid, text) to authenticated;

-- 상태 변경 RPC 재정의: 0016 본문 유지 + 합격 시 position을 profiles로 승계
create or replace function public.admin_set_application_status(p_application uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_applicant uuid;
  v_position text;
  v_decided boolean := p_status in ('accepted', 'rejected');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('waiting', 'pending', 'accepted', 'rejected') then
    raise exception 'INVALID_INPUT';
  end if;
  update applications
    set status = p_status,
        reviewed_by = case when v_decided then auth.uid() else null end,
        reviewed_at = case when v_decided then now() else null end
    where id = p_application
    returning applicant_id, position into v_applicant, v_position;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status = 'accepted' and v_applicant is not null then
    update profiles set role = 'member' where id = v_applicant and role = 'applicant';
    if v_position is not null then
      update profiles set position = v_position where id = v_applicant;
    end if;
  end if;
  perform public.log_audit('review_application', p_application::text, jsonb_build_object('status', p_status));
end $$;

revoke execute on function public.admin_set_application_status(uuid, text) from public, anon;
grant execute on function public.admin_set_application_status(uuid, text) to authenticated;
