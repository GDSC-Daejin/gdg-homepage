-- 이벤트 시드 데이터 (session/study, 정원 2짜리 스터디 1건 포함)
insert into public.events (type, title, description, starts_at, location, speaker, capacity) values
  ('session', 'GDG DJU 정기 세션 - Next.js 15 살펴보기', 'App Router와 서버 컴포넌트를 함께 살펴봅니다.', now() + interval '7 days', '대전대학교 공학관 401호', '김개발', null),
  ('study', '알고리즘 스터디 3기', '주 1회 코딩 테스트 문제 풀이 스터디입니다.', now() + interval '3 days', '대전대학교 학생회관 스터디룸', '', 2),
  ('session', '신입 부원 온보딩 세션', 'GDG DJU 소개 및 활동 안내 세션입니다.', now() + interval '14 days', '대전대학교 공학관 401호', '박운영', null);

-- 참고: profiles는 auth.users와 1:1로 연동되어 seed로 직접 만들 수 없다.
-- 로컬 검증 절차 (Supabase Studio, http://localhost:54323):
--   1. Authentication > Users > Add user 로 테스트 유저 1~3명 생성
--   2. on_auth_user_created 트리거가 public.profiles 행을 자동 생성함 (role='applicant', status='active')
--   3. Table Editor > profiles 에서 role을 'member' 또는 'admin'으로 수동 변경
--   4. admin 계정으로 admin_set_event_code(event_id)를 실행해 출석 코드 발급 후 흐름 검증

-- 기본 뱃지 세트 (획득 조건은 description에 서술, 수여는 관리자 수동)
insert into public.badges (icon, name, description) values
  ('🌱', '첫 출석', '첫 이벤트 출석'),
  ('🔥', '개근', '한 시즌 확정 이벤트 출석률 100%'),
  ('🎤', '스피커', '세션/스터디에서 발표'),
  ('📚', '스터디 리더', '스터디 1회 이상 리드'),
  ('🎉', '모각코', '모각코 참여'),
  ('💡', '아이디어 뱅크', '채택된 건의 3회')
on conflict (name) do nothing;

-- 정기세션 만족도 기본 프리셋 (평점 5문항) — 설문 생성 시 '불러오기'로 사용
insert into public.survey_presets (name, questions) values
  ('정기세션 만족도 5문항', '[
    {"id":"q1","type":"rating","label":"이번 정기세션의 전반적인 만족도는 어떠셨나요?"},
    {"id":"q2","type":"rating","label":"세션에서 다룬 내용이 유익했나요?"},
    {"id":"q3","type":"rating","label":"발표·진행 방식은 이해하기 쉬웠나요?"},
    {"id":"q4","type":"rating","label":"세션 난이도는 적절했나요?"},
    {"id":"q5","type":"rating","label":"세션 장소와 진행 시간은 적절했나요?"}
  ]'::jsonb);

-- 어드민 부트스트랩: 아래에 운영진 구글 이메일을 등록하면 가입 시 자동으로 admin 역할
-- insert into public.admin_emails (email) values ('lead@gmail.com');
