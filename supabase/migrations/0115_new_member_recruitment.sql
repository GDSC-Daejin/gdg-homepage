-- 신규 멤버 모집 프로세스 확장: 상태 이력, 평가, 합격자 가입 초대

alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('waiting', 'reviewing', 'pending', 'accepted', 'rejected', 'no_show', 'withdrawn'));

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_type text not null default 'system'
    check (actor_type in ('admin', 'system')),
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists application_status_history_application
  on public.application_status_history (application_id, created_at desc);

alter table public.application_status_history enable row level security;
drop policy if exists "application_status_history: admin read" on public.application_status_history;
create policy "application_status_history: admin read"
  on public.application_status_history for select using (public.is_admin());

create or replace function public.record_application_status_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, to_status, actor_type, actor_id)
    values (
      new.id,
      new.status,
      case when auth.uid() is null then 'system' else 'admin' end,
      auth.uid()
    );
  elsif old.status is distinct from new.status then
    insert into public.application_status_history (
      application_id, from_status, to_status, actor_type, actor_id
    )
    values (
      new.id,
      old.status,
      new.status,
      case when auth.uid() is null then 'system' else 'admin' end,
      auth.uid()
    );
  end if;
  return new;
end $$;

drop trigger if exists applications_status_history on public.applications;
create trigger applications_status_history
  after insert or update of status on public.applications
  for each row execute function public.record_application_status_history();

create table if not exists public.application_evaluations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null check (stage in ('document', 'interview')),
  scores jsonb not null,
  recommendation text not null check (recommendation in ('accepted', 'pending', 'rejected')),
  note text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, evaluator_id, stage)
);

alter table public.application_evaluations enable row level security;
drop policy if exists "application_evaluations: admin read" on public.application_evaluations;
drop policy if exists "application_evaluations: admin insert" on public.application_evaluations;
drop policy if exists "application_evaluations: admin update" on public.application_evaluations;
create policy "application_evaluations: admin read"
  on public.application_evaluations for select using (public.is_admin());
create policy "application_evaluations: admin insert"
  on public.application_evaluations for insert with check (public.is_admin());
create policy "application_evaluations: admin update"
  on public.application_evaluations for update
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.application_onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  token_hash text not null unique,
  target_email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists application_onboarding_invites_active
  on public.application_onboarding_invites (application_id)
  where used_at is null and revoked_at is null;

alter table public.application_onboarding_invites enable row level security;
drop policy if exists "application_onboarding_invites: admin read" on public.application_onboarding_invites;
create policy "application_onboarding_invites: admin read"
  on public.application_onboarding_invites for select using (public.is_admin());

