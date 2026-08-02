-- 꼬북봇: 슬랙 리액션 기반 물 마시기 인증 + 시즌 진화

-- 1) 슬랙 계정 연결 컬럼
alter table public.profiles add column slack_user_id text unique;
create index profiles_slack_user_id_idx on public.profiles (slack_user_id)
  where slack_user_id is not null;

-- 2) 설정 (단일 행) — 임계값은 실측 후 조정하는 손잡이
create table public.squirtle_config (
  id int primary key default 1 check (id = 1),
  channel_id text not null,
  emoji text not null,
  points_per_checkin int not null default 5,
  stage2_threshold int not null default 80,
  stage3_threshold int not null default 200,
  bonus_first int not null default 30,
  bonus_second int not null default 20,
  bonus_third int not null default 10
);
insert into public.squirtle_config (id, channel_id, emoji)
values (1, 'C02BE2ERYCC', 'squirtle');

-- 3) 시즌
create table public.squirtle_seasons (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null unique,
  ends_on date not null,
  stage int not null default 1 check (stage between 1 and 3),
  total_count int not null default 0,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now()
);
create unique index squirtle_one_active_season
  on public.squirtle_seasons ((status)) where status = 'active';

-- 4) 하루 한 개의 메시지
create table public.squirtle_posts (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.squirtle_seasons(id) on delete cascade,
  posted_on date not null unique,
  message_ts text not null unique,
  thread_ts text,
  created_at timestamptz not null default now()
);

-- 5) 인증 기록 — 이 유니크 제약 하나가 멱등성의 전부
create table public.squirtle_checkins (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.squirtle_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (season_id, user_id, checked_on)
);

alter table public.squirtle_config enable row level security;
alter table public.squirtle_seasons enable row level security;
alter table public.squirtle_posts enable row level security;
alter table public.squirtle_checkins enable row level security;

create policy "squirtle_config: admin read"
  on public.squirtle_config for select using (public.is_admin());
create policy "squirtle_seasons: admin read"
  on public.squirtle_seasons for select using (public.is_admin());
create policy "squirtle_posts: admin read"
  on public.squirtle_posts for select using (public.is_admin());
create policy "squirtle_checkins: admin read"
  on public.squirtle_checkins for select using (public.is_admin());

-- 6) 시즌 개시 — 남은 날이 14일 미만이면 다음 달 말일까지
create or replace function public.squirtle_open_season()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month_end date;
  v_ends date;
  v_id uuid;
begin
  if exists (select 1 from squirtle_seasons where status = 'active') then
    select id into v_id from squirtle_seasons where status = 'active';
    return v_id;
  end if;

  v_month_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  if v_month_end - v_today < 14 then
    v_ends := (date_trunc('month', v_today) + interval '2 months - 1 day')::date;
  else
    v_ends := v_month_end;
  end if;

  insert into squirtle_seasons (starts_on, ends_on)
  values (v_today, v_ends)
  on conflict (starts_on) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from squirtle_seasons where starts_on = v_today;
  end if;
  return v_id;
end $$;

-- 7) 인증 처리
create or replace function public.squirtle_checkin(p_slack_user text, p_message_ts text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cfg squirtle_config;
  v_post squirtle_posts;
  v_season squirtle_seasons;
  v_user uuid;
  v_new_stage int;
  v_changed boolean := false;
  v_participants jsonb;
  v_top3 jsonb;
begin
  select * into v_cfg from squirtle_config where id = 1;

  select * into v_post from squirtle_posts where message_ts = p_message_ts;
  if not found or v_post.posted_on <> v_today then
    return jsonb_build_object('counted', false, 'reason', 'stale');
  end if;

  select id into v_user from profiles where slack_user_id = p_slack_user;
  if v_user is null then
    return jsonb_build_object('counted', false, 'reason', 'unlinked');
  end if;

  insert into squirtle_checkins (season_id, user_id, checked_on)
  values (v_post.season_id, v_user, v_today)
  on conflict (season_id, user_id, checked_on) do nothing;
  if not found then
    return jsonb_build_object('counted', false, 'reason', 'duplicate');
  end if;

  insert into point_logs (user_id, amount, reason)
  values (v_user, v_cfg.points_per_checkin, '꼬북봇 물 마시기 인증');

  update squirtle_seasons
    set total_count = total_count + 1
    where id = v_post.season_id
    returning * into v_season;

  v_new_stage := case
    when v_season.total_count >= v_cfg.stage3_threshold then 3
    when v_season.total_count >= v_cfg.stage2_threshold then 2
    else 1 end;

  if v_new_stage > v_season.stage then
    update squirtle_seasons set stage = v_new_stage where id = v_season.id;
    v_changed := true;
  end if;

  select coalesce(jsonb_agg(p.slack_user_id order by c.created_at), '[]'::jsonb)
    into v_participants
    from squirtle_checkins c join profiles p on p.id = c.user_id
    where c.season_id = v_season.id and c.checked_on = v_today;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top3 from (
    select p.slack_user_id, count(*)::int as count
      from squirtle_checkins c join profiles p on p.id = c.user_id
      where c.season_id = v_season.id
      group by p.slack_user_id
      order by count(*) desc, max(c.created_at) asc
      limit 3
  ) t;

  return jsonb_build_object(
    'counted', true,
    'total', v_season.total_count,
    'stage', v_new_stage,
    'stage_changed', v_changed,
    'participants', v_participants,
    'top3', v_top3
  );
end $$;

-- 8) 시즌 마감 — 이미 closed면 무동작 (보너스 중복 지급 방지)
create or replace function public.squirtle_close_season()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cfg squirtle_config;
  v_season squirtle_seasons;
  v_top3 jsonb;
  v_row record;
  v_rank int := 0;
  v_bonus int;
begin
  select * into v_cfg from squirtle_config where id = 1;

  select * into v_season from squirtle_seasons
    where status = 'active' and ends_on < v_today;
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

-- 9) EXECUTE 봉인 — service-role 전용
revoke execute on function public.squirtle_checkin(text, text) from public, anon, authenticated;
revoke execute on function public.squirtle_open_season() from public, anon, authenticated;
revoke execute on function public.squirtle_close_season() from public, anon, authenticated;
