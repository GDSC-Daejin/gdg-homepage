-- 설문 질문 프리셋: 관리자가 질문 세트를 이름 붙여 저장해두고 새 설문 생성 시 불러쓰기
create table public.survey_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  questions jsonb not null default '[]'::jsonb, -- surveys.questions와 동일 형태
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.survey_presets enable row level security;
create policy "survey_presets: admin all"
  on public.survey_presets for all
  using (public.is_admin()) with check (public.is_admin());
