-- 활성 공격 프리셋("마이 파티"). 방어(active_defense_slot)와 대칭을 맞춘다.
-- 방어는 다음 날 06:00부터 반영되지만, 공격 덱은 규칙상 저장 즉시 적용이라 지연이 없다.
alter table public.pokemon_rank_entries
  add column if not exists active_attack_slot smallint check (active_attack_slot between 1 and 3);

create or replace function public.pokedex_rank_activate_attack(p_slot smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_season uuid := pokedex_rank_current_season();
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  if p_slot is null or p_slot not between 1 and 3 then raise exception 'INVALID_INPUT'; end if;
  if jsonb_array_length(pokedex_rank_preset_team(v_season, v_user, 'attack', p_slot)) <> 3 then raise exception 'INVALID_RANKING_TEAM'; end if;
  update pokemon_rank_entries
  set active_attack_slot = p_slot
  where season_id = v_season and user_id = v_user;
  if not found then raise exception 'RANKING_NOT_JOINED'; end if;
end $$;

revoke execute on function public.pokedex_rank_activate_attack(smallint) from public, anon;
grant execute on function public.pokedex_rank_activate_attack(smallint) to authenticated;

-- entry에 activeAttackSlot을 더한다. 나머지 필드는 0084 그대로다.
create or replace function public.pokedex_rank_state()
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
    'entry', (select jsonb_build_object('rating', rating, 'matches', matches, 'attacks', attacks, 'attacksToday', (select count(*) from pokemon_rank_battles b where b.season_id = v_season and b.attacker_id = v_user and (b.created_at at time zone 'Asia/Seoul')::date = v_today), 'wins', wins, 'activeDefenseSlot', active_defense_slot, 'activeAttackSlot', active_attack_slot, 'defenseEffectiveOn', defense_effective_on, 'rerolled', rerolled_on = v_today, 'rank', (select r.final_rank from (select e.user_id, rank() over (order by e.rating desc) as final_rank from pokemon_rank_entries e where e.season_id = v_season) r where r.user_id = v_user)) from pokemon_rank_entries where season_id = v_season and user_id = v_user),
    'ownedPokemon', coalesce((select jsonb_agg(jsonb_build_object('throwId', t.id, 'pokemonId', c.id, 'name', c.name_ko, 'imagePath', c.image_path, 'combatPower', a.combat_power, 'battleType', c.battle_type, 'rarity', c.rarity) order by a.combat_power desc) from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id join pokemon_catalog c on c.id = t.pokemon_id where t.user_id = v_user and t.outcome = 'caught' and a.combat_power is not null), '[]'::jsonb),
    'presets', coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'slot', p.slot, 'members', pokedex_rank_preset_team(v_season, v_user, p.kind, p.slot)) order by p.kind, p.slot) from pokemon_rank_presets p where p.season_id = v_season and p.user_id = v_user), '[]'::jsonb),
    'opponents', coalesce((select jsonb_agg(jsonb_build_object('allocationId', a.id, 'name', p.name, 'nickname', p.nickname, 'avatarPath', p.avatar_path, 'partyType', (select case when count(distinct item ->> 'battleType') = 1 then min(item ->> 'battleType') else 'mixed' end from jsonb_array_elements(a.defender_team) item), 'lead', a.public_lead, 'powerFloor', a.public_power_floor) order by a.created_at) from pokemon_rank_allocations a join profiles p on p.id = a.defender_id where a.season_id = v_season and a.allocated_on = v_today and a.attacker_id = v_user and a.status = 'available'), '[]'::jsonb),
    'battles', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'role', case when b.attacker_id = v_user then 'attacker' else 'defender' end, 'opponentName', case when b.attacker_id = v_user then p_defender.name else p_attacker.name end, 'opponentNickname', case when b.attacker_id = v_user then p_defender.nickname else p_attacker.nickname end, 'winnerId', b.winner_id, 'attackerDelta', b.attacker_delta, 'defenderDelta', b.defender_delta, 'createdAt', b.created_at) order by b.created_at desc) from pokemon_rank_battles b join profiles p_attacker on p_attacker.id = b.attacker_id join profiles p_defender on p_defender.id = b.defender_id where b.season_id = v_season and v_user in (b.attacker_id, b.defender_id)), '[]'::jsonb),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('rank', final_rank, 'userId', user_id, 'name', name, 'nickname', nickname, 'rating', rating) order by final_rank, name) from (select p.id as user_id, p.name, p.nickname, e.rating, rank() over (order by e.rating desc) as final_rank from pokemon_rank_entries e join profiles p on p.id = e.user_id where e.season_id = v_season order by e.rating desc, p.name limit 20) ranked), '[]'::jsonb)
  );
end $$;
