-- 관리자 배정도 자가 가입과 같은 정원 제한을 적용한다.

create or replace function public.join_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_cap int;
  v_count int;
begin
  select status, capacity into v_status, v_cap from groups where id = p_group for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'recruiting' then raise exception 'NOT_RECRUITING'; end if;
  if v_cap is not null then
    select count(*) into v_count from group_members where group_id = p_group;
    if v_count >= v_cap then raise exception 'FULL'; end if;
  end if;
  insert into group_members (group_id, user_id)
    values (p_group, auth.uid())
    on conflict do nothing;
end $$;

create or replace function public.admin_assign_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cap int;
  v_count int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select capacity into v_cap from groups where id = p_group for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists (
    select 1 from group_members where group_id = p_group and user_id = p_user
  ) then return; end if;

  if v_cap is not null then
    select count(*) into v_count from group_members where group_id = p_group;
    if v_count >= v_cap then raise exception 'FULL'; end if;
  end if;

  insert into group_members (group_id, user_id) values (p_group, p_user);
end $$;

revoke execute on function public.admin_assign_group_member(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_group_member(uuid, uuid) to authenticated;
