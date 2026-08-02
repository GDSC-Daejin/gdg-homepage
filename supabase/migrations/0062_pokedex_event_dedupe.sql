create table public.pokedex_slack_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

alter table public.pokedex_slack_events enable row level security;
