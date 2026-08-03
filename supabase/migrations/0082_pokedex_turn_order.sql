alter table public.pokemon_duels
  add column first_turn_user_id uuid references public.profiles(id) on delete restrict,
  add column battle_log jsonb,
  add check (first_turn_user_id is null or first_turn_user_id in (challenger_id, opponent_id)),
  add check (battle_log is null or jsonb_typeof(battle_log) = 'array');

alter table public.pokemon_rank_battles
  add column first_turn_user_id uuid references public.profiles(id) on delete restrict;

create or replace function public.pokedex_duel_accept(p_duel uuid, p_throw uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  d pokemon_duels%rowtype;
  v_challenger_cp int;
  v_opponent_cp int;
  v_challenger_type text;
  v_opponent_type text;
  v_challenger_hp int;
  v_opponent_hp int;
  v_first_turn_user uuid;
  v_turn_side text;
  v_damage int;
  v_log jsonb := '[]'::jsonb;
  v_winner uuid;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from profiles where id = v_user and status = 'active';
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into d from pokemon_duels where id = p_duel for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.opponent_id <> v_user then raise exception 'FORBIDDEN'; end if;
  if d.status <> 'pending' then raise exception 'INVALID_INPUT'; end if;

  select a.combat_power, p.battle_type into v_opponent_cp, v_opponent_type
  from pokemon_throws t
  join pokemon_appearances a on a.id = t.appearance_id
  join pokemon_catalog p on p.id = t.pokemon_id
  where t.id = p_throw and t.user_id = v_user and t.outcome = 'caught';
  if v_opponent_cp is null then raise exception 'FORBIDDEN'; end if;
  select a.combat_power, p.battle_type into v_challenger_cp, v_challenger_type
  from pokemon_throws t
  join pokemon_appearances a on a.id = t.appearance_id
  join pokemon_catalog p on p.id = t.pokemon_id
  where t.id = d.challenger_throw_id and t.outcome = 'caught';
  if v_challenger_cp is null then raise exception 'INVALID_INPUT'; end if;

  v_challenger_hp := 1000 + v_challenger_cp;
  v_opponent_hp := 1000 + v_opponent_cp;
  v_first_turn_user := case when random() < 0.5 then d.challenger_id else d.opponent_id end;
  v_turn_side := case when v_first_turn_user = d.challenger_id then 'challenger' else 'opponent' end;

  while v_challenger_hp > 0 and v_opponent_hp > 0 loop
    if v_turn_side = 'challenger' then
      v_damage := floor((200 + v_challenger_cp * 0.4) * pokedex_rank_type_multiplier(v_challenger_type, v_opponent_type) * 1.1 * (0.95 + random() * 0.10))::int;
      v_opponent_hp := greatest(0, v_opponent_hp - v_damage);
    else
      v_damage := floor((200 + v_opponent_cp * 0.4) * pokedex_rank_type_multiplier(v_opponent_type, v_challenger_type) * 1.1 * (0.95 + random() * 0.10))::int;
      v_challenger_hp := greatest(0, v_challenger_hp - v_damage);
    end if;
    v_log := v_log || jsonb_build_array(jsonb_build_object(
      'actor', v_turn_side, 'damage', v_damage,
      'challengerHealth', v_challenger_hp, 'opponentHealth', v_opponent_hp
    ));
    v_turn_side := case when v_turn_side = 'challenger' then 'opponent' else 'challenger' end;
  end loop;

  v_winner := case when v_challenger_hp > 0 then d.challenger_id else d.opponent_id end;
  update pokemon_duels
  set opponent_throw_id = p_throw, status = 'accepted', challenger_score = v_challenger_cp,
      opponent_score = v_opponent_cp, winner_id = v_winner, resolved_at = now(),
      first_turn_user_id = v_first_turn_user, battle_log = v_log
  where id = d.id;

  return (
    select jsonb_build_object(
      'id', d.id, 'winner_id', v_winner, 'first_turn_user_id', v_first_turn_user, 'battle_log', v_log,
      'challenger', jsonb_build_object('user_id', d.challenger_id, 'name', challenger.name, 'nickname', challenger.nickname, 'avatar_path', challenger.avatar_path, 'battle_type', v_challenger_type, 'pokemon_name', challenger_pokemon.name_ko, 'image_path', challenger_pokemon.image_path, 'combat_power', v_challenger_cp),
      'opponent', jsonb_build_object('user_id', d.opponent_id, 'name', opponent.name, 'nickname', opponent.nickname, 'avatar_path', opponent.avatar_path, 'battle_type', v_opponent_type, 'pokemon_name', opponent_pokemon.name_ko, 'image_path', opponent_pokemon.image_path, 'combat_power', v_opponent_cp)
    )
    from profiles challenger
    join profiles opponent on opponent.id = d.opponent_id
    join pokemon_throws challenger_throw on challenger_throw.id = d.challenger_throw_id
    join pokemon_catalog challenger_pokemon on challenger_pokemon.id = challenger_throw.pokemon_id
    join pokemon_throws opponent_throw on opponent_throw.id = p_throw
    join pokemon_catalog opponent_pokemon on opponent_pokemon.id = opponent_throw.pokemon_id
    where challenger.id = d.challenger_id
  );
end $$;

drop function public.pokedex_duel_list();

create function public.pokedex_duel_list()
returns table (
  id uuid, status text, created_at timestamptz, resolved_at timestamptz, winner_id uuid, first_turn_user_id uuid, battle_log jsonb,
  challenger_id uuid, challenger_name text, challenger_nickname text, challenger_avatar_path text, challenger_pokemon_name text, challenger_image_path text, challenger_battle_type text, challenger_combat_power int, challenger_score int,
  opponent_id uuid, opponent_name text, opponent_nickname text, opponent_avatar_path text, opponent_pokemon_name text, opponent_image_path text, opponent_battle_type text, opponent_combat_power int, opponent_score int
)
language sql stable security definer set search_path = public as $$
  select d.id, d.status, d.created_at, d.resolved_at, d.winner_id, d.first_turn_user_id, d.battle_log,
    d.challenger_id, challenger.name, challenger.nickname, challenger.avatar_path, challenger_pokemon.name_ko, challenger_pokemon.image_path, challenger_pokemon.battle_type, challenger_appearance.combat_power, d.challenger_score,
    d.opponent_id, opponent.name, opponent.nickname, opponent.avatar_path, opponent_pokemon.name_ko, opponent_pokemon.image_path, opponent_pokemon.battle_type, opponent_appearance.combat_power, d.opponent_score
  from pokemon_duels d
  join profiles challenger on challenger.id = d.challenger_id
  join pokemon_throws challenger_throw on challenger_throw.id = d.challenger_throw_id
  join pokemon_catalog challenger_pokemon on challenger_pokemon.id = challenger_throw.pokemon_id
  join pokemon_appearances challenger_appearance on challenger_appearance.id = challenger_throw.appearance_id
  join profiles opponent on opponent.id = d.opponent_id
  left join pokemon_throws opponent_throw on opponent_throw.id = d.opponent_throw_id
  left join pokemon_catalog opponent_pokemon on opponent_pokemon.id = opponent_throw.pokemon_id
  left join pokemon_appearances opponent_appearance on opponent_appearance.id = opponent_throw.appearance_id
  where auth.uid() in (d.challenger_id, d.opponent_id)
  order by d.created_at desc;
$$;

revoke execute on function public.pokedex_duel_list() from public, anon;
grant execute on function public.pokedex_duel_list() to authenticated;

create or replace function public.pokedex_rank_start_battle(p_allocation uuid, p_attack_slot smallint)
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
  v_attacker_mono numeric := 1.0;
  v_defender_mono numeric := 1.0;
  v_first_turn_user uuid;
  v_turn_side text;
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
    return jsonb_build_object('id', v_existing.id, 'winnerId', v_existing.winner_id, 'firstTurnUserId', v_existing.first_turn_user_id, 'battleLog', v_existing.battle_log, 'attackerDelta', v_existing.attacker_delta, 'defenderDelta', v_existing.defender_delta);
  end if;
  select * into a from pokemon_rank_allocations where id = p_allocation for update;
  select * into v_existing from pokemon_rank_battles where allocation_id = p_allocation;
  if found then
    if v_existing.attacker_id <> v_user then raise exception 'FORBIDDEN'; end if;
    return jsonb_build_object('id', v_existing.id, 'winnerId', v_existing.winner_id, 'firstTurnUserId', v_existing.first_turn_user_id, 'battleLog', v_existing.battle_log, 'attackerDelta', v_existing.attacker_delta, 'defenderDelta', v_existing.defender_delta);
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
  v_first_turn_user := case when random() < 0.5 then v_user else a.defender_id end;
  v_turn_side := case when v_first_turn_user = v_user then 'attacker' else 'defender' end;

  while v_attacker_index < 3 and v_defender_index < 3 loop
    v_attacker := v_attacker_team -> v_attacker_index;
    v_defender := v_defender_team -> v_defender_index;
    v_attacker_cp := (v_attacker ->> 'combatPower')::int;
    v_defender_cp := (v_defender ->> 'combatPower')::int;
    if v_turn_side = 'attacker' then
      v_damage := floor((200 + v_attacker_cp * 0.4) * pokedex_rank_type_multiplier(v_attacker ->> 'battleType', v_defender ->> 'battleType') * v_attacker_mono * (0.95 + random() * 0.10))::int;
      v_defender_hp[v_defender_index + 1] := greatest(0, v_defender_hp[v_defender_index + 1] - v_damage);
    else
      v_damage := floor((200 + v_defender_cp * 0.4) * pokedex_rank_type_multiplier(v_defender ->> 'battleType', v_attacker ->> 'battleType') * v_defender_mono * (0.95 + random() * 0.10))::int;
      v_attacker_hp[v_attacker_index + 1] := greatest(0, v_attacker_hp[v_attacker_index + 1] - v_damage);
    end if;
    v_log := v_log || jsonb_build_array(jsonb_build_object(
      'actor', v_turn_side, 'attackerIndex', v_attacker_index, 'defenderIndex', v_defender_index,
      'attackerDamage', case when v_turn_side = 'attacker' then v_damage else 0 end,
      'defenderDamage', case when v_turn_side = 'defender' then v_damage else 0 end,
      'attackerHealth', v_attacker_hp[v_attacker_index + 1], 'defenderHealth', v_defender_hp[v_defender_index + 1],
      'attackerTypeMultiplier', pokedex_rank_type_multiplier(v_attacker ->> 'battleType', v_defender ->> 'battleType'),
      'defenderTypeMultiplier', pokedex_rank_type_multiplier(v_defender ->> 'battleType', v_attacker ->> 'battleType'),
      'attackerMonoMultiplier', v_attacker_mono, 'defenderMonoMultiplier', v_defender_mono
    ));
    if v_attacker_hp[v_attacker_index + 1] = 0 then v_attacker_index := v_attacker_index + 1; end if;
    if v_defender_hp[v_defender_index + 1] = 0 then v_defender_index := v_defender_index + 1; end if;
    v_turn_side := case when v_turn_side = 'attacker' then 'defender' else 'attacker' end;
  end loop;
  v_winner := case when v_defender_index >= 3 then v_user else a.defender_id end;
  if v_winner = v_user then v_attacker_delta := 30; v_defender_delta := -10;
  else v_attacker_delta := -30; v_defender_delta := 10;
  end if;
  insert into pokemon_rank_battles (season_id, allocation_id, attacker_id, defender_id, attacker_team, defender_team, battle_log, winner_id, attacker_delta, defender_delta, first_turn_user_id)
  values (v_season, a.id, v_user, a.defender_id, v_attacker_team, v_defender_team, v_log, v_winner, v_attacker_delta, v_defender_delta, v_first_turn_user)
  returning id into v_battle;
  update pokemon_rank_allocations set status = 'used' where id = a.id;
  update pokemon_rank_entries set rating = greatest(0, rating + v_attacker_delta), matches = matches + 1, attacks = attacks + 1, wins = wins + case when v_winner = v_user then 1 else 0 end where season_id = v_season and user_id = v_user;
  update pokemon_rank_entries set rating = greatest(0, rating + v_defender_delta), matches = matches + 1, wins = wins + case when v_winner = a.defender_id then 1 else 0 end where season_id = v_season and user_id = a.defender_id;
  return jsonb_build_object('id', v_battle, 'winnerId', v_winner, 'firstTurnUserId', v_first_turn_user, 'battleLog', v_log, 'attackerDelta', v_attacker_delta, 'defenderDelta', v_defender_delta);
end $$;

create or replace function public.pokedex_rank_battle_detail(p_battle uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  b pokemon_rank_battles%rowtype;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  select * into b from pokemon_rank_battles where id = p_battle;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.attacker_id <> v_user and b.defender_id <> v_user then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object('id', b.id, 'attackerId', b.attacker_id, 'defenderId', b.defender_id, 'firstTurnUserId', b.first_turn_user_id, 'attackerTeam', b.attacker_team, 'defenderTeam', b.defender_team, 'battleLog', b.battle_log, 'winnerId', b.winner_id, 'attackerDelta', b.attacker_delta, 'defenderDelta', b.defender_delta, 'createdAt', b.created_at);
end $$;
