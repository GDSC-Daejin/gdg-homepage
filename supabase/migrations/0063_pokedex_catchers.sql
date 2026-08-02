create or replace function public.pokedex_catchers(p_pokemon uuid)
returns table (
  user_id uuid,
  name text,
  nickname text,
  avatar_path text,
  ball_slug text,
  caught_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.nickname, p.avatar_path, t.ball_slug, t.created_at
  from pokemon_throws t
  join profiles p on p.id = t.user_id
  where t.pokemon_id = p_pokemon
    and t.outcome = 'caught'
    and p.status = 'active'
  order by t.created_at desc;
$$;

grant execute on function public.pokedex_catchers(uuid) to authenticated;
