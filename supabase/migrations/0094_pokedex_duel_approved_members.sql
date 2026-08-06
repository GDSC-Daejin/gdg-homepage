-- 승인 대기 회원은 결투 상대가 될 수 없다.

create or replace function public.pokedex_duel_members()
returns table (id uuid, name text, nickname text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select id, name, nickname, avatar_path
  from profiles
  where auth.uid() is not null
    and status = 'active'
    and approved_at is not null
    and id <> auth.uid()
  order by name, nickname;
$$;

create or replace function public.pokedex_duel_create(p_opponent uuid, p_throw uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_duel uuid;
begin
  if v_user is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from profiles where id = v_user and status = 'active' and approved_at is not null;
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_opponent = v_user then raise exception 'INVALID_INPUT'; end if;
  perform 1 from profiles where id = p_opponent and status = 'active' and approved_at is not null;
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
