-- 전원 응답이 끝나면 운영진 채널에 "이제 확정해달라"고 한 번만 알린다.
--
-- 응답은 언제든 덮어쓸 수 있어서(saveMyAvailability는 통째 덮어쓰기다) "전원 응답"이라는
-- 조건만 보면 마지막 사람이 저장을 누를 때마다 알림이 다시 나간다. 컬럼 하나로 발송을 선점한다.
--
-- 기존 폴은 따로 채우지 않는다. 알림은 응답이 저장되는 순간에만 트리거되므로
-- 배포만으로 지난 폴이 한꺼번에 쏟아질 일이 없다.

alter table public.meeting_polls
  add column all_responded_notified_at timestamptz;

comment on column public.meeting_polls.all_responded_notified_at is
  '전원 응답 알림을 보낸 시각. 한 폴당 한 번만 나간다.';

-- 발송권 선점 + 알림 문구에 필요한 값 반환. 못 가져가면 null.
--
-- security definer인 이유는 응답자가 meeting_polls를 직접 update할 권한이 없기 때문이다.
-- 이름·이메일은 돌려주지 않는다 — 문구에 쓰지 않고, 명단이 새어 나갈 통로를 만들 이유가 없다.
create or replace function public.meeting_poll_claim_all_responded(p_poll uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_poll meeting_polls;
begin
  -- all_responded_notified_at is null 조건이 곧 선점이다.
  -- 마지막 응답 두 개가 동시에 들어와도 행 잠금 때문에 한쪽만 이긴다.
  update meeting_polls p
     set all_responded_notified_at = now()
   where p.id = p_poll
     and p.all_responded_notified_at is null
     and p.confirmed_at is null
     and exists (select 1 from meeting_poll_participants pa where pa.poll_id = p.id)
     and not exists (
       select 1 from meeting_poll_participants pa
        where pa.poll_id = p.id and pa.responded_at is null)
   returning p.* into v_poll;

  if v_poll.id is null then return null; end if;

  return jsonb_build_object(
    'poll', jsonb_build_object(
      'id', v_poll.id,
      'title', v_poll.title,
      'dates', v_poll.dates,
      'start_hour', v_poll.start_hour,
      'end_hour', v_poll.end_hour,
      'slot_min', v_poll.slot_min,
      'is_regular_session', v_poll.is_regular_session
    ),
    'slots', coalesce((
      select jsonb_agg(pa.slots order by pa.created_at)
        from meeting_poll_participants pa where pa.poll_id = v_poll.id
    ), '[]'::jsonb)
  );
end $$;

-- 폴 id를 아는 건 로그인한 참여자뿐이다. 익명은 아래 토큰 판을 쓴다.
revoke execute on function public.meeting_poll_claim_all_responded(uuid) from public, anon;
grant execute on function public.meeting_poll_claim_all_responded(uuid) to authenticated;

-- 초대 링크로 들어온 익명 응답자용. 토큰을 아는 사람만 그 폴을 건드릴 수 있다 —
-- 폴 id만 알면 아무 폴이나 선점해 알림을 삼킬 수 있는 통로를 열지 않으려고 나눴다.
create or replace function public.meeting_poll_claim_all_responded_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_poll uuid;
begin
  select id into v_poll from meeting_polls where invite_token = p_token;
  if v_poll is null then return null; end if;
  return public.meeting_poll_claim_all_responded(v_poll);
end $$;

revoke execute on function public.meeting_poll_claim_all_responded_by_token(uuid) from public;
grant execute on function public.meeting_poll_claim_all_responded_by_token(uuid) to anon, authenticated;
