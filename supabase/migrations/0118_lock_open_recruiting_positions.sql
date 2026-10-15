-- 모집 중에는 모집 포지션을 변경할 수 없도록 저장 RPC에서도 강제

create or replace function public.admin_update_recruiting_settings(
  p_season text, p_is_open boolean, p_open_positions text[],
  p_apply_start date, p_apply_end date
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_is_open boolean;
  v_open_positions text[];
  v_apply_start date;
  v_apply_end date;
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

  select is_open, open_positions, apply_start, apply_end into v_is_open, v_open_positions, v_apply_start, v_apply_end
  from public.recruiting_settings where id = 1 for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if v_is_open
    and (v_apply_start is null or (now() at time zone 'Asia/Seoul')::date >= v_apply_start)
    and (v_apply_end is null or (now() at time zone 'Asia/Seoul')::date <= v_apply_end)
    and (
    (select array_agg(value order by value) from unnest(v_open_positions) as value)
    is distinct from
    (select array_agg(value order by value) from unnest(p_open_positions) as value)
  ) then
    raise exception 'OPEN_POSITIONS_LOCKED';
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
