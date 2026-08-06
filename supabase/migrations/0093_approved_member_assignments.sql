-- 승인 대기 회원은 관리자가 배정하거나 보상할 수 없다.

create or replace function public.admin_assign_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cap int;
  v_count int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from profiles where id = p_user and approved_at is not null) then
    raise exception 'NOT_MEMBER';
  end if;
  select capacity into v_cap from groups where id = p_group for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from group_members where group_id = p_group and user_id = p_user) then return; end if;
  if v_cap is not null then
    select count(*) into v_count from group_members where group_id = p_group;
    if v_count >= v_cap then raise exception 'FULL'; end if;
  end if;
  insert into group_members (group_id, user_id) values (p_group, p_user);
end $$;

create or replace function public.admin_assign_interviewer(p_slot uuid, p_interviewer uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from profiles where id = p_interviewer and approved_at is not null) then
    raise exception 'NOT_MEMBER';
  end if;
  update interview_slots set interviewer_id = p_interviewer, updated_at = now()
    where id = p_slot;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('assign_interviewer', p_slot::text,
    jsonb_build_object('interviewer', p_interviewer));
end $$;

create or replace function public.event_registrants(p_event_id uuid)
returns table (user_id uuid, name text, nickname text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'NOT_MEMBER'; end if;
  return query
    select registration.user_id, profile.name, profile.nickname, registration.status
    from event_registrations registration
    join profiles profile on profile.id = registration.user_id
    where registration.event_id = p_event_id and profile.approved_at is not null
    order by case registration.status when 'confirmed' then 0 else 1 end, registration.created_at;
end $$;

create or replace function public.admin_grant_points(p_user uuid, p_amount int, p_reason text, p_event uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_amount = 0 or p_reason = '' then raise exception 'INVALID_INPUT'; end if;
  if not exists (select 1 from profiles where id = p_user and approved_at is not null) then
    raise exception 'NOT_MEMBER';
  end if;
  insert into point_logs (user_id, amount, reason, ref_event, created_by)
    values (p_user, p_amount, p_reason, p_event, auth.uid());
  perform public.log_audit('grant_points', p_user::text, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end $$;

create or replace function public.admin_award_badge(p_user uuid, p_badge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_badge_name text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from profiles where id = p_user and approved_at is not null) then
    raise exception 'NOT_MEMBER';
  end if;
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
