-- event_registrants: RETURNS TABLE의 출력 컬럼 status가 plpgsql 변수로 잡혀
-- 멤버십 체크의 profiles.status와 충돌(column reference "status" is ambiguous, 42702).
-- authenticated 유저가 이벤트 상세를 열 때마다 명단 조회가 실패하던 원인.
-- profiles에 별칭을 부여해 모호성 제거. (create or replace라 기존 grant/ACL 유지)
create or replace function public.event_registrants(p_event_id uuid)
returns table (user_id uuid, name text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.status = 'active' and p.role <> 'applicant'
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
