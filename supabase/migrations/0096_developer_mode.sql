-- 개발자 계정은 profiles.role을 바꾸지 않고 organizer와 같은 권한을 가진다.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'jieunsse@gmail.com'
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('organizer', 'team_member')
    );
$$;

create or replace function public.is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'jieunsse@gmail.com'
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'organizer'
    );
$$;
