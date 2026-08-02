create or replace function public.pokedex_grant_daily_balls()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_granted int;
begin
  with granted as (
    insert into pokemon_ball_grants (user_id, ball_slug, granted_on)
    select id, 'poke_ball', v_today from profiles
      where status = 'active' and role <> 'applicant'
    on conflict do nothing
    returning user_id
  ), updated as (
    insert into pokemon_ball_inventory (user_id, ball_slug, quantity)
    select user_id, 'poke_ball', 3 from granted
    on conflict (user_id, ball_slug) do update
      set quantity = 3
    returning user_id
  )
  select count(*) into v_granted from updated;
  return v_granted;
end $$;

revoke execute on function public.pokedex_grant_daily_balls() from public, anon, authenticated;
