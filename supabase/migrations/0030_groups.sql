-- 스터디·프로젝트 소속: 지속 그룹 + 자가가입 명단

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('study', 'project')),
  title text not null,
  description text not null default '',
  season text not null,
  status text not null default 'recruiting'
    check (status in ('recruiting', 'active', 'archived')),
  is_public boolean not null default false,
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index groups_season_idx on public.groups (season, type);

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
create policy "groups: member read" on public.groups
  for select to authenticated using (true);
create policy "groups: public read" on public.groups
  for select to anon using (is_public = true);
create policy "groups: admin all" on public.groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.group_members enable row level security;
create policy "group_members: member read" on public.group_members
  for select to authenticated using (true);
create policy "group_members: self leave" on public.group_members
  for delete to authenticated using (user_id = auth.uid());
create policy "group_members: admin all" on public.group_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.join_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_cap int;
  v_count int;
begin
  select status, capacity into v_status, v_cap from groups where id = p_group;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'recruiting' then raise exception 'NOT_RECRUITING'; end if;
  if v_cap is not null then
    -- ponytail: 경합 시 advisory lock, 동아리 규모라 우선 단순 count
    select count(*) into v_count from group_members where group_id = p_group;
    if v_count >= v_cap then raise exception 'FULL'; end if;
  end if;
  insert into group_members (group_id, user_id)
    values (p_group, auth.uid())
    on conflict do nothing;
end $$;
revoke execute on function public.join_group(uuid) from public, anon;
grant execute on function public.join_group(uuid) to authenticated;

create or replace function public.public_groups()
returns table (
  id uuid, type text, title text, description text,
  season text, member_count bigint
)
language sql stable security definer set search_path = public as $$
  select g.id, g.type, g.title, g.description, g.season,
         (select count(*) from group_members m where m.group_id = g.id)
  from groups g
  where g.is_public = true
  order by g.created_at desc
$$;
grant execute on function public.public_groups() to anon, authenticated;
