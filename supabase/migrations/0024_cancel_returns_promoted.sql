-- cancel_registration: 대기자 승급 시 승급자 이름을 반환한다 (알림용).
-- 반환 타입 변경(void -> text)은 create or replace가 불가하므로 drop 후 재생성.

drop function public.cancel_registration(uuid);

create function public.cancel_registration(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_was text;
  v_promoted_user uuid;
  v_promoted_name text;
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
    end if;
  end if;
  return v_promoted_name;
end $$;

revoke execute on function public.cancel_registration(uuid) from public, anon;
grant execute on function public.cancel_registration(uuid) to authenticated;
