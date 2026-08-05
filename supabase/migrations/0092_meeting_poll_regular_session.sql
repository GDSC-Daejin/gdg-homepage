alter table public.meeting_polls
  add column is_regular_session boolean not null default false,
  add column event_id uuid unique references public.events(id) on delete set null;
