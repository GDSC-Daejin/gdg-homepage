alter table public.pokemon_catalog
  add column cp_min int not null default 120 check (cp_min > 0),
  add column cp_max int not null default 550 check (cp_max >= cp_min);

update public.pokemon_catalog
set cp_min = case rarity
  when 'common' then 120
  when 'uncommon' then 450
  when 'rare' then 900
  when 'very_rare' then 1400
  when 'legendary' then 2200
end,
cp_max = case rarity
  when 'common' then 550
  when 'uncommon' then 1000
  when 'rare' then 2000
  when 'very_rare' then 2500
  when 'legendary' then 3500
end;

alter table public.pokemon_appearances
  add column combat_power int check (combat_power is null or combat_power > 0);

create or replace function public.set_pokemon_appearance_combat_power()
returns trigger language plpgsql set search_path = public as $$
declare
  v_min int;
  v_max int;
begin
  if new.combat_power is null then
    select cp_min, cp_max into v_min, v_max from pokemon_catalog where id = new.pokemon_id;
    new.combat_power := floor(random() * (v_max - v_min + 1))::int + v_min;
  end if;
  return new;
end $$;

create trigger pokemon_appearances_set_combat_power
before insert on public.pokemon_appearances
for each row execute function public.set_pokemon_appearance_combat_power();

drop function public.pokedex_catchers(uuid);

create function public.pokedex_catchers(p_pokemon uuid)
returns table (
  user_id uuid,
  name text,
  nickname text,
  avatar_path text,
  ball_slug text,
  caught_at timestamptz,
  combat_power int
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.nickname, p.avatar_path, t.ball_slug, t.created_at, a.combat_power
  from pokemon_throws t
  join pokemon_appearances a on a.id = t.appearance_id
  join profiles p on p.id = t.user_id
  where t.pokemon_id = p_pokemon
    and t.outcome = 'caught'
    and p.status = 'active'
  order by a.combat_power desc nulls last, t.created_at desc;
$$;

revoke execute on function public.pokedex_catchers(uuid) from public, anon;
grant execute on function public.pokedex_catchers(uuid) to authenticated;
