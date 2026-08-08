-- Google Calendar 이벤트는 예약 확정 후 서버에서 생성하고, 재동기화용 ID만 보관한다.
alter table public.interview_slots
  add column calendar_event_id text;
