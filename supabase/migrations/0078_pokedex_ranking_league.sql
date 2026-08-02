create table public.pokemon_rank_seasons (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'active' check (status in ('active', 'closed')),
  closed_at timestamptz
);

create unique index pokemon_rank_one_active_season on public.pokemon_rank_seasons ((status)) where status = 'active';

create table public.pokemon_rank_entries (
  season_id uuid not null references public.pokemon_rank_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null default 1000 check (rating >= 0),
  matches int not null default 0 check (matches >= 0),
  attacks int not null default 0 check (attacks >= 0),
  wins int not null default 0 check (wins >= 0),
  active_defense_slot smallint check (active_defense_slot between 1 and 3),
  defense_effective_on date,
  rerolled_on date,
  joined_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

create table public.pokemon_rank_presets (
  season_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('attack', 'defense')),
  slot smallint not null check (slot between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id, kind, slot),
  foreign key (season_id, user_id) references public.pokemon_rank_entries(season_id, user_id) on delete cascade
);

create table public.pokemon_rank_preset_members (
  season_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('attack', 'defense')),
  slot smallint not null check (slot between 1 and 3),
  position smallint not null check (position between 1 and 3),
  throw_id uuid not null references public.pokemon_throws(id) on delete restrict,
  pokemon_id uuid not null references public.pokemon_catalog(id) on delete restrict,
  primary key (season_id, user_id, kind, slot, position),
  unique (season_id, user_id, kind, slot, throw_id),
  foreign key (season_id, user_id, kind, slot) references public.pokemon_rank_presets(season_id, user_id, kind, slot) on delete cascade
);

create table public.pokemon_rank_allocations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.pokemon_rank_seasons(id) on delete cascade,
  allocated_on date not null,
  attacker_id uuid not null references public.profiles(id) on delete cascade,
  defender_id uuid not null references public.profiles(id) on delete cascade,
  defender_team jsonb not null,
  public_lead jsonb not null,
  public_power_floor int not null,
  status text not null default 'available' check (status in ('available', 'used', 'rerolled')),
  created_at timestamptz not null default now(),
  check (attacker_id <> defender_id),
  unique (season_id, allocated_on, attacker_id, defender_id)
);

create index pokemon_rank_allocations_attacker_idx on public.pokemon_rank_allocations (season_id, allocated_on, attacker_id, status);
create index pokemon_rank_allocations_defender_idx on public.pokemon_rank_allocations (season_id, allocated_on, defender_id, status);

create table public.pokemon_rank_battles (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.pokemon_rank_seasons(id) on delete restrict,
  allocation_id uuid not null references public.pokemon_rank_allocations(id) on delete restrict,
  attacker_id uuid not null references public.profiles(id) on delete restrict,
  defender_id uuid not null references public.profiles(id) on delete restrict,
  attacker_team jsonb not null,
  defender_team jsonb not null,
  battle_log jsonb not null,
  winner_id uuid not null references public.profiles(id) on delete restrict,
  attacker_delta int not null,
  defender_delta int not null,
  created_at timestamptz not null default now(),
  unique (allocation_id)
);

create index pokemon_rank_battles_participants_idx on public.pokemon_rank_battles (season_id, attacker_id, defender_id, created_at desc);

