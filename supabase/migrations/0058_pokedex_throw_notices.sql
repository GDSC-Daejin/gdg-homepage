create table public.pokemon_throw_notices (
  appearance_id uuid not null references public.pokemon_appearances(id) on delete cascade,
  slack_user_id text not null,
  reason text not null check (reason in ('unlinked', 'invalid', 'expired', 'already_thrown', 'no_ball')),
  created_at timestamptz not null default now(),
  primary key (appearance_id, slack_user_id, reason)
);

alter table public.pokemon_throw_notices enable row level security;
