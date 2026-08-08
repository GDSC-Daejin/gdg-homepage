-- 초대 링크에서도 명단의 저장된 프로필 사진을 보여준다.
create or replace function public.get_meeting_poll_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_poll meeting_polls%rowtype;
begin
  select * into v_poll from meeting_polls where invite_token = p_token;
  if v_poll.id is null then raise exception 'INVALID_TOKEN'; end if;

  return jsonb_build_object(
    'poll', jsonb_build_object(
      'id', v_poll.id,
      'title', v_poll.title,
      'dates', v_poll.dates,
      'start_hour', v_poll.start_hour,
      'end_hour', v_poll.end_hour,
      'slot_min', v_poll.slot_min,
      'due_at', v_poll.due_at,
      'confirmed_at', v_poll.confirmed_at,
      'duration_min', v_poll.duration_min
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pa.id, 'name', pa.name, 'slots', pa.slots,
        'responded_at', pa.responded_at, 'avatar_path', profile.avatar_path
      ) order by pa.created_at)
      from meeting_poll_participants pa
      left join profiles profile on profile.id = pa.user_id
      where pa.poll_id = v_poll.id
    ), '[]'::jsonb)
  );
end $$;
