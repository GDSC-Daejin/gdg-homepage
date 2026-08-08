-- 정기세션을 확정한 운영자만, 확정 구간 전체를 가능으로 고른 회원을 자동 신청할 수 있다.
create or replace function public.register_available_poll_participants(
  p_poll_id uuid,
  p_event_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_confirmed_at timestamptz;
  v_duration_min int;
  v_slot_min int;
  v_event_id uuid;
  v_is_regular_session boolean;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select confirmed_at, duration_min, slot_min, event_id, is_regular_session
    into v_confirmed_at, v_duration_min, v_slot_min, v_event_id, v_is_regular_session
    from public.meeting_polls
    where id = p_poll_id;

  if not found
    or not v_is_regular_session
    or v_event_id is distinct from p_event_id
    or v_confirmed_at is null
    or v_duration_min is null then
    raise exception 'INVALID_INPUT';
  end if;

  insert into public.event_registrations (event_id, user_id, status)
  select p_event_id, participant.user_id, 'confirmed'
    from public.meeting_poll_participants participant
    join public.profiles profile on profile.id = participant.user_id
    where participant.poll_id = p_poll_id
      and participant.user_id is not null
      and profile.status = 'active'
      and profile.approved_at is not null
      and participant.slots @> array(
        select v_confirmed_at + series.step * v_slot_min * interval '1 minute'
          from generate_series(0, ceil(v_duration_min::numeric / v_slot_min)::int - 1) as series(step)
      )
  on conflict (event_id, user_id) do nothing;
end $$;

revoke execute on function public.register_available_poll_participants(uuid, uuid) from public, anon;
grant execute on function public.register_available_poll_participants(uuid, uuid) to authenticated;
