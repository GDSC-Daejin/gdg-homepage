-- 내 대기 순번 조회 (본인 외 event_registrations 행은 RLS로 안 보이므로 RPC 필요)
create or replace function public.my_waitlist_position(p_event_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int + 1
  from event_registrations w
  where w.event_id = p_event_id
    and w.status = 'waitlisted'
    and w.created_at < (
      select created_at from event_registrations me
      where me.event_id = p_event_id and me.user_id = auth.uid() and me.status = 'waitlisted'
    )
$$;

revoke execute on function public.my_waitlist_position(uuid) from public, anon;
grant execute on function public.my_waitlist_position(uuid) to authenticated;
