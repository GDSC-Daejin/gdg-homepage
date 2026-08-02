-- 회의 시간 조율 확장: 참여자 명단 · 초대 링크 · 응답 마감 · 칸 단위 · 비연속 날짜
-- 원본 기획(Claude Design "Schedule Coordination")에 맞춘 확장이다.

-- 1) 후보 날짜를 배열로. 원본 "날짜 고르기"는 연속 범위가 아니라 임의 선택이다.
alter table public.meeting_polls add column dates date[];
update public.meeting_polls
  set dates = (
    select array_agg(d::date order by d)
    from generate_series(starts_on, ends_on, interval '1 day') as g(d)
  );
alter table public.meeting_polls alter column dates set not null;
alter table public.meeting_polls
  add constraint meeting_polls_dates_len
    check (array_length(dates, 1) between 1 and 14);

alter table public.meeting_polls drop constraint if exists meeting_polls_ends_on_check;
alter table public.meeting_polls drop column starts_on;
alter table public.meeting_polls drop column ends_on;

-- 2) 칸 단위 · 응답 마감 · 마감 알림 · 초대 링크
alter table public.meeting_polls
  add column slot_min int not null default 30 check (slot_min in (30, 60)),
  add column due_at timestamptz,
  add column notify_before_due boolean not null default true,
  add column invite_token uuid not null default gen_random_uuid(),
  -- 마감 전날 알림을 두 번 보내지 않기 위한 발송 표시
  add column due_notified_at timestamptz;
create unique index meeting_polls_invite_token_idx on public.meeting_polls (invite_token);

-- 3) 참여자 = 응답. 초대된 사람 한 줄이 곧 그 사람의 응답이다.
--    responded_at이 null이면 아직 안 함. 별 테이블로 나누면 "7명 중 6명" 계산이 조인 하나 더 든다.
create table public.meeting_poll_participants (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.meeting_polls(id) on delete cascade,
  -- 우리 회원이면 profiles.id, 이름만 초대된 사람이면 null
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  email text,
  slots timestamptz[] not null default '{}',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index meeting_poll_participants_poll_idx
  on public.meeting_poll_participants (poll_id);
-- 같은 회원을 두 번 초대할 수 없다. 이름만 있는 참여자는 동명이인이 있을 수 있어 막지 않는다.
create unique index meeting_poll_participants_user_idx
  on public.meeting_poll_participants (poll_id, user_id) where user_id is not null;

-- 4) 기존 응답을 참여자로 옮긴다.
insert into public.meeting_poll_participants (poll_id, user_id, name, slots, responded_at)
select r.poll_id, r.user_id, coalesce(nullif(trim(p.name), ''), '이름 없음'), r.slots, r.updated_at
  from public.meeting_poll_responses r
  join public.profiles p on p.id = r.user_id;
drop table public.meeting_poll_responses;

alter table public.meeting_poll_participants enable row level security;

create policy "meeting_poll_participants: staff read" on public.meeting_poll_participants
  for select to authenticated using (public.is_admin());
-- 명단 편집(초대·삭제)은 폴을 만든 사람과 organizer만.
create policy "meeting_poll_participants: owner write" on public.meeting_poll_participants
  for all to authenticated
  using (
    public.is_admin() and exists (
      select 1 from public.meeting_polls p
      where p.id = poll_id and (p.created_by = auth.uid() or public.is_organizer())
    )
  )
  with check (
    public.is_admin() and exists (
      select 1 from public.meeting_polls p
      where p.id = poll_id and (p.created_by = auth.uid() or public.is_organizer())
    )
  );
-- 본인 응답 저장. 확정된 폴은 잠긴다.
create policy "meeting_poll_participants: self respond" on public.meeting_poll_participants
  for update to authenticated
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

-- 5) 초대 링크로 여는 익명 화면 — 토큰만 알면 읽고, 자기 이름 칸에만 쓴다.
--    anon은 RLS를 통과하지 못하므로 두 RPC로만 드나든다.
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
        'responded_at', pa.responded_at
      ) order by pa.created_at)
      from meeting_poll_participants pa where pa.poll_id = v_poll.id
    ), '[]'::jsonb)
  );
end $$;
revoke execute on function public.get_meeting_poll_by_token(uuid) from public;
grant execute on function public.get_meeting_poll_by_token(uuid) to anon, authenticated;

-- 응답 저장(익명). 토큰 + 참여자 id가 맞아야 하고, 확정된 폴은 거부한다.
create or replace function public.respond_meeting_poll_by_token(
  p_token uuid, p_participant uuid, p_slots timestamptz[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_poll_id uuid;
  v_confirmed timestamptz;
  v_due timestamptz;
begin
  select id, confirmed_at, due_at into v_poll_id, v_confirmed, v_due
    from meeting_polls where invite_token = p_token;
  if v_poll_id is null then raise exception 'INVALID_TOKEN'; end if;
  if v_confirmed is not null then raise exception 'ALREADY_CONFIRMED'; end if;
  if v_due is not null and now() > v_due then raise exception 'PAST_DUE'; end if;

  update meeting_poll_participants
    set slots = coalesce(p_slots, '{}'), responded_at = now()
    where id = p_participant and poll_id = v_poll_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke execute on function public.respond_meeting_poll_by_token(uuid, uuid, timestamptz[]) from public;
grant execute on function public.respond_meeting_poll_by_token(uuid, uuid, timestamptz[]) to anon, authenticated;

-- 6) 미응답자에게 인앱 알림. 회원으로 초대된 사람만 받을 수 있다.
-- 0025에서 인라인 check로 만들어져 이름이 notifications_type_check로 붙어 있다.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('registration_promoted', 'inquiry_answered', 'badge_awarded', 'meeting_poll_nudge'));

create or replace function public.nudge_meeting_poll(p_poll uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_sent int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select title into v_title from meeting_polls where id = p_poll;
  if v_title is null then raise exception 'NOT_FOUND'; end if;

  insert into notifications (recipient_id, type, title, body, link)
  select pa.user_id, 'meeting_poll_nudge', '회의 시간 조율에 응답해주세요',
         v_title, '/schedule/' || p_poll
    from meeting_poll_participants pa
    where pa.poll_id = p_poll and pa.responded_at is null and pa.user_id is not null;
  get diagnostics v_sent = row_count;
  return v_sent;
end $$;
revoke execute on function public.nudge_meeting_poll(uuid) from public, anon;
grant execute on function public.nudge_meeting_poll(uuid) to authenticated;
