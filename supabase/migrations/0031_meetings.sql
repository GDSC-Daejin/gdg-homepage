-- 모지숲 회의록: 노션 공개 회의의 read-only 미러
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text not null unique,
  title text not null,
  meeting_date date,
  mode text not null default 'online' check (mode in ('online','offline')),
  summary text not null default '',
  notion_url text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.meetings enable row level security;
-- 미러에는 공개 회의만 들어오므로 로그인 사용자면 읽기 허용
create policy "meetings: read" on public.meetings for select
  using (auth.uid() is not null);
-- 동기화(쓰기)는 Staff만
create policy "meetings: admin all" on public.meetings for all
  using (public.is_admin()) with check (public.is_admin());
