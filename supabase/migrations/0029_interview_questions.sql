-- 포지션별 면접 질문 은행. position IS NULL = 공통 질문.
-- admin만 CRUD (기존 notices: admin all 정책과 동일 패턴)

create table public.interview_questions (
  id          uuid primary key default gen_random_uuid(),
  position    text,
  body        text not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint interview_questions_position_check
    check (position is null or position in ('frontend', 'backend', 'designer', 'beginner'))
);

alter table public.interview_questions enable row level security;

create policy "interview_questions: admin all"
  on public.interview_questions for all
  using (public.is_admin()) with check (public.is_admin());
