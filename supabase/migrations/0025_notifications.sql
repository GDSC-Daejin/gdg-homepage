-- 인앱 알림 센터: 1:1 타겟 알림 (수신자 1명, fan-out 없음).
-- insert는 아래 3개 SECURITY DEFINER RPC 경유로만 (직접 insert 정책 없음).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('registration_promoted', 'inquiry_answered', 'badge_awarded')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 목록 조회 (수신자별 최신순)
create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

-- 안 읽음 카운트 (부분 인덱스)
create index notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: own read" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "notifications: own update" on public.notifications
  for update using (recipient_id = auth.uid());

create or replace function public.cancel_registration(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_was text;
  v_promoted_user uuid;
  v_promoted_name text;
  v_event_title text;
begin
  perform 1 from events where id = p_event_id for update;
  delete from event_registrations where event_id = p_event_id and user_id = auth.uid()
    returning status into v_was;
  if v_was is null then raise exception 'NOT_REGISTERED'; end if;
  if v_was = 'confirmed' then
    update event_registrations set status = 'confirmed'
    where id = (
      select id from event_registrations
      where event_id = p_event_id and status = 'waitlisted'
      order by created_at limit 1
    )
    returning user_id into v_promoted_user;
    if v_promoted_user is not null then
      select name into v_promoted_name from profiles where id = v_promoted_user;
      select title into v_event_title from events where id = p_event_id;
      insert into notifications (recipient_id, type, title, body, link)
      values (
        v_promoted_user,
        'registration_promoted',
        '대기 신청이 확정되었어요',
        coalesce(v_event_title, '이벤트') || ' 참가가 확정되었습니다.',
        '/events/' || p_event_id::text
      );
    end if;
  end if;
  return v_promoted_name;
end $$;

create or replace function public.admin_answer_inquiry(p_inquiry uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_title text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update inquiries set status = 'answered', answer = p_answer, answered_by = auth.uid(), answered_at = now()
    where id = p_inquiry
    returning user_id, title into v_user, v_title;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into notifications (recipient_id, type, title, body, link)
  values (
    v_user,
    'inquiry_answered',
    '문의에 답변이 등록되었어요',
    coalesce(nullif(v_title, ''), '문의') || '에 답변이 달렸습니다.',
    '/inquiries'
  );
  perform public.log_audit('answer_inquiry', p_inquiry::text, '{}'::jsonb);
end $$;

create or replace function public.admin_award_badge(p_user uuid, p_badge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_badge_name text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into user_badges (badge_id, user_id, awarded_by) values (p_badge, p_user, auth.uid());
  select name into v_badge_name from badges where id = p_badge;
  insert into notifications (recipient_id, type, title, body, link)
  values (
    p_user,
    'badge_awarded',
    '새 뱃지를 획득했어요',
    coalesce(v_badge_name, '뱃지') || ' 뱃지를 받았습니다.',
    '/profile'
  );
  perform public.log_audit('award_badge', p_user::text, jsonb_build_object('badge', p_badge));
end $$;
