create table public.pokemon_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete restrict,
  opponent_id uuid not null references public.profiles(id) on delete restrict,
  challenger_throw_id uuid not null references public.pokemon_throws(id) on delete restrict,
  opponent_throw_id uuid references public.pokemon_throws(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'canceled')),
  challenger_score int,
  opponent_score int,
  winner_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (challenger_id <> opponent_id),
  check (
    (status = 'pending' and opponent_throw_id is null and challenger_score is null and opponent_score is null and winner_id is null and resolved_at is null)
    or (status = 'accepted' and opponent_throw_id is not null and challenger_score is not null and opponent_score is not null and winner_id is not null and resolved_at is not null)
    or (status in ('rejected', 'canceled') and opponent_throw_id is null and challenger_score is null and opponent_score is null and winner_id is null and resolved_at is not null)
  )
);

create index pokemon_duels_participants_idx on public.pokemon_duels (challenger_id, opponent_id, created_at desc);

alter table public.pokemon_duels enable row level security;
revoke all on public.pokemon_duels from public, anon, authenticated;

create function public.pokedex_duel_members()
returns table (id uuid, name text, nickname text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select id, name, nickname, avatar_path
  from profiles
  where auth.uid() is not null and status = 'active' and id <> auth.uid()
  order by name, nickname;
$$;

create function public.pokedex_duel_create(p_opponent uuid, p_throw uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_duel uuid;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from profiles where id = v_user and status = 'active';
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_opponent = v_user then raise exception 'INVALID_INPUT'; end if;
  perform 1 from profiles where id = p_opponent and status = 'active';
  if not found then raise exception 'NOT_FOUND'; end if;
  perform 1
  from pokemon_throws t
  join pokemon_appearances a on a.id = t.appearance_id
  where t.id = p_throw and t.user_id = v_user and t.outcome = 'caught' and a.combat_power is not null;
  if not found then raise exception 'FORBIDDEN'; end if;

  insert into pokemon_duels (challenger_id, opponent_id, challenger_throw_id)
  values (v_user, p_opponent, p_throw)
  returning id into v_duel;
  return v_duel;
end $$;

create function public.pokedex_duel_accept(p_duel uuid, p_throw uuid)
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
      'challenger', jsonb_build_object('user_id', d.challenger_id, 'name', challenger.name, 'pokemon_name', challenger_pokemon.name_ko, 'image_path', challenger_pokemon.image_path, 'combat_power', v_challenger_cp, 'score', v_challenger_score),
      'opponent', jsonb_build_object('user_id', d.opponent_id, 'name', opponent.name, 'pokemon_name', opponent_pokemon.name_ko, 'image_path', opponent_pokemon.image_path, 'combat_power', v_opponent_cp, 'score', v_opponent_score)
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

create function public.pokedex_duel_reject(p_duel uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update pokemon_duels set status = 'rejected', resolved_at = now()
  where id = p_duel and opponent_id = auth.uid() and status = 'pending';
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create function public.pokedex_duel_cancel(p_duel uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update pokemon_duels set status = 'canceled', resolved_at = now()
  where id = p_duel and challenger_id = auth.uid() and status = 'pending';
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create function public.pokedex_duel_list()
returns table (
  id uuid, status text, created_at timestamptz, resolved_at timestamptz, winner_id uuid,
  challenger_id uuid, challenger_name text, challenger_pokemon_name text, challenger_image_path text, challenger_combat_power int, challenger_score int,
  opponent_id uuid, opponent_name text, opponent_pokemon_name text, opponent_image_path text, opponent_combat_power int, opponent_score int
)
language sql stable security definer set search_path = public as $$
  select d.id, d.status, d.created_at, d.resolved_at, d.winner_id,
    d.challenger_id, challenger.name, challenger_pokemon.name_ko, challenger_pokemon.image_path, challenger_appearance.combat_power, d.challenger_score,
    d.opponent_id, opponent.name, opponent_pokemon.name_ko, opponent_pokemon.image_path, opponent_appearance.combat_power, d.opponent_score
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

revoke execute on function public.pokedex_duel_members() from public, anon;
revoke execute on function public.pokedex_duel_create(uuid, uuid) from public, anon;
revoke execute on function public.pokedex_duel_accept(uuid, uuid) from public, anon;
revoke execute on function public.pokedex_duel_reject(uuid) from public, anon;
revoke execute on function public.pokedex_duel_cancel(uuid) from public, anon;
revoke execute on function public.pokedex_duel_list() from public, anon;
grant execute on function public.pokedex_duel_members() to authenticated;
grant execute on function public.pokedex_duel_create(uuid, uuid) to authenticated;
grant execute on function public.pokedex_duel_accept(uuid, uuid) to authenticated;
grant execute on function public.pokedex_duel_reject(uuid) to authenticated;
grant execute on function public.pokedex_duel_cancel(uuid) to authenticated;
grant execute on function public.pokedex_duel_list() to authenticated;
