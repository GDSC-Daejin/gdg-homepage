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
    'entry', (select jsonb_build_object('rating', rating, 'matches', matches, 'attacks', attacks, 'attacksToday', (select count(*) from pokemon_rank_battles b where b.season_id = v_season and b.attacker_id = v_user and (b.created_at at time zone 'Asia/Seoul')::date = v_today), 'wins', wins, 'activeDefenseSlot', active_defense_slot, 'defenseEffectiveOn', defense_effective_on, 'rerolled', rerolled_on = v_today) from pokemon_rank_entries where season_id = v_season and user_id = v_user),
    'ownedPokemon', coalesce((select jsonb_agg(jsonb_build_object('throwId', t.id, 'pokemonId', c.id, 'name', c.name_ko, 'imagePath', c.image_path, 'combatPower', a.combat_power, 'battleType', c.battle_type, 'rarity', c.rarity) order by a.combat_power desc) from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id join pokemon_catalog c on c.id = t.pokemon_id where t.user_id = v_user and t.outcome = 'caught' and a.combat_power is not null), '[]'::jsonb),
    'presets', coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'slot', p.slot, 'members', pokedex_rank_preset_team(v_season, v_user, p.kind, p.slot)) order by p.kind, p.slot) from pokemon_rank_presets p where p.season_id = v_season and p.user_id = v_user), '[]'::jsonb),
    'opponents', coalesce((select jsonb_agg(jsonb_build_object('allocationId', a.id, 'name', p.name, 'nickname', p.nickname, 'avatarPath', p.avatar_path, 'partyType', (select case when count(distinct item ->> 'battleType') = 1 then min(item ->> 'battleType') else 'mixed' end from jsonb_array_elements(a.defender_team) item), 'lead', a.public_lead, 'powerFloor', a.public_power_floor) order by a.created_at) from pokemon_rank_allocations a join profiles p on p.id = a.defender_id where a.season_id = v_season and a.allocated_on = v_today and a.attacker_id = v_user and a.status = 'available'), '[]'::jsonb),
    'battles', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'opponentName', case when b.attacker_id = v_user then p_defender.name else p_attacker.name end, 'winnerId', b.winner_id, 'attackerDelta', b.attacker_delta, 'defenderDelta', b.defender_delta, 'createdAt', b.created_at) order by b.created_at desc) from pokemon_rank_battles b join profiles p_attacker on p_attacker.id = b.attacker_id join profiles p_defender on p_defender.id = b.defender_id where b.season_id = v_season and v_user in (b.attacker_id, b.defender_id)), '[]'::jsonb),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('rank', final_rank, 'name', name, 'nickname', nickname, 'rating', rating) order by final_rank, name) from (select p.name, p.nickname, e.rating, rank() over (order by e.rating desc) as final_rank from pokemon_rank_entries e join profiles p on p.id = e.user_id where e.season_id = v_season order by e.rating desc, p.name limit 20) ranked), '[]'::jsonb)
  );
end $$;
