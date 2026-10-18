-- 랭킹전 베타(2026-10-16~18) 전에 막힘·정합성 문제를 고친다. 점수·전투 규칙은 바꾸지 않는다.
--   1) 게임일을 KST 06:00 기준으로 맞춘다. 화면·설계는 "매일 06:00 갱신"인데 DB는 자정에 날짜가 바뀌어
--      상대·공격 횟수가 자정에 초기화됐다. 공격 횟수·리롤 검사도 같은 게임일 함수로 센다.
--   2) start_battle: 두 번째 `select into v_existing`이 FOUND를 false로 덮어써 새 전투가 항상
--      RANKING_BATTLE_UNAVAILABLE로 끝났다. 할당 존재 여부는 a.id로 확인한다.
--      반환값에 양측 팀·당사자 id·시각을 넣어 전투 재생 화면이 상세 조회 없이 그릴 수 있게 한다.
--   3) allocate_for: 같은 회원의 동시 조회는 공격자 잠금으로 줄 세워 3명을 넘겨 배정하지 않고,
--      그래도 같은 상대가 겹치면 중복 키 오류 대신 건너뛴다. (상태 RPC가 실패하면 화면 전체가 막힌다.)
--   4) reroll: 새로 배정할 상대가 없으면 기존 상대를 지우지 않고 거절한다(트랜잭션이 되돌린다).

create function public.pokedex_rank_game_day(p_at timestamptz)
returns date language sql stable set search_path = public as $$
  select ((p_at at time zone 'Asia/Seoul') - interval '6 hours')::date;
$$;

create or replace function public.pokedex_rank_kst_today()
returns date language sql stable set search_path = public as $$
  select pokedex_rank_game_day(now());
$$;

revoke execute on function public.pokedex_rank_game_day(timestamptz) from public, anon, authenticated;
revoke execute on function public.pokedex_rank_kst_today() from public, anon, authenticated;

