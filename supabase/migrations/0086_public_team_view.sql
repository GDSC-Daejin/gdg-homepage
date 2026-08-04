create or replace view public.team_public
with (security_invoker = false, security_barrier = true)
as
select id, nickname, avatar_path, role
from public.profiles
where role in ('organizer', 'team_member')
  and status = 'active'
  and approved_at is not null;

revoke all on public.team_public from anon, authenticated;
grant select on public.team_public to anon, authenticated;

notify pgrst, 'reload schema';
