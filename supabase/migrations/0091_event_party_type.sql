alter table public.events drop constraint events_type_check;

alter table public.events
  add constraint events_type_check check (type in ('session', 'study', 'mogakco', 'party'));
