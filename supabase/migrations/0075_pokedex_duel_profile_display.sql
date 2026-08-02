create or replace function public.pokedex_duel_accept(p_duel uuid, p_throw uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  d pokemon_duels%rowtype;
  v_challenger_cp int;
  v_opponent_cp int;
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
  select a.combat_power into v_opponent_cp
  from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id
  where t.id = p_throw and t.user_id = v_user and t.outcome = 'caught';
  if v_opponent_cp is null then raise exception 'FORBIDDEN'; end if;
  select a.combat_power into v_challenger_cp
  from pokemon_throws t join pokemon_appearances a on a.id = t.appearance_id
  where t.id = d.challenger_throw_id and t.outcome = 'caught';
  if v_challenger_cp is null then raise exception 'INVALID_INPUT'; end if;

  v_challenger_score := floor(v_challenger_cp * (90 + floor(random() * 21)) / 100.0)::int;
  v_opponent_score := floor(v_opponent_cp * (90 + floor(random() * 21)) / 100.0)::int;
  v_winner := case
    when v_challenger_score > v_opponent_score then d.challenger_id
    when v_opponent_score > v_challenger_score then d.opponent_id
    when random() < 0.5 then d.challenger_id
    else d.opponent_id
  end;

  update pokemon_duels
  set opponent_throw_id = p_throw, status = 'accepted', challenger_score = v_challenger_score,
      opponent_score = v_opponent_score, winner_id = v_winner, resolved_at = now()
  where id = d.id;

  return (
    select jsonb_build_object(
      'id', d.id,
      'winner_id', v_winner,
      'challenger', jsonb_build_object('user_id', d.challenger_id, 'name', challenger.name, 'nickname', challenger.nickname, 'avatar_path', challenger.avatar_path, 'pokemon_name', challenger_pokemon.name_ko, 'image_path', challenger_pokemon.image_path, 'combat_power', v_challenger_cp, 'score', v_challenger_score),
      'opponent', jsonb_build_object('user_id', d.opponent_id, 'name', opponent.name, 'nickname', opponent.nickname, 'avatar_path', opponent.avatar_path, 'pokemon_name', opponent_pokemon.name_ko, 'image_path', opponent_pokemon.image_path, 'combat_power', v_opponent_cp, 'score', v_opponent_score)
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
