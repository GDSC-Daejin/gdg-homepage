-- 이벤트 신청자 명단에 닉네임 병기("닉네임(이름)")를 위해 nickname 컬럼 추가.
-- RETURNS TABLE 시그니처가 바뀌므로 create or replace 전에 drop 필요.
drop function if exists public.event_registrants(uuid);
create function public.event_registrants(p_event_id uuid)
returns table (user_id uuid, name text, nickname text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.status = 'active' and p.role <> 'applicant'
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  return query
    select registration.user_id, profile.name, profile.nickname, registration.status
    from event_registrations registration
    join profiles profile on profile.id = registration.user_id
    where registration.event_id = p_event_id
    order by case registration.status when 'confirmed' then 0 else 1 end, registration.created_at;
end;
$$;

revoke execute on function public.event_registrants(uuid) from public, anon;
grant execute on function public.event_registrants(uuid) to authenticated;
