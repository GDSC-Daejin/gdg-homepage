-- 회원 커뮤니티 게시판 (자유게시판 + Q&A)
-- board 컬럼으로 목적만 나누고 테이블/RLS는 공유한다.

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('member', 'team_member', 'organizer')
  );
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('free', 'qna')),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  event_id uuid references public.events(id) on delete set null,
  accepted_comment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;
alter table public.comments enable row level security;

create policy "posts: member read" on public.posts
  for select using (public.is_member());
create policy "posts: member insert" on public.posts
  for insert with check (author_id = auth.uid() and public.is_member());
create policy "posts: own update" on public.posts
  for update using (author_id = auth.uid());
create policy "posts: own or admin delete" on public.posts
  for delete using (author_id = auth.uid() or public.is_admin());

create policy "comments: member read" on public.comments
  for select using (public.is_member());
create policy "comments: member insert" on public.comments
  for insert with check (author_id = auth.uid() and public.is_member());
create policy "comments: own update" on public.comments
  for update using (author_id = auth.uid());
create policy "comments: own or admin delete" on public.comments
  for delete using (author_id = auth.uid() or public.is_admin());

-- 채택: 질문 작성자만, 해당 글에 달린 댓글만 지정 가능
create or replace function public.accept_answer(p_post_id uuid, p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_comment_id is not null and not exists (
    select 1 from comments where id = p_comment_id and post_id = p_post_id
  ) then
    raise exception 'NOT_FOUND';
  end if;

  update posts
    set accepted_comment_id = p_comment_id, updated_at = now()
  where id = p_post_id and author_id = auth.uid() and board = 'qna';

  if not found then raise exception 'FORBIDDEN'; end if;
end $$;
