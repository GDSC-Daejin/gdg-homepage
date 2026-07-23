-- 운영진이 출석을 임의로 체크/해제 (사용자가 코드 입력을 깜빡한 경우)
-- attendances 쓰기는 RLS로 봉인돼 있으므로 security definer RPC로만 수행.
create or replace function public.set_attendance(
  p_event_id uuid,
  p_user_id uuid,
  p_present boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if p_present then
    -- 이미 있으면 no-op (포인트 중복 지급 방지)
    insert into attendances (event_id, user_id)
    values (p_event_id, p_user_id)
    on conflict (event_id, user_id) do nothing;
  else
    delete from attendances where event_id = p_event_id and user_id = p_user_id;
    -- 출석 트리거가 지급한 +10 회수
    delete from point_logs
    where user_id = p_user_id and ref_event = p_event_id
      and reason = '출석' and amount = 10;
  end if;
end $$;

revoke all on function public.set_attendance(uuid, uuid, boolean) from public;
grant execute on function public.set_attendance(uuid, uuid, boolean) to authenticated;
