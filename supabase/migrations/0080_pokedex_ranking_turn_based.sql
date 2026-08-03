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
    v_defender_hp[v_defender_index + 1] := greatest(0, v_defender_hp[v_defender_index + 1] - v_damage);
    v_counter_damage := 0;
    if v_defender_hp[v_defender_index + 1] > 0 then
      v_counter_damage := floor((200 + v_defender_cp * 0.4) * pokedex_rank_type_multiplier(v_defender ->> 'battleType', v_attacker ->> 'battleType') * v_defender_mono * (0.95 + random() * 0.10))::int;
      v_attacker_hp[v_attacker_index + 1] := greatest(0, v_attacker_hp[v_attacker_index + 1] - v_counter_damage);
    end if;
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
  if v_defender_index >= 3 then v_winner := v_user;
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
