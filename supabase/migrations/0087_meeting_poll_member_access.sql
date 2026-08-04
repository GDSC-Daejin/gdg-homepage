-- 선택된 멤버는 자기 스케줄을 보고 응답한다. 관리 권한은 기존 정책을 유지한다.
create or replace function public.is_meeting_poll_participant(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from meeting_poll_participants
    where poll_id = p_poll and user_id = auth.uid()
  );
$$;
revoke execute on function public.is_meeting_poll_participant(uuid) from public;
grant execute on function public.is_meeting_poll_participant(uuid) to authenticated;

create policy "meeting_polls: participant read" on public.meeting_polls
  for select to authenticated
  using (public.is_meeting_poll_participant(id));

create policy "meeting_poll_participants: participant read" on public.meeting_poll_participants
  for select to authenticated
  using (public.is_meeting_poll_participant(poll_id));

drop policy "meeting_poll_participants: self respond" on public.meeting_poll_participants;
create policy "meeting_poll_participants: self respond" on public.meeting_poll_participants
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.meeting_polls p
      where p.id = poll_id and p.confirmed_at is null and (p.due_at is null or now() <= p.due_at)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.meeting_polls p
      where p.id = poll_id and p.confirmed_at is null and (p.due_at is null or now() <= p.due_at)
    )
  );
