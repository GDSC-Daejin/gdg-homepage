create function public.squirtle_season_history()
returns table (
  id uuid,
  starts_on date,
  stage int,
  total_count int,
  contributors jsonb
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.starts_on,
    s.stage,
    s.total_count,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', ranked.name, 'nickname', ranked.nickname, 'count', ranked.count) order by ranked.rank)
      from (
        select p.name, p.nickname, count(*)::int as count, rank() over (order by count(*) desc, max(c.created_at)) as rank
        from squirtle_checkins c
        join profiles p on p.id = c.user_id
        where c.season_id = s.id and p.status = 'active'
        group by p.id, p.name, p.nickname
        order by count(*) desc, max(c.created_at)
        limit 3
      ) ranked
    ), '[]'::jsonb)
  from squirtle_seasons s
  where s.status = 'closed'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.status = 'active' and p.role <> 'applicant'
    )
  order by s.starts_on desc;
$$;

revoke execute on function public.squirtle_season_history() from public, anon;
grant execute on function public.squirtle_season_history() to authenticated;
