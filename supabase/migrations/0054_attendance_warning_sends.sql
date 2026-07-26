-- 출석 경고는 어드민 수동 버튼과 주간 크론 두 경로로 나간다.
-- 같은 날 명단이 두 번 올라가는 걸 막으려면 "오늘 보냈다"는 사실이 서버 밖에 남아야 한다(서버리스라 메모리는 못 쓴다).
-- squirtle_posts와 같은 방식: 날짜(KST 기준)를 먼저 예약하고 보낸다. 전송이 실패하면 예약을 지워 다시 시도할 수 있게 한다.

create table public.attendance_warning_sends (
  sent_on date primary key,
  count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.attendance_warning_sends enable row level security;

-- 크론은 서비스 롤이라 RLS를 우회한다. 정책은 어드민 수동 발송 경로를 위한 것.
create policy "attendance_warning_sends: admin all"
  on public.attendance_warning_sends for all
  using (public.is_admin()) with check (public.is_admin());
