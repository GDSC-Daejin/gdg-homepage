-- 모집 외부 연동 상태: 이메일 전달 여부와 Calendar 참석자 응답

alter table public.interview_slots
  add column calendar_sync_status text not null default 'not_synced'
    check (calendar_sync_status in ('not_synced', 'synced', 'failed', 'deleted', 'delete_failed')),
  add column calendar_synced_at timestamptz,
  add column calendar_checked_at timestamptz,
  add column calendar_error text,
  add column applicant_calendar_response text
    check (applicant_calendar_response in ('needsAction', 'accepted', 'tentative', 'declined')),
  add column interviewer_calendar_response text
    check (interviewer_calendar_response in ('needsAction', 'accepted', 'tentative', 'declined'));

create table public.application_email_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  slot_id uuid references public.interview_slots(id) on delete set null,
  kind text not null check (kind in (
    'interview_invite', 'interview_confirmation', 'interview_cancellation',
    'result', 'onboarding_invite'
  )),
  recipient_email text not null,
  provider_email_id text,
  status text not null check (status in (
    'not_configured', 'requested', 'delivered', 'delivery_delayed',
    'failed', 'bounced', 'complained', 'suppressed'
  )),
  error text,
  requested_at timestamptz,
  delivered_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now()
);
create index application_email_logs_application_created
  on public.application_email_logs (application_id, created_at desc);
create unique index application_email_logs_provider_id
  on public.application_email_logs (provider_email_id)
  where provider_email_id is not null;

create table public.application_email_events (
  id uuid primary key default gen_random_uuid(),
  email_log_id uuid references public.application_email_logs(id) on delete set null,
  provider_event_id text not null unique,
  provider_email_id text not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index application_email_events_provider_email
  on public.application_email_events (provider_email_id, occurred_at desc);

alter table public.application_email_logs enable row level security;
alter table public.application_email_events enable row level security;
create policy "application_email_logs: admin read"
  on public.application_email_logs for select using (public.is_admin());
create policy "application_email_events: admin read"
  on public.application_email_events for select using (public.is_admin());
