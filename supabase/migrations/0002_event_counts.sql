-- 회원 화면에서 이벤트별 confirmed 신청 수를 노출하기 위한 security definer 함수
-- (event_registrations는 RLS로 본인+admin만 select 가능하므로 일반 세션으로는 count 불가)
create or replace function public.event_confirmed_counts(p_event_ids uuid[])
returns table(event_id uuid, confirmed bigint)
language sql stable security definer set search_path = public as $$
  select event_id, count(*) from event_registrations
  where event_id = any(p_event_ids) and status = 'confirmed'
  group by event_id
$$;

grant execute on function public.event_confirmed_counts(uuid[]) to authenticated;