create or replace function public.pokedex_rank_allocate_for(p_season uuid, p_today date, p_attacker uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_rating int;
  v_candidate record;
  v_team jsonb;
  v_count int;
  v_remaining int;
begin
  -- 같은 회원의 동시 조회가 각자 3명씩 넣지 않도록 공격자 단위로 줄 세운다.
  perform pg_advisory_xact_lock(hashtext('rank-attacker:' || p_season::text || p_today::text || p_attacker::text));
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
    )
    on conflict (season_id, allocated_on, attacker_id, defender_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $$;

create or replace function public.pokedex_rank_reroll()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
  v_today date := pokedex_rank_kst_today();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from pokemon_rank_entries where season_id = v_season and user_id = v_user and rerolled_on is distinct from v_today for update;
  if not found then raise exception 'RANKING_REROLL_UNAVAILABLE'; end if;
  if exists (select 1 from pokemon_rank_battles where season_id = v_season and attacker_id = v_user and pokedex_rank_game_day(created_at) = v_today) then
    raise exception 'RANKING_REROLL_UNAVAILABLE';
  end if;
  update pokemon_rank_allocations set status = 'rerolled'
  where season_id = v_season and allocated_on = v_today and attacker_id = v_user and status = 'available';
  update pokemon_rank_entries set rerolled_on = v_today where season_id = v_season and user_id = v_user;
  -- 새 상대가 한 명도 없으면 예외로 위 변경까지 되돌려 기존 상대를 지킨다.
  if pokedex_rank_allocate_for(v_season, v_today, v_user) = 0 then raise exception 'RANKING_REROLL_NO_CANDIDATES'; end if;
end $$;

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
  v_created timestamptz;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  if p_allocation is null or p_attack_slot is null or p_attack_slot not between 1 and 3 then raise exception 'INVALID_INPUT'; end if;
  select * into v_existing from pokemon_rank_battles where allocation_id = p_allocation;
  if found then
    if v_existing.attacker_id <> v_user then raise exception 'FORBIDDEN'; end if;
    return jsonb_build_object('id', v_existing.id, 'attackerId', v_existing.attacker_id, 'defenderId', v_existing.defender_id, 'firstTurnUserId', v_existing.first_turn_user_id, 'attackerTeam', v_existing.attacker_team, 'defenderTeam', v_existing.defender_team, 'battleLog', v_existing.battle_log, 'winnerId', v_existing.winner_id, 'attackerDelta', v_existing.attacker_delta, 'defenderDelta', v_existing.defender_delta, 'createdAt', v_existing.created_at);
  end if;
  select * into a from pokemon_rank_allocations where id = p_allocation for update;
  select * into v_existing from pokemon_rank_battles where allocation_id = p_allocation;
  if found then
    if v_existing.attacker_id <> v_user then raise exception 'FORBIDDEN'; end if;
    return jsonb_build_object('id', v_existing.id, 'attackerId', v_existing.attacker_id, 'defenderId', v_existing.defender_id, 'firstTurnUserId', v_existing.first_turn_user_id, 'attackerTeam', v_existing.attacker_team, 'defenderTeam', v_existing.defender_team, 'battleLog', v_existing.battle_log, 'winnerId', v_existing.winner_id, 'attackerDelta', v_existing.attacker_delta, 'defenderDelta', v_existing.defender_delta, 'createdAt', v_existing.created_at);
  end if;
  -- FOUND는 바로 위 v_existing 조회 결과라 할당이 없는지는 a.id로 본다.
  if a.id is null or a.season_id <> v_season or a.attacker_id <> v_user or a.allocated_on <> v_today or a.status <> 'available' then raise exception 'RANKING_BATTLE_UNAVAILABLE'; end if;
  perform 1 from pokemon_rank_entries where season_id = v_season and user_id = v_user for update;
  if not found then raise exception 'RANKING_NOT_JOINED'; end if;
  if (select count(*) from pokemon_rank_battles where season_id = v_season and attacker_id = v_user and pokedex_rank_game_day(created_at) = v_today) >= 3 then raise exception 'RANKING_BATTLE_UNAVAILABLE'; end if;
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
  returning id, created_at into v_battle, v_created;
  update pokemon_rank_allocations set status = 'used' where id = a.id;
  update pokemon_rank_entries set rating = greatest(0, rating + v_attacker_delta), matches = matches + 1, attacks = attacks + 1, wins = wins + case when v_winner = v_user then 1 else 0 end where season_id = v_season and user_id = v_user;
  update pokemon_rank_entries set rating = greatest(0, rating + v_defender_delta), matches = matches + 1, wins = wins + case when v_winner = a.defender_id then 1 else 0 end where season_id = v_season and user_id = a.defender_id;
  return jsonb_build_object('id', v_battle, 'attackerId', v_user, 'defenderId', a.defender_id, 'firstTurnUserId', v_first_turn_user, 'attackerTeam', v_attacker_team, 'defenderTeam', v_defender_team, 'battleLog', v_log, 'winnerId', v_winner, 'attackerDelta', v_attacker_delta, 'defenderDelta', v_defender_delta, 'createdAt', v_created);
end $$;

create or replace function public.pokedex_rank_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
  v_today date := pokedex_rank_kst_today();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform pokedex_rank_allocate_for(v_season, v_today, v_user);
  return jsonb_build_object(
    'eligible', (select count(distinct t.pokemon_id) >= 6 from pokemon_throws t where t.user_id = v_user and t.outcome = 'caught'),
    'season', (select jsonb_build_object('id', id, 'startsAt', starts_at, 'endsAt', ends_at) from pokemon_rank_seasons where id = v_season),
    'entry', (select jsonb_build_object('rating', rating, 'matches', matches, 'attacks', attacks, 'attacksToday', (select count(*) from pokemon_rank_battles b where b.season_id = v_season and b.attacker_id = v_user and pokedex_rank_game_day(b.created_at) = v_today), 'wins', wins, 'activeDefenseSlot', active_defense_slot, 'activeAttackSlot', active_attack_slot, 'defenseEffectiveOn', defense_effective_on, 'rerolled', rerolled_on = v_today, 'rank', (select r.final_rank from (select member_id, rank() over (order by rating desc) as final_rank from (select p.id as member_id, coalesce(e.rating, 1000) as rating from profiles p left join pokemon_rank_entries e on e.user_id = p.id and e.season_id = v_season where p.status = 'active' and p.approved_at is not null and p.role in ('member', 'organizer', 'team_member')) members) r where r.member_id = v_user)) from pokemon_rank_entries where season_id = v_season and user_id = v_user),
    'ownedPokemon', coalesce((select jsonb_agg(jsonb_build_object('throwId', t.id, 'pokemonId', c.id, 'name', c.name_ko, 'imagePath', c.image_path, 'combatPower', a.combat_power, 'battleType', c.battle_type, 'rarity', c.rarity) order by a.combat_power desc) from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id join pokemon_catalog c on c.id = t.pokemon_id where t.user_id = v_user and t.outcome = 'caught' and a.combat_power is not null), '[]'::jsonb),
    'presets', coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'slot', p.slot, 'members', pokedex_rank_preset_team(v_season, v_user, p.kind, p.slot)) order by p.kind, p.slot) from pokemon_rank_presets p where p.season_id = v_season and p.user_id = v_user), '[]'::jsonb),
    'opponents', coalesce((select jsonb_agg(jsonb_build_object('allocationId', a.id, 'name', p.name, 'nickname', p.nickname, 'avatarPath', p.avatar_path, 'partyType', (select case when count(distinct item ->> 'battleType') = 1 then min(item ->> 'battleType') else 'mixed' end from jsonb_array_elements(a.defender_team) item), 'lead', a.public_lead, 'powerFloor', a.public_power_floor) order by a.created_at) from pokemon_rank_allocations a join profiles p on p.id = a.defender_id where a.season_id = v_season and a.allocated_on = v_today and a.attacker_id = v_user and a.status = 'available'), '[]'::jsonb),
    'battles', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'role', case when b.attacker_id = v_user then 'attacker' else 'defender' end, 'opponentName', case when b.attacker_id = v_user then p_defender.name else p_attacker.name end, 'opponentNickname', case when b.attacker_id = v_user then p_defender.nickname else p_attacker.nickname end, 'winnerId', b.winner_id, 'attackerDelta', b.attacker_delta, 'defenderDelta', b.defender_delta, 'createdAt', b.created_at) order by b.created_at desc) from pokemon_rank_battles b join profiles p_attacker on p_attacker.id = b.attacker_id join profiles p_defender on p_defender.id = b.defender_id where b.season_id = v_season and v_user in (b.attacker_id, b.defender_id)), '[]'::jsonb),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('rank', final_rank, 'userId', user_id, 'name', name, 'nickname', nickname, 'rating', rating) order by final_rank, name) from (select user_id, name, nickname, rating, rank() over (order by rating desc) as final_rank from (select p.id as user_id, p.name, p.nickname, coalesce(e.rating, 1000) as rating from profiles p left join pokemon_rank_entries e on e.user_id = p.id and e.season_id = v_season where p.status = 'active' and p.approved_at is not null and p.role in ('member', 'organizer', 'team_member')) members order by rating desc, name) ranked), '[]'::jsonb)
  );
end $$;

revoke execute on function public.pokedex_rank_allocate_for(uuid, date, uuid) from public, anon, authenticated;
