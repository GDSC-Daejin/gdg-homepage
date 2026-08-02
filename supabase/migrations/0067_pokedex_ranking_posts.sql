create table public.pokemon_ranking_posts (
  posted_on date primary key,
  message_ts text not null unique,
  created_at timestamptz not null default now()
);

alter table public.pokemon_ranking_posts enable row level security;
