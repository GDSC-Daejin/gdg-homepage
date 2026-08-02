create or replace function public.pokedex_throw_ball(p_slack_user text, p_message_ts text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_user uuid;
  v_appearance pokemon_appearances%rowtype;
  v_pokemon pokemon_catalog%rowtype;
  v_quantity int;
  v_outcome text;
begin
  select id into v_user from profiles where slack_user_id = p_slack_user;
  if v_user is null then return jsonb_build_object('processed', false, 'reason', 'unlinked'); end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || v_today::text));

  select * into v_appearance from pokemon_appearances where message_ts = p_message_ts;
  if not found then return jsonb_build_object('processed', false, 'reason', 'invalid'); end if;
  select * into v_pokemon from pokemon_catalog where id = v_appearance.pokemon_id;
  if v_appearance.status <> 'posted' or v_appearance.ends_at <= now() then
    return jsonb_build_object('processed', false, 'reason', 'expired', 'pokemon_name', v_pokemon.name_ko);
  end if;

  select quantity into v_quantity from pokemon_ball_inventory
    where user_id = v_user and ball_slug = 'poke_ball' for update;
  if coalesce(v_quantity, 0) = 0 then return jsonb_build_object('processed', false, 'reason', 'no_ball'); end if;

  update pokemon_ball_inventory set quantity = quantity - 1
    where user_id = v_user and ball_slug = 'poke_ball';
  v_outcome := case when random() < v_pokemon.catch_rate then 'caught' else 'escaped' end;
  insert into pokemon_throws (user_id, appearance_id, pokemon_id, ball_slug, attempted_on, outcome)
    values (v_user, v_appearance.id, v_pokemon.id, 'poke_ball', v_today, v_outcome);
  return jsonb_build_object('processed', true, 'outcome', v_outcome, 'pokemon_name', v_pokemon.name_ko, 'remaining_balls', v_quantity - 1);
end $$;

revoke execute on function public.pokedex_throw_ball(text, text) from public, anon, authenticated;
