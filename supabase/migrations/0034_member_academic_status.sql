alter table public.profiles
  add column academic_status text
  check (academic_status in ('enrolled', 'leave', 'graduated', 'completed'));

grant update (academic_status) on public.profiles to authenticated;

create or replace function public.admin_set_academic_status(
  p_user uuid,
  p_academic_status text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_academic_status is not null and p_academic_status not in ('enrolled', 'leave', 'graduated', 'completed') then
    raise exception 'INVALID_INPUT';
  end if;
  update profiles set academic_status = p_academic_status where id = p_user;
end $$;

revoke execute on function public.admin_set_academic_status(uuid, text) from public, anon;
grant execute on function public.admin_set_academic_status(uuid, text) to authenticated;
