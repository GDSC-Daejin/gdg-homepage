-- 모집 포지션 확장: PM, 마케터, 바이브코더

alter table public.profiles drop constraint if exists profiles_position_check;
alter table public.profiles
  add constraint profiles_position_check
  check (position is null or position in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder'));

alter table public.applications drop constraint if exists applications_position_check;
alter table public.applications
  add constraint applications_position_check
  check (position in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder'));

alter table public.interview_questions drop constraint if exists interview_questions_position_check;
alter table public.interview_questions
  add constraint interview_questions_position_check
  check (position is null or position in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder'));

create or replace function public.admin_set_position(p_user uuid, p_position text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_position not in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder') then
    raise exception 'INVALID_INPUT';
  end if;
  update profiles set position = p_position where id = p_user;
  perform public.log_audit('set_position', p_user::text, jsonb_build_object('position', p_position));
end $$;

drop function if exists public.admin_update_recruiting_settings(text, boolean, text[], date, date);
create function public.admin_update_recruiting_settings(
  p_season text, p_is_open boolean, p_open_positions text[],
  p_apply_start date, p_apply_end date
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_season = '' or exists (
    select 1 from unnest(p_open_positions) x
    where x not in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder')
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
