-- 지원 폼 질문을 포지션별로 관리하고 질문 세트를 프리셋으로 저장

create table public.application_questions (
  id uuid primary key default gen_random_uuid(),
  position text not null check (position in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder')),
  label text not null check (char_length(trim(label)) between 1 and 300),
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_question_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  position text not null check (position in ('frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder')),
  questions jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.application_questions (position, label, sort_order)
select positions.position, questions.label, questions.sort_order
from unnest(array['frontend', 'backend', 'designer', 'beginner', 'pm', 'marketer', 'vibecoder']::text[]) as positions(position)
cross join (values
  ('자기소개', 0),
  ('지원 동기', 1),
  ('관심 분야', 2)
) as questions(label, sort_order);

alter table public.application_questions enable row level security;
create policy "application_questions: public read"
  on public.application_questions for select using (true);
create policy "application_questions: admin write"
  on public.application_questions for all using (public.is_admin()) with check (public.is_admin());

alter table public.application_question_presets enable row level security;
create policy "application_question_presets: admin all"
  on public.application_question_presets for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_apply_application_question_preset(p_preset uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_position text;
  v_questions jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select position, questions into v_position, v_questions
  from public.application_question_presets where id = p_preset;
  if not found then raise exception 'NOT_FOUND'; end if;
  if jsonb_typeof(v_questions) <> 'array' or jsonb_array_length(v_questions) = 0 then
    raise exception 'INVALID_INPUT';
  end if;

  delete from public.application_questions where position = v_position;
  insert into public.application_questions (position, label, sort_order, created_by)
  select v_position, trim(value #>> '{}'), (ordinality - 1)::integer, auth.uid()
  from jsonb_array_elements(v_questions) with ordinality
  where char_length(trim(value #>> '{}')) between 1 and 300;
end $$;

revoke execute on function public.admin_apply_application_question_preset(uuid) from public, anon;
grant execute on function public.admin_apply_application_question_preset(uuid) to authenticated;
