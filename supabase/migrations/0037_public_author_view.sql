create or replace view public.member_public
with (security_invoker = false, security_barrier = true)
as select id, name, nickname from public.profiles;

revoke all on public.member_public from anon;
grant select on public.member_public to authenticated;