create table public.pokemon_rank_rewards (
  season_id uuid not null references public.pokemon_rank_seasons(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  rank smallint not null check (rank between 1 and 3),
  badge_id uuid not null references public.badges(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

alter table public.pokemon_rank_seasons enable row level security;
alter table public.pokemon_rank_entries enable row level security;
alter table public.pokemon_rank_presets enable row level security;
alter table public.pokemon_rank_preset_members enable row level security;
alter table public.pokemon_rank_allocations enable row level security;
alter table public.pokemon_rank_battles enable row level security;
alter table public.pokemon_rank_rewards enable row level security;

revoke all on public.pokemon_rank_seasons, public.pokemon_rank_entries, public.pokemon_rank_presets, public.pokemon_rank_preset_members, public.pokemon_rank_allocations, public.pokemon_rank_battles, public.pokemon_rank_rewards from public, anon, authenticated;

create function public.pokedex_rank_kst_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

create function public.pokedex_rank_type_multiplier(p_attacker text, p_defender text)
returns numeric language sql immutable set search_path = public as $$
  select case
    when p_attacker = 'normal' and p_defender in ('rock', 'steel') then 0.8
    when p_attacker = 'fire' and p_defender in ('grass', 'ice', 'bug', 'steel') then 1.2
    when p_attacker = 'fire' and p_defender in ('fire', 'water', 'rock', 'dragon') then 0.8
    when p_attacker = 'water' and p_defender in ('fire', 'ground', 'rock') then 1.2
    when p_attacker = 'water' and p_defender in ('water', 'grass', 'dragon') then 0.8
    when p_attacker = 'electric' and p_defender in ('water', 'flying') then 1.2
    when p_attacker = 'electric' and p_defender in ('electric', 'grass', 'dragon') then 0.8
    when p_attacker = 'grass' and p_defender in ('water', 'ground', 'rock') then 1.2
    when p_attacker = 'grass' and p_defender in ('fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel') then 0.8
    when p_attacker = 'ice' and p_defender in ('grass', 'ground', 'flying', 'dragon') then 1.2
    when p_attacker = 'ice' and p_defender in ('fire', 'water', 'ice', 'steel') then 0.8
    when p_attacker = 'fighting' and p_defender in ('normal', 'ice', 'rock', 'dark', 'steel') then 1.2
    when p_attacker = 'fighting' and p_defender in ('poison', 'flying', 'psychic', 'bug', 'fairy') then 0.8
    when p_attacker = 'poison' and p_defender in ('grass', 'fairy') then 1.2
    when p_attacker = 'poison' and p_defender in ('poison', 'ground', 'rock', 'ghost') then 0.8
    when p_attacker = 'ground' and p_defender in ('fire', 'electric', 'poison', 'rock', 'steel') then 1.2
    when p_attacker = 'ground' and p_defender in ('grass', 'bug') then 0.8
    when p_attacker = 'flying' and p_defender in ('grass', 'fighting', 'bug') then 1.2
    when p_attacker = 'flying' and p_defender in ('electric', 'rock', 'steel') then 0.8
    when p_attacker = 'psychic' and p_defender in ('fighting', 'poison') then 1.2
    when p_attacker = 'psychic' and p_defender in ('psychic', 'steel') then 0.8
    when p_attacker = 'bug' and p_defender in ('grass', 'psychic', 'dark') then 1.2
    when p_attacker = 'bug' and p_defender in ('fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy') then 0.8
    when p_attacker = 'rock' and p_defender in ('fire', 'ice', 'flying', 'bug') then 1.2
    when p_attacker = 'rock' and p_defender in ('fighting', 'ground', 'steel') then 0.8
    when p_attacker = 'ghost' and p_defender in ('psychic', 'ghost') then 1.2
    when p_attacker = 'ghost' and p_defender = 'dark' then 0.8
    when p_attacker = 'dragon' and p_defender = 'dragon' then 1.2
    when p_attacker = 'dragon' and p_defender = 'steel' then 0.8
    when p_attacker = 'fairy' and p_defender in ('fighting', 'dragon', 'dark') then 1.2
    when p_attacker = 'fairy' and p_defender in ('fire', 'poison', 'steel') then 0.8
    when p_attacker = 'steel' and p_defender in ('ice', 'rock', 'fairy') then 1.2
    when p_attacker = 'steel' and p_defender in ('fire', 'water', 'electric', 'steel') then 0.8
    else 1.0
  end;
$$;

create function public.pokedex_rank_close_season(p_season uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_season pokemon_rank_seasons%rowtype;
  v_reward record;
  v_badge uuid;
begin
  select * into v_season from pokemon_rank_seasons where id = p_season for update;
  if not found or v_season.status = 'closed' then return; end if;

  update pokemon_rank_seasons set status = 'closed', closed_at = now() where id = p_season;
  for v_reward in
    select user_id, final_rank
    from (
      select e.user_id, rank() over (order by e.rating desc) as final_rank
      from pokemon_rank_entries e
      where e.season_id = p_season and e.matches >= 10 and e.attacks >= 5
    ) ranked
    where final_rank <= 3
  loop
    insert into badges (name, description, icon)
    values (
      format('도감 랭킹전 %s %s위', to_char(v_season.starts_at at time zone 'Asia/Seoul', 'YYYY.MM.DD'), v_reward.final_rank),
      format('도감 랭킹전 시즌 %s 공동 %s위', to_char(v_season.starts_at at time zone 'Asia/Seoul', 'YYYY.MM.DD'), v_reward.final_rank),
      case v_reward.final_rank when 1 then '🏆' when 2 then '🥈' else '🥉' end
    ) on conflict (name) do update set name = excluded.name returning id into v_badge;
    insert into pokemon_rank_rewards (season_id, user_id, rank, badge_id)
    values (p_season, v_reward.user_id, v_reward.final_rank, v_badge)
    on conflict do nothing;
    insert into user_badges (badge_id, user_id)
    values (v_badge, v_reward.user_id)
    on conflict do nothing;
  end loop;
end $$;

create function public.pokedex_rank_current_season()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_season pokemon_rank_seasons%rowtype;
  v_id uuid;
begin
  select * into v_season from pokemon_rank_seasons where status = 'active' for update;
  if found and v_season.ends_at > now() then return v_season.id; end if;
  if found then perform pokedex_rank_close_season(v_season.id); end if;
  insert into pokemon_rank_seasons (starts_at, ends_at)
  values (now(), now() + interval '4 weeks')
  returning id into v_id;
  return v_id;
end $$;

create function public.pokedex_rank_preset_team(p_season uuid, p_user uuid, p_kind text, p_slot smallint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'throwId', m.throw_id,
    'pokemonId', m.pokemon_id,
    'name', c.name_ko,
    'imagePath', c.image_path,
    'combatPower', a.combat_power,
    'battleType', c.battle_type,
    'rarity', c.rarity
  ) order by m.position), '[]'::jsonb)
  from pokemon_rank_preset_members m
  join pokemon_throws t on t.id = m.throw_id and t.user_id = p_user and t.outcome = 'caught'
  join pokemon_appearances a on a.id = t.appearance_id and a.combat_power is not null
  join pokemon_catalog c on c.id = m.pokemon_id
  where m.season_id = p_season and m.user_id = p_user and m.kind = p_kind and m.slot = p_slot;
$$;

create function public.pokedex_rank_allocate_for(p_season uuid, p_today date, p_attacker uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_rating int;
  v_candidate record;
  v_team jsonb;
  v_count int;
  v_remaining int;
begin
  select rating into v_rating from pokemon_rank_entries where season_id = p_season and user_id = p_attacker;
  if v_rating is null then return 0; end if;
  select count(*) into v_count from pokemon_rank_allocations
  where season_id = p_season and allocated_on = p_today and attacker_id = p_attacker and status in ('available', 'used');
  v_remaining := greatest(0, 3 - v_count);
  if v_remaining = 0 then return 0; end if;
  v_count := 0;

  for v_candidate in
    select e.user_id, e.active_defense_slot, e.rating
    from pokemon_rank_entries e
    where e.season_id = p_season
      and e.user_id <> p_attacker
      and e.active_defense_slot is not null
      and e.defense_effective_on <= p_today
      and not exists (
        select 1 from pokemon_rank_allocations old
        where old.season_id = p_season and old.allocated_on = p_today and old.attacker_id = p_attacker and old.defender_id = e.user_id
      )
      and (select count(*) from pokemon_rank_allocations used
           where used.season_id = p_season and used.allocated_on = p_today and used.defender_id = e.user_id and used.status in ('available', 'used')) < 3
    order by case when abs(e.rating - v_rating) <= 300 then 0 else 1 end, random()
    limit v_remaining
  loop
    perform pg_advisory_xact_lock(hashtext(p_season::text || p_today::text || v_candidate.user_id::text));
    if (select count(*) from pokemon_rank_allocations used
        where used.season_id = p_season and used.allocated_on = p_today and used.defender_id = v_candidate.user_id and used.status in ('available', 'used')) >= 3 then continue; end if;
    v_team := pokedex_rank_preset_team(p_season, v_candidate.user_id, 'defense', v_candidate.active_defense_slot);
    if jsonb_array_length(v_team) <> 3 then continue; end if;
    insert into pokemon_rank_allocations (season_id, allocated_on, attacker_id, defender_id, defender_team, public_lead, public_power_floor)
    values (
      p_season, p_today, p_attacker, v_candidate.user_id, v_team, v_team -> 0,
      floor(((v_team -> 0 ->> 'combatPower')::int + (v_team -> 1 ->> 'combatPower')::int + (v_team -> 2 ->> 'combatPower')::int) / 1000.0)::int * 1000
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function public.pokedex_rank_refresh_daily()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_season uuid := pokedex_rank_current_season();
  v_today date := pokedex_rank_kst_today();
  v_entry record;
  v_count int := 0;
begin
  for v_entry in
    select user_id
    from pokemon_rank_entries
    where season_id = v_season and active_defense_slot is not null and defense_effective_on <= v_today
  loop
    v_count := v_count + pokedex_rank_allocate_for(v_season, v_today, v_entry.user_id);
  end loop;
  return v_count;
end $$;

create function public.pokedex_rank_join()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from profiles where id = v_user and status = 'active';
  if not found then raise exception 'FORBIDDEN'; end if;
  if (select count(distinct t.pokemon_id) from pokemon_throws t where t.user_id = v_user and t.outcome = 'caught') < 6 then
    raise exception 'RANKING_NOT_ELIGIBLE';
  end if;
  insert into pokemon_rank_entries (season_id, user_id) values (v_season, v_user) on conflict do nothing;
end $$;

create function public.pokedex_rank_save_preset(p_kind text, p_slot smallint, p_throw_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
  v_count int;
  v_species int;
  v_legendaries int;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  if p_kind is null or p_kind not in ('attack', 'defense') or p_slot is null or p_slot not between 1 and 3 or coalesce(array_length(p_throw_ids, 1), 0) <> 3 then raise exception 'INVALID_INPUT'; end if;
  perform 1 from pokemon_rank_entries where season_id = v_season and user_id = v_user;
  if not found then raise exception 'RANKING_NOT_JOINED'; end if;
  select count(*), count(distinct t.pokemon_id), count(*) filter (where p.rarity = 'legendary')
  into v_count, v_species, v_legendaries
  from unnest(p_throw_ids) chosen(throw_id)
  join pokemon_throws t on t.id = chosen.throw_id and t.user_id = v_user and t.outcome = 'caught'
  join pokemon_appearances a on a.id = t.appearance_id and a.combat_power is not null
  join pokemon_catalog p on p.id = t.pokemon_id;
  if v_count <> 3 or v_species <> 3 or v_legendaries > 1 then raise exception 'INVALID_RANKING_TEAM'; end if;

  insert into pokemon_rank_presets (season_id, user_id, kind, slot)
  values (v_season, v_user, p_kind, p_slot)
  on conflict (season_id, user_id, kind, slot) do update set updated_at = now();
  delete from pokemon_rank_preset_members where season_id = v_season and user_id = v_user and kind = p_kind and slot = p_slot;
  insert into pokemon_rank_preset_members (season_id, user_id, kind, slot, position, throw_id, pokemon_id)
  select v_season, v_user, p_kind, p_slot, chosen.position::smallint, t.id, t.pokemon_id
  from unnest(p_throw_ids) with ordinality chosen(throw_id, position)
  join pokemon_throws t on t.id = chosen.throw_id;
  perform count(distinct m.pokemon_id) from pokemon_rank_preset_members m where m.season_id = v_season and m.user_id = v_user and m.kind = p_kind and m.slot = p_slot;
end $$;

create function public.pokedex_rank_activate_defense(p_slot smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  if p_slot is null or p_slot not between 1 and 3 then raise exception 'INVALID_INPUT'; end if;
  if jsonb_array_length(pokedex_rank_preset_team(v_season, v_user, 'defense', p_slot)) <> 3 then raise exception 'INVALID_RANKING_TEAM'; end if;
  update pokemon_rank_entries
  set active_defense_slot = p_slot, defense_effective_on = pokedex_rank_kst_today() + 1
  where season_id = v_season and user_id = v_user;
  if not found then raise exception 'RANKING_NOT_JOINED'; end if;
end $$;

create function public.pokedex_rank_reroll()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
  v_today date := pokedex_rank_kst_today();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from pokemon_rank_entries where season_id = v_season and user_id = v_user and rerolled_on is distinct from v_today for update;
  if not found then raise exception 'RANKING_REROLL_UNAVAILABLE'; end if;
  if exists (select 1 from pokemon_rank_battles where season_id = v_season and attacker_id = v_user and (created_at at time zone 'Asia/Seoul')::date = v_today) then
    raise exception 'RANKING_REROLL_UNAVAILABLE';
  end if;
  update pokemon_rank_allocations set status = 'rerolled'
  where season_id = v_season and allocated_on = v_today and attacker_id = v_user and status = 'available';
  update pokemon_rank_entries set rerolled_on = v_today where season_id = v_season and user_id = v_user;
  perform pokedex_rank_allocate_for(v_season, v_today, v_user);
end $$;

create function public.pokedex_rank_start_battle(p_allocation uuid, p_attack_slot smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
  v_today date := pokedex_rank_kst_today();
  a pokemon_rank_allocations%rowtype;
  v_existing pokemon_rank_battles%rowtype;
  v_attacker_team jsonb;
  v_defender_team jsonb;
  v_log jsonb := '[]'::jsonb;
  v_attacker_index int := 0;
  v_defender_index int := 0;
  v_attacker_hp int[];
  v_defender_hp int[];
  v_attacker jsonb;
  v_defender jsonb;
  v_attacker_cp int;
  v_defender_cp int;
  v_damage int;
  v_counter_damage int;
  v_attacker_mono numeric := 1.0;
  v_defender_mono numeric := 1.0;
  v_winner uuid;
  v_attacker_delta int;
  v_defender_delta int;
  v_battle uuid;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  if p_allocation is null or p_attack_slot is null or p_attack_slot not between 1 and 3 then raise exception 'INVALID_INPUT'; end if;
  select * into v_existing from pokemon_rank_battles where allocation_id = p_allocation;
  if found then
    if v_existing.attacker_id <> v_user then raise exception 'FORBIDDEN'; end if;
    return jsonb_build_object('id', v_existing.id, 'winnerId', v_existing.winner_id, 'battleLog', v_existing.battle_log, 'attackerDelta', v_existing.attacker_delta, 'defenderDelta', v_existing.defender_delta);
  end if;
  select * into a from pokemon_rank_allocations where id = p_allocation for update;
  select * into v_existing from pokemon_rank_battles where allocation_id = p_allocation;
  if found then
    if v_existing.attacker_id <> v_user then raise exception 'FORBIDDEN'; end if;
    return jsonb_build_object('id', v_existing.id, 'winnerId', v_existing.winner_id, 'battleLog', v_existing.battle_log, 'attackerDelta', v_existing.attacker_delta, 'defenderDelta', v_existing.defender_delta);
  end if;
  if not found or a.season_id <> v_season or a.attacker_id <> v_user or a.allocated_on <> v_today or a.status <> 'available' then raise exception 'RANKING_BATTLE_UNAVAILABLE'; end if;
  perform 1 from pokemon_rank_entries where season_id = v_season and user_id = v_user for update;
  if not found then raise exception 'RANKING_NOT_JOINED'; end if;
  if (select count(*) from pokemon_rank_battles where season_id = v_season and attacker_id = v_user and (created_at at time zone 'Asia/Seoul')::date = v_today) >= 3 then raise exception 'RANKING_BATTLE_UNAVAILABLE'; end if;
  v_attacker_team := pokedex_rank_preset_team(v_season, v_user, 'attack', p_attack_slot);
  v_defender_team := a.defender_team;
  if jsonb_array_length(v_attacker_team) <> 3 or jsonb_array_length(v_defender_team) <> 3 then raise exception 'INVALID_RANKING_TEAM'; end if;
  if (select count(distinct item ->> 'battleType') from jsonb_array_elements(v_attacker_team) item) = 1 then v_attacker_mono := 1.1; end if;
  if (select count(distinct item ->> 'battleType') from jsonb_array_elements(v_defender_team) item) = 1 then v_defender_mono := 1.1; end if;
  select array_agg(1000 + (item ->> 'combatPower')::int order by ordinality) into v_attacker_hp from jsonb_array_elements(v_attacker_team) with ordinality members(item, ordinality);
  select array_agg(1000 + (item ->> 'combatPower')::int order by ordinality) into v_defender_hp from jsonb_array_elements(v_defender_team) with ordinality members(item, ordinality);

  while v_attacker_index < 3 and v_defender_index < 3 loop
    v_attacker := v_attacker_team -> v_attacker_index;
    v_defender := v_defender_team -> v_defender_index;
    v_attacker_cp := (v_attacker ->> 'combatPower')::int;
    v_defender_cp := (v_defender ->> 'combatPower')::int;
    v_damage := floor((200 + v_attacker_cp * 0.4) * pokedex_rank_type_multiplier(v_attacker ->> 'battleType', v_defender ->> 'battleType') * v_attacker_mono * (0.95 + random() * 0.10))::int;
    v_counter_damage := floor((200 + v_defender_cp * 0.4) * pokedex_rank_type_multiplier(v_defender ->> 'battleType', v_attacker ->> 'battleType') * v_defender_mono * (0.95 + random() * 0.10))::int;
    v_defender_hp[v_defender_index + 1] := greatest(0, v_defender_hp[v_defender_index + 1] - v_damage);
    v_attacker_hp[v_attacker_index + 1] := greatest(0, v_attacker_hp[v_attacker_index + 1] - v_counter_damage);
    v_log := v_log || jsonb_build_array(jsonb_build_object(
      'attackerIndex', v_attacker_index, 'defenderIndex', v_defender_index,
      'attackerDamage', v_damage, 'defenderDamage', v_counter_damage,
      'attackerHealth', v_attacker_hp[v_attacker_index + 1], 'defenderHealth', v_defender_hp[v_defender_index + 1],
      'attackerTypeMultiplier', pokedex_rank_type_multiplier(v_attacker ->> 'battleType', v_defender ->> 'battleType'),
      'defenderTypeMultiplier', pokedex_rank_type_multiplier(v_defender ->> 'battleType', v_attacker ->> 'battleType'),
      'attackerMonoMultiplier', v_attacker_mono, 'defenderMonoMultiplier', v_defender_mono
    ));
    if v_attacker_hp[v_attacker_index + 1] = 0 then v_attacker_index := v_attacker_index + 1; end if;
    if v_defender_hp[v_defender_index + 1] = 0 then v_defender_index := v_defender_index + 1; end if;
  end loop;
  if v_attacker_index >= 3 and v_defender_index >= 3 then
    v_winner := case when random() < 0.5 then v_user else a.defender_id end;
  elsif v_defender_index >= 3 then v_winner := v_user;
  else v_winner := a.defender_id;
  end if;
  if v_winner = v_user then v_attacker_delta := 30; v_defender_delta := -10;
  else v_attacker_delta := -30; v_defender_delta := 10;
  end if;
  insert into pokemon_rank_battles (season_id, allocation_id, attacker_id, defender_id, attacker_team, defender_team, battle_log, winner_id, attacker_delta, defender_delta)
  values (v_season, a.id, v_user, a.defender_id, v_attacker_team, v_defender_team, v_log, v_winner, v_attacker_delta, v_defender_delta)
  returning id into v_battle;
  update pokemon_rank_allocations set status = 'used' where id = a.id;
  update pokemon_rank_entries set rating = greatest(0, rating + v_attacker_delta), matches = matches + 1, attacks = attacks + 1, wins = wins + case when v_winner = v_user then 1 else 0 end where season_id = v_season and user_id = v_user;
  update pokemon_rank_entries set rating = greatest(0, rating + v_defender_delta), matches = matches + 1, wins = wins + case when v_winner = a.defender_id then 1 else 0 end where season_id = v_season and user_id = a.defender_id;
  return jsonb_build_object('id', v_battle, 'winnerId', v_winner, 'battleLog', v_log, 'attackerDelta', v_attacker_delta, 'defenderDelta', v_defender_delta);
end $$;

create function public.pokedex_rank_battle_detail(p_battle uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  b pokemon_rank_battles%rowtype;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  select * into b from pokemon_rank_battles where id = p_battle;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.attacker_id <> v_user and b.defender_id <> v_user then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object('id', b.id, 'attackerId', b.attacker_id, 'defenderId', b.defender_id, 'attackerTeam', b.attacker_team, 'defenderTeam', b.defender_team, 'battleLog', b.battle_log, 'winnerId', b.winner_id, 'attackerDelta', b.attacker_delta, 'defenderDelta', b.defender_delta, 'createdAt', b.created_at);
end $$;

create function public.pokedex_rank_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
  v_today date := pokedex_rank_kst_today();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'eligible', (select count(distinct t.pokemon_id) >= 6 from pokemon_throws t where t.user_id = v_user and t.outcome = 'caught'),
    'season', (select jsonb_build_object('id', id, 'startsAt', starts_at, 'endsAt', ends_at) from pokemon_rank_seasons where id = v_season),
    'entry', (select jsonb_build_object('rating', rating, 'matches', matches, 'attacks', attacks, 'attacksToday', (select count(*) from pokemon_rank_battles b where b.season_id = v_season and b.attacker_id = v_user and (b.created_at at time zone 'Asia/Seoul')::date = v_today), 'wins', wins, 'activeDefenseSlot', active_defense_slot, 'defenseEffectiveOn', defense_effective_on, 'rerolled', rerolled_on = v_today) from pokemon_rank_entries where season_id = v_season and user_id = v_user),
    'ownedPokemon', coalesce((select jsonb_agg(jsonb_build_object('throwId', t.id, 'pokemonId', c.id, 'name', c.name_ko, 'imagePath', c.image_path, 'combatPower', a.combat_power, 'battleType', c.battle_type, 'rarity', c.rarity) order by a.combat_power desc) from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id join pokemon_catalog c on c.id = t.pokemon_id where t.user_id = v_user and t.outcome = 'caught' and a.combat_power is not null), '[]'::jsonb),
    'presets', coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'slot', p.slot, 'members', pokedex_rank_preset_team(v_season, v_user, p.kind, p.slot)) order by p.kind, p.slot) from pokemon_rank_presets p where p.season_id = v_season and p.user_id = v_user), '[]'::jsonb),
    'opponents', coalesce((select jsonb_agg(jsonb_build_object('allocationId', a.id, 'name', p.name, 'nickname', p.nickname, 'lead', a.public_lead, 'powerFloor', a.public_power_floor) order by a.created_at) from pokemon_rank_allocations a join profiles p on p.id = a.defender_id where a.season_id = v_season and a.allocated_on = v_today and a.attacker_id = v_user and a.status = 'available'), '[]'::jsonb),
    'battles', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'opponentName', case when b.attacker_id = v_user then p_defender.name else p_attacker.name end, 'winnerId', b.winner_id, 'attackerDelta', b.attacker_delta, 'defenderDelta', b.defender_delta, 'createdAt', b.created_at) order by b.created_at desc) from pokemon_rank_battles b join profiles p_attacker on p_attacker.id = b.attacker_id join profiles p_defender on p_defender.id = b.defender_id where b.season_id = v_season and v_user in (b.attacker_id, b.defender_id)), '[]'::jsonb),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('rank', final_rank, 'name', name, 'nickname', nickname, 'rating', rating) order by final_rank, name) from (select p.name, p.nickname, e.rating, rank() over (order by e.rating desc) as final_rank from pokemon_rank_entries e join profiles p on p.id = e.user_id where e.season_id = v_season order by e.rating desc, p.name limit 20) ranked), '[]'::jsonb)
  );
end $$;

revoke execute on function public.pokedex_rank_join() from public, anon;
revoke execute on function public.pokedex_rank_save_preset(text, smallint, uuid[]) from public, anon;
revoke execute on function public.pokedex_rank_activate_defense(smallint) from public, anon;
revoke execute on function public.pokedex_rank_reroll() from public, anon;
revoke execute on function public.pokedex_rank_start_battle(uuid, smallint) from public, anon;
revoke execute on function public.pokedex_rank_battle_detail(uuid) from public, anon;
revoke execute on function public.pokedex_rank_state() from public, anon;
revoke execute on function public.pokedex_rank_refresh_daily() from public, anon, authenticated;
grant execute on function public.pokedex_rank_join() to authenticated;
grant execute on function public.pokedex_rank_save_preset(text, smallint, uuid[]) to authenticated;
grant execute on function public.pokedex_rank_activate_defense(smallint) to authenticated;
grant execute on function public.pokedex_rank_reroll() to authenticated;
grant execute on function public.pokedex_rank_start_battle(uuid, smallint) to authenticated;
grant execute on function public.pokedex_rank_battle_detail(uuid) to authenticated;
grant execute on function public.pokedex_rank_state() to authenticated;
