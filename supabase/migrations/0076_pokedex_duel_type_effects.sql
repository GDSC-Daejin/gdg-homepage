alter table public.pokemon_catalog
  add column battle_type text not null default 'normal' check (battle_type in ('normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'fairy', 'steel'));

update public.pokemon_catalog
set battle_type = case
  when pokedex_no in (1,2,3,43,44,45,46,47,69,70,71,102,103,114) then 'grass'
  when pokedex_no in (4,5,6,37,38,58,59,77,78,126,136,146) then 'fire'
  when pokedex_no in (7,8,9,54,55,60,61,62,72,73,79,80,86,90,98,99,116,117,118,119,120,129,130,134) then 'water'
  when pokedex_no in (10,11,12,13,14,15,48,49,127) then 'bug'
  when pokedex_no in (16,17,18,21,22,41,42,83,84,85,123,142) then 'flying'
  when pokedex_no in (23,24,29,30,32,33,88,89,109,110) then 'poison'
  when pokedex_no in (25,26,100,101,125,135,145) then 'electric'
  when pokedex_no in (27,28,31,34,50,51,104,105,111,112) then 'ground'
  when pokedex_no in (35,36,39,40,122) then 'fairy'
  when pokedex_no in (56,57,66,67,68,106,107) then 'fighting'
  when pokedex_no in (63,64,65,96,97,121,150,151) then 'psychic'
  when pokedex_no in (74,75,76,95,138,139,140,141) then 'rock'
  when pokedex_no in (81,82) then 'steel'
  when pokedex_no in (87,91,124,131,144) then 'ice'
  when pokedex_no in (92,93,94) then 'ghost'
  when pokedex_no in (147,148,149) then 'dragon'
  else 'normal'
end;

create or replace function public.pokedex_duel_accept(p_duel uuid, p_throw uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  d pokemon_duels%rowtype;
  v_challenger_cp int;
  v_opponent_cp int;
  v_challenger_type text;
  v_opponent_type text;
  v_challenger_score int;
  v_opponent_score int;
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
  from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id join pokemon_catalog p on p.id = t.pokemon_id
  where t.id = p_throw and t.user_id = v_user and t.outcome = 'caught';
  if v_opponent_cp is null then raise exception 'FORBIDDEN'; end if;
  select a.combat_power, p.battle_type into v_challenger_cp, v_challenger_type
  from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id join pokemon_catalog p on p.id = t.pokemon_id
  where t.id = d.challenger_throw_id and t.outcome = 'caught';
  if v_challenger_cp is null then raise exception 'INVALID_INPUT'; end if;

  v_challenger_score := floor(v_challenger_cp * (90 + floor(random() * 21)) / 100.0)::int;
  v_opponent_score := floor(v_opponent_cp * (90 + floor(random() * 21)) / 100.0)::int;
  v_winner := case when v_challenger_score > v_opponent_score then d.challenger_id when v_opponent_score > v_challenger_score then d.opponent_id when random() < 0.5 then d.challenger_id else d.opponent_id end;
  update pokemon_duels set opponent_throw_id = p_throw, status = 'accepted', challenger_score = v_challenger_score, opponent_score = v_opponent_score, winner_id = v_winner, resolved_at = now() where id = d.id;

  return (
    select jsonb_build_object(
      'id', d.id, 'winner_id', v_winner,
      'challenger', jsonb_build_object('user_id', d.challenger_id, 'name', challenger.name, 'nickname', challenger.nickname, 'avatar_path', challenger.avatar_path, 'battle_type', v_challenger_type, 'pokemon_name', challenger_pokemon.name_ko, 'image_path', challenger_pokemon.image_path, 'combat_power', v_challenger_cp, 'score', v_challenger_score),
      'opponent', jsonb_build_object('user_id', d.opponent_id, 'name', opponent.name, 'nickname', opponent.nickname, 'avatar_path', opponent.avatar_path, 'battle_type', v_opponent_type, 'pokemon_name', opponent_pokemon.name_ko, 'image_path', opponent_pokemon.image_path, 'combat_power', v_opponent_cp, 'score', v_opponent_score)
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
