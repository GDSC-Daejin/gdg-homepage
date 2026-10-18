-- 공지 템플릿: 반복되는 공지(정기 세션·스터디 등)를 다음 공지의 출발점으로 저장한다.
-- body는 공지와 같은 머리말 형식(장소·준비물)으로 담고, 일정은 매번 달라서 넣지 않는다.
create table public.notice_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  title text not null default '',
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.notice_templates enable row level security;
create policy "notice_templates: admin all" on public.notice_templates
  for all using (public.is_admin()) with check (public.is_admin());
