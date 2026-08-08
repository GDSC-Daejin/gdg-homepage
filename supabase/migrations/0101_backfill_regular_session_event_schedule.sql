-- 기존 정기세션 연결 이벤트 중 일시가 비어 있는 행은 확정 설문의 시간을 진실 원천으로 쓴다.
update public.events as event
set
  starts_at = poll.confirmed_at,
  ends_at = poll.confirmed_at + poll.duration_min * interval '1 minute',
  event_date = (poll.confirmed_at at time zone 'Asia/Seoul')::date,
  start_time = (poll.confirmed_at at time zone 'Asia/Seoul')::time,
  end_time = ((poll.confirmed_at + poll.duration_min * interval '1 minute') at time zone 'Asia/Seoul')::time
from public.meeting_polls as poll
where poll.event_id = event.id
  and poll.is_regular_session
  and poll.confirmed_at is not null
  and poll.duration_min is not null
  and (event.event_date is null or event.start_time is null or event.end_time is null);
