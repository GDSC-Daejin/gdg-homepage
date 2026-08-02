-- 꼬북봇 사이클 변경: 달력 기반 시즌 → 거북왕(stage 3) 도달로만 마감
-- 진화를 못 끝내면 시즌은 계속 이어진다. 마감/보너스/새 시즌 개시는 거북왕 도달 다음 날 cron에서 일어난다.

-- 1) ends_on은 더 이상 마감 조건이 아니다 — 시즌 개시 때 채우지 않는다
alter table public.squirtle_seasons alter column ends_on drop not null;
comment on column public.squirtle_seasons.ends_on is
  '레거시: 달력 기반 시즌 시절의 종료 예정일. 마감은 stage 3 도달로만 결정된다.';

-- 2) 시즌 개시 — 종료일 계산 없이 연다
create or replace function public.squirtle_open_season()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_id uuid;
begin
  if exists (select 1 from squirtle_seasons where status = 'active') then
    select id into v_id from squirtle_seasons where status = 'active';
    return v_id;
  end if;

  insert into squirtle_seasons (starts_on)
  values (v_today)
  on conflict (starts_on) do nothing
  returning id into v_id;

  -- 폴백은 활성 시즌만 인정한다. 같은 날짜의 closed 시즌을 돌려주면
  -- cron이 닫힌 시즌에 오늘 메시지를 매달아 인증이 통째로 유실된다.
  if v_id is null then
    select id into v_id from squirtle_seasons where starts_on = v_today and status = 'active';
  end if;
  return v_id;
end $$;

-- 3) 시즌 마감 — 거북왕에 도달한 시즌만 닫는다 (날짜와 무관)
create or replace function public.squirtle_close_season()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg squirtle_config;
  v_season squirtle_seasons;
  v_top3 jsonb;
  v_row record;
  v_rank int := 0;
  v_bonus int;
begin
  select * into v_cfg from squirtle_config where id = 1;

  select * into v_season from squirtle_seasons
    where status = 'active' and stage >= 3;
  if not found then
    return jsonb_build_object('closed', false);
  end if;

  update squirtle_seasons set status = 'closed' where id = v_season.id;

  for v_row in
    select p.id as user_id, p.slack_user_id, count(*)::int as count
      from squirtle_checkins c join profiles p on p.id = c.user_id
      where c.season_id = v_season.id
      group by p.id, p.slack_user_id
      order by count(*) desc, max(c.created_at) asc
      limit 3
  loop
    v_rank := v_rank + 1;
    v_bonus := case v_rank
      when 1 then v_cfg.bonus_first
      when 2 then v_cfg.bonus_second
      else v_cfg.bonus_third end;
    insert into point_logs (user_id, amount, reason)
    values (v_row.user_id, v_bonus, '꼬북봇 시즌 ' || v_rank || '위 보너스');
  end loop;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top3 from (
    select p.slack_user_id, count(*)::int as count
      from squirtle_checkins c join profiles p on p.id = c.user_id
      where c.season_id = v_season.id
      group by p.slack_user_id
      order by count(*) desc, max(c.created_at) asc
      limit 3
  ) t;

  return jsonb_build_object(
    'closed', true,
    'stage', v_season.stage,
    'total', v_season.total_count,
    'top3', v_top3
  );
end $$;

-- 4) EXECUTE 봉인 재확인 — service-role 전용
revoke execute on function public.squirtle_open_season() from public, anon, authenticated;
revoke execute on function public.squirtle_close_season() from public, anon, authenticated;
