-- 공개 지원: 로그인 없이 익명으로 지원서 제출
-- 지원자 신원/연락처를 applications 행에 직접 저장 (profiles 조인 불필요)

-- 1) applicant_id 선택화 + 신원 컬럼 추가
alter table public.applications
  alter column applicant_id drop not null;

alter table public.applications
  add column applicant_name text not null default '',
  add column student_no    text not null default '',
  add column major         text not null default '',
  add column phone         text not null default '',
  add column email         text not null default '';

-- 2) 중복 제약 교체: (applicant_id, season) → (email, season)
alter table public.applications
  drop constraint applications_applicant_id_season_key;

create unique index applications_email_season
  on public.applications (email, season) where email <> '';

-- 3) RLS: 익명(anon) insert 허용. 회원 사칭 방지를 위해 applicant_id는 null만 허용
create policy "applications: anon insert"
  on public.applications for insert to anon
  with check (applicant_id is null);