create or replace function public.admin_set_application_status(
  p_application uuid,
  p_status text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current text;
  v_applicant uuid;
  v_position text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('waiting', 'reviewing', 'pending', 'accepted', 'rejected', 'no_show', 'withdrawn') then
    raise exception 'INVALID_INPUT';
  end if;

  select status, applicant_id, position
    into v_current, v_applicant, v_position
    from public.applications
    where id = p_application
    for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if not (
    (v_current = 'waiting' and p_status in ('waiting', 'reviewing', 'pending', 'rejected'))
    or (v_current = 'reviewing' and p_status in ('waiting', 'reviewing', 'pending', 'rejected'))
    or (v_current = 'pending' and p_status in ('pending', 'accepted', 'rejected', 'no_show', 'reviewing'))
    or (v_current in ('accepted', 'rejected', 'no_show', 'withdrawn') and p_status = v_current)
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.applications
    set status = p_status,
        reviewed_by = case when p_status in ('accepted', 'rejected') then auth.uid() else reviewed_by end,
        reviewed_at = case when p_status in ('accepted', 'rejected') then now() else reviewed_at end
    where id = p_application;

  if p_status = 'accepted' and v_applicant is not null then
    update public.profiles
      set role = 'member',
          position = coalesce(v_position, position)
      where id = v_applicant and role = 'applicant';
  end if;

  perform public.log_audit(
    'review_application',
    p_application::text,
    jsonb_build_object('status', p_status)
  );
end $$;

create or replace function public.admin_reopen_interview(p_application uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.applications
    set status = 'pending', reviewed_by = null, reviewed_at = null
    where id = p_application and status = 'no_show';
  if not found then raise exception 'INVALID_INPUT'; end if;
  perform public.log_audit('reopen_interview', p_application::text, '{}'::jsonb);
end $$;

create or replace function public.admin_mark_interview_outcome(
  p_slot uuid,
  p_result text,
  p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_slot public.interview_slots%rowtype;
  v_app_status text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_result not in ('attended', 'no_show') then raise exception 'INVALID_OUTCOME'; end if;
  select * into v_slot
    from public.interview_slots
    where id = p_slot and status = 'booked'
    for update;
  if v_slot.id is null then raise exception 'NOT_BOOKED'; end if;
  if v_slot.starts_at > now() then raise exception 'INTERVIEW_NOT_STARTED'; end if;
  select status into v_app_status from public.applications where id = v_slot.application_id;
  if p_result = 'no_show' and v_app_status <> 'pending' then raise exception 'INVALID_INPUT'; end if;

  update public.interview_slots
    set status = 'completed', interview_result = p_result, updated_at = now()
    where id = v_slot.id;
  insert into public.interview_booking_events (
    application_id, slot_id, action, actor_type, actor_id, reason
  ) values (
    v_slot.application_id, v_slot.id, p_result, 'admin', auth.uid(), left(coalesce(p_reason, ''), 500)
  );
  if p_result = 'no_show' then
    update public.applications
      set status = 'no_show', reviewed_by = auth.uid(), reviewed_at = now()
      where id = v_slot.application_id;
  end if;
end $$;

create or replace function public.admin_issue_application_onboarding_invite(
  p_application uuid,
  p_token_hash text,
  p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select email into v_email
    from public.applications
    where id = p_application and status = 'accepted';
  if not found or v_email = '' then raise exception 'INVALID_INPUT'; end if;

  update public.application_onboarding_invites
    set revoked_at = now()
    where application_id = p_application
      and used_at is null
      and revoked_at is null;

  insert into public.application_onboarding_invites (
    application_id, token_hash, target_email, expires_at, created_by
  ) values (
    p_application, p_token_hash, v_email, p_expires_at, auth.uid()
  ) returning id into v_id;

  return v_id;
end $$;

create or replace function public.get_application_onboarding_invite(p_token_hash text)
returns table(
  application_id uuid,
  applicant_name text,
  email text,
  season text,
  application_position text,
  expires_at timestamptz,
  used_at timestamptz,
  linked_profile_id uuid
) language sql security definer set search_path = public as $$
  select
    i.application_id,
    a.applicant_name,
    i.target_email,
    a.season,
    a.position,
    i.expires_at,
    i.used_at,
    i.linked_profile_id
  from public.application_onboarding_invites i
  join public.applications a on a.id = i.application_id
  where i.token_hash = p_token_hash
    and i.revoked_at is null;
$$;

create or replace function public.link_application_to_profile(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invite public.application_onboarding_invites%rowtype;
  v_app public.applications%rowtype;
  v_auth_email text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_invite
    from public.application_onboarding_invites
    where token_hash = p_token_hash
      and used_at is null
      and revoked_at is null
    for update;
  if not found or v_invite.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;

  select * into v_app from public.applications where id = v_invite.application_id for update;
  if not found or v_app.status <> 'accepted' then raise exception 'INVALID_INPUT'; end if;
  if v_app.applicant_id is not null and v_app.applicant_id <> auth.uid() then
    raise exception 'ALREADY_LINKED';
  end if;

  select email into v_auth_email from auth.users where id = auth.uid();
  if v_auth_email is null or lower(v_auth_email) <> lower(v_invite.target_email) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  update public.profiles
    set name = case when nullif(name, '') is null then v_app.applicant_name else name end,
        student_no = case when nullif(student_no, '') is null then v_app.student_no else student_no end,
        major = case when nullif(major, '') is null then v_app.major else major end,
        phone = case when nullif(phone, '') is null then v_app.phone else phone end,
        position = case when position is null then v_app.position else position end
    where id = auth.uid();

  update public.applications set applicant_id = auth.uid() where id = v_app.id;
  update public.application_onboarding_invites
    set used_at = now(), linked_profile_id = auth.uid()
    where id = v_invite.id;

  perform public.log_audit('link_application_profile', v_app.id::text, '{}'::jsonb);
  return v_app.id;
end $$;

revoke execute on function public.admin_reopen_interview(uuid) from public, anon;
revoke execute on function public.admin_issue_application_onboarding_invite(uuid, text, timestamptz) from public, anon;
revoke execute on function public.admin_mark_interview_outcome(uuid, text, text) from public, anon;
revoke execute on function public.link_application_to_profile(text) from public, anon;
grant execute on function public.admin_reopen_interview(uuid) to authenticated;
grant execute on function public.admin_issue_application_onboarding_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_mark_interview_outcome(uuid, text, text) to authenticated;
grant execute on function public.get_application_onboarding_invite(text) to anon, authenticated;
grant execute on function public.link_application_to_profile(text) to authenticated;

notify pgrst, 'reload schema';
