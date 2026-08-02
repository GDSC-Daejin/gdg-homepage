-- 회원 이벤트 상세에서 신청자 이름과 상태만 노출한다.
create or replace function public.event_registrants(p_event_id uuid)
returns table (user_id uuid, name text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles
    where id = auth.uid() and status = 'active' and role <> 'applicant'
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  return query
    select registration.user_id, profile.name, registration.status
    from event_registrations registration
    join profiles profile on profile.id = registration.user_id
    where registration.event_id = p_event_id
    order by case registration.status when 'confirmed' then 0 else 1 end, registration.created_at;
end;
$$;

revoke execute on function public.event_registrants(uuid) from public, anon;
grant execute on function public.event_registrants(uuid) to authenticated;
