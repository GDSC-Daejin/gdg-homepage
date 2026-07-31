-- 회의 시간 조율(Meeting Poll): 후보 날짜·시간 격자에 Staff가 각자 가능한 칸을 칠하고
-- 겹치는 구간을 찾아 회의 시간을 확정한다. 모지숲 회의록(meetings)과 다른 개념이다.

-- 확정·삭제 권한 판정용. is_admin()과 같은 모양(stable security definer).
create or replace function public.is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'organizer');
$$;

create table public.meeting_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_on date not null,
  ends_on date not null,
  -- KST 기준 시간축 범위. end_hour는 배타(18~24면 23:30 칸까지).
  start_hour int not null check (start_hour between 0 and 23),
  end_hour int not null check (end_hour between 1 and 24),
  created_by uuid not null references public.profiles(id) on delete cascade,
  -- 확정된 회의 시작 시각. null이면 아직 응답 받는 중.
  confirmed_at timestamptz,
  duration_min int check (duration_min is null or duration_min > 0),
  created_at timestamptz not null default now(),
  check (end_hour > start_hour),
  -- 격자 폭 상한. 없으면 실수로 1년 범위를 열어 브라우저가 죽는다.
  check (ends_on >= starts_on and ends_on - starts_on <= 13),
  check ((confirmed_at is null) = (duration_min is null))
);
create index meeting_polls_created_idx on public.meeting_polls (created_at desc);
create index meeting_polls_confirmed_idx on public.meeting_polls (confirmed_at)
  where confirmed_at is not null;

-- 한 사람 = 한 행, 가능한 칸은 배열. 슬롯마다 행을 만들면 저장 한 번에 수백 행이 오간다.
create table public.meeting_poll_responses (
  poll_id uuid not null references public.meeting_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slots timestamptz[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.meeting_polls enable row level security;
alter table public.meeting_poll_responses enable row level security;

create policy "meeting_polls: staff read" on public.meeting_polls
  for select to authenticated using (public.is_admin());
create policy "meeting_polls: staff create" on public.meeting_polls
  for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
-- 확정·삭제는 만든 사람과 organizer만. 아무나 확정하면 남이 정한 시간에 끌려간다.
create policy "meeting_polls: owner update" on public.meeting_polls
  for update to authenticated
  using (public.is_admin() and (created_by = auth.uid() or public.is_organizer()))
  with check (public.is_admin() and (created_by = auth.uid() or public.is_organizer()));
create policy "meeting_polls: owner delete" on public.meeting_polls
  for delete to authenticated
  using (public.is_admin() and (created_by = auth.uid() or public.is_organizer()));

create policy "meeting_poll_responses: staff read" on public.meeting_poll_responses
  for select to authenticated using (public.is_admin());
-- 확정되면 응답이 잠긴다. 확정 뒤에 응답이 바뀌면 확정 근거가 사라진다.
create policy "meeting_poll_responses: self write" on public.meeting_poll_responses
  for all to authenticated
  using (
    public.is_admin() and user_id = auth.uid()
    and exists (
      select 1 from public.meeting_polls p
      where p.id = poll_id and p.confirmed_at is null
    )
  )
  with check (
    public.is_admin() and user_id = auth.uid()
    and exists (
      select 1 from public.meeting_polls p
      where p.id = poll_id and p.confirmed_at is null
    )
  );
