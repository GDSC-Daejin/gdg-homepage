alter table public.meeting_polls
  add column response_mode text not null default 'availability'
    check (response_mode in ('availability', 'attendance')),
  add column place_id uuid references public.places(id) on delete set null;

alter table public.meeting_poll_participants
  add column attendance_response text
    check (attendance_response in ('attending', 'absent', 'undecided'));

alter table public.surveys
  add column audience text not null default 'all'
    check (audience in ('all', 'members', 'staff'));

create or replace function public.can_answer_survey(p_audience text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved_at is not null and status = 'active'
      and case p_audience
        when 'members' then role = 'member'
        when 'staff' then role in ('organizer', 'team_member')
        else role in ('member', 'organizer', 'team_member')
      end
  );
$$;

drop policy "surveys: read" on public.surveys;
create policy "surveys: read" on public.surveys for select using (
  public.is_admin() or public.can_answer_survey(audience)
);

drop policy "responses: own insert" on public.survey_responses;
create policy "responses: own insert" on public.survey_responses for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.surveys s
    where s.id = survey_id and s.is_open and public.can_answer_survey(s.audience)
  )
);

drop policy "responses: own update" on public.survey_responses;
create policy "responses: own update" on public.survey_responses for update using (
  user_id = auth.uid() and exists (
    select 1 from public.surveys s
    where s.id = survey_id and s.is_open and public.can_answer_survey(s.audience)
  )
) with check (user_id = auth.uid());

create or replace function public.respond_meeting_poll_attendance_by_token(
  p_token uuid, p_participant uuid, p_response text
) returns void language plpgsql security definer set search_path = public as $$
declare v_poll_id uuid; v_confirmed timestamptz; v_due timestamptz;
begin
  select id, confirmed_at, due_at into v_poll_id, v_confirmed, v_due
    from public.meeting_polls where invite_token = p_token and response_mode = 'attendance';
  if v_poll_id is null then raise exception 'INVALID_TOKEN'; end if;
  if v_confirmed is not null then raise exception 'ALREADY_CONFIRMED'; end if;
  if v_due is not null and now() > v_due then raise exception 'PAST_DUE'; end if;
  if p_response not in ('attending', 'absent', 'undecided') then raise exception 'INVALID_RESPONSE'; end if;
  update public.meeting_poll_participants
    set attendance_response = p_response, responded_at = now()
    where id = p_participant and poll_id = v_poll_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke execute on function public.respond_meeting_poll_attendance_by_token(uuid, uuid, text) from public;
grant execute on function public.respond_meeting_poll_attendance_by_token(uuid, uuid, text) to anon, authenticated;

create or replace function public.get_meeting_poll_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_poll meeting_polls%rowtype;
begin
  select * into v_poll from public.meeting_polls where invite_token = p_token;
  if v_poll.id is null then raise exception 'INVALID_TOKEN'; end if;
  return jsonb_build_object(
    'poll', jsonb_build_object('id', v_poll.id, 'title', v_poll.title, 'dates', v_poll.dates,
      'start_hour', v_poll.start_hour, 'end_hour', v_poll.end_hour, 'slot_min', v_poll.slot_min,
      'due_at', v_poll.due_at, 'confirmed_at', v_poll.confirmed_at, 'duration_min', v_poll.duration_min,
      'response_mode', v_poll.response_mode),
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', pa.id, 'name', pa.name,
      'slots', pa.slots, 'attendance_response', pa.attendance_response, 'responded_at', pa.responded_at,
      'avatar_path', profile.avatar_path) order by pa.created_at)
      from public.meeting_poll_participants pa left join profiles profile on profile.id = pa.user_id
      where pa.poll_id = v_poll.id), '[]'::jsonb)
  );
end $$;
