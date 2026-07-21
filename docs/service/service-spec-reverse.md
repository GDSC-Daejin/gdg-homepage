# GDG on Campus 대진대 — 서비스 종합 명세서 (역추적)

> **문서 성격**: 이미 구현·기획된 산출물(마이그레이션·스키마·서버 액션·라우트)을 근거로 **역추적**해 PRD·기능명세서·기획서를 하나로 합친 종합 보고서.
> **원칙**: 코드로 확인되는 사실만 기술한다. "왜 이렇게 결정했나"(의도·트레이드오프)는 코드에 남지 않으므로 추론하지 않고, 확인 불가한 항목은 [§13](#13-코드로-확인되지-않는-것추론-배제)에 공백으로 표시한다.
> **근거 표기**: 각 항목 끝 `〔파일〕`는 사실의 출처. 마이그레이션 번호는 `supabase/migrations/`, 액션은 `src/actions/`, 스키마는 `src/lib/schemas.ts` 기준.

---

## 1. 서비스 개요

**GDG on Campus 대진대학교** 동아리 운영 웹앱. 하나의 앱에서 신입 모집·심사·면접, 회원의 이벤트 참여·출석, 운영진의 관리 업무를 처리한다. 〔docs/service/service-wiki.md, src 라우트 구조〕

- 현재 시즌 상수: `CURRENT_SEASON = "2026-2"` 〔src/lib/constants.ts〕
- 인증: Google OAuth (Supabase Auth) 〔src/app/auth, src/lib/supabase〕
- 비로그인 "둘러보기(데모) 모드": 예시 데이터로 화면 열람 〔src/lib/demo.ts, demoData.ts, src/actions/demo.ts〕

---

## 2. 기술 스택 · 아키텍처

| 영역 | 사실 |
|---|---|
| 프레임워크 | Next.js App Router (버전은 저장소 로컬 `node_modules/next` 기준, 관례와 다를 수 있음 — AGENTS.md 명시) 〔AGENTS.md〕 |
| DB/인증 | Supabase (PostgreSQL + Auth + RLS) 〔supabase/migrations〕 |
| 검증 | Zod 스키마 (폼·서버 액션 공용) 〔src/lib/schemas.ts〕 |
| 서버 로직 | Server Actions (`src/actions/*`) + PostgreSQL `SECURITY DEFINER` RPC 〔0001_init 외〕 |
| 스타일 | Tailwind 〔docs/design/mobile-design-system.md〕 |

**보안 아키텍처 (코드로 확인되는 3중 구조):**
1. **RLS 전 테이블 활성화** — 모든 테이블에 `enable row level security`. 〔0001_init:79–85〕
2. **쓰기는 SECURITY DEFINER RPC로만** — `event_registrations`·`attendances` 등은 직접 INSERT 정책이 없고, 정원 경합·출석검증 로직을 담은 RPC를 경유해야만 기록된다. 〔0001_init:103〕
3. **함수 EXECUTE 기본 차단** — `revoke execute on all functions ... from public, anon` 후 필요한 함수만 `authenticated`에 grant. 〔0001_init:211〕
4. **민감 컬럼 봉인** — `profiles.role`·`status`는 본인도 못 바꾸도록 컬럼 UPDATE 권한에서 제외, admin RPC 경유만 허용. 〔0001_init:90–91〕

---

## 3. 사용자 · 역할 모델

### 3.1 역할(role) — 4단계 〔0009_roles_positions〕
| role | 의미 | 부여 방식 |
|---|---|---|
| `organizer` | 오거나이저, **DB 유니크 인덱스로 전체 1명 강제** | admin이 수동 승격 (`ORGANIZER_EXISTS` 에러로 2명째 차단) |
| `team_member` | 팀 멤버(운영진 다수) | admin 이메일(`admin_emails`) 가입 시 자동 |
| `member` | 정회원 | 지원 합격 시, 또는 구글 신규 가입 기본값 |
| `applicant` | 지원자 | (초기 기본값이었으나 0022에서 신규 가입 기본이 member로 변경) |

- 운영진 판정 `is_admin()` = role이 `organizer` 또는 `team_member`. 〔0009〕
- 신규 가입 기본 role: **member** (0022에서 변경). `admin_emails` 등록 이메일은 `team_member`. 〔0022, 0009〕
- 화면 분기는 실질적으로 **회원 / 운영진 2단계**. 〔docs/service/service-wiki.md §2〕

### 3.2 상태(status) 〔0001_init:10〕
`active` / `dormant` / `withdrawn` — admin RPC(`admin_set_status`)로만 변경.

### 3.3 포지션(position) 〔0009, 0027〕
`frontend` / `backend` / `designer` / `beginner`(비기너, 0027 추가). 본인이 온보딩·프로필에서 선택(컬럼 권한 부여), admin도 `admin_set_position`으로 지정 가능.

### 3.4 학적 상태(academic_status) 〔0034, schemas.ts〕
`enrolled` / `leave`(휴학) / `graduated` / `completed`(수료) — nullable.

---

## 4. 데이터 모델 (테이블 인벤토리)

전체 테이블 (마이그레이션 CREATE TABLE 기준):

| 도메인 | 테이블 |
|---|---|
| 사용자 | `profiles`, `admin_emails` |
| 모집·심사 | `applications`, `recruiting_settings`, `submission_throttle` |
| 면접 | `interview_slots`, `interview_questions` |
| 이벤트·출석 | `events`, `event_codes`, `event_registrations`, `attendances`, `attendance_attempts` |
| 포인트·뱃지 | `point_logs`, `badges`, `user_badges` |
| 콘텐츠 | `notices`, `surveys`, `survey_responses`, `survey_presets`, `posts`, `comments`, `inquiries` |
| 그룹 | `groups`, `group_members` |
| 회의록 | `meetings` |
| 장소 | `places` |
| 알림 | `notifications` |
| 운영 | `budget_entries`, `audit_logs` |
| (제거됨) | `sponsors` — 0015에서 미사용 삭제 |

---

## 5. 공개(비로그인) 기능

### 5.1 홍보 페이지 〔src/app/about, team, projects, events, landing-preview〕
소개 / 운영진 / 프로젝트 / 이벤트(공개) / 랜딩. 로그인 불필요.

### 5.2 공개 지원 〔0010, 0019, 0035, src/actions/application.ts〕
- **로그인 없이 익명으로 지원서 제출** 가능(0010). 입력: 이름·학번·전공·전화·이메일·시즌·지원파트(position)·질문답변(answers). 〔schemas.ts applicationSchema〕
- **중복/남용 방지 2단 방어** (0035):
  - (A) DB `BEFORE INSERT` 트리거: 같은 시즌 내 **학번 또는 전화 중복 차단**(`DUPLICATE_APPLICANT`), 최근 1분 20건 이상이면 전역 속도 차단(`RATE_LIMITED`).
  - (B) 앱 레이어 IP 스로틀: `submission_throttle` 테이블, **IP당 10분에 5회 초과 차단**.
- 모집 마감·파트 검증은 anon insert 정책에서 수행(0019). (email, season) 유니크.

### 5.3 면접 예약 (합격 후보 대상) 〔0029_interview_scheduling, src/actions/interview.ts〕
- `applications.interview_token`으로 열리는 링크. 로그인 불필요.
- `interview_slots`(시간·소요분) 중 하나를 `book_interview_slot` RPC로 예약. 슬롯 시각은 미래만 허용. 〔schemas.ts interviewSlotsSchema〕

---

## 6. 회원 기능

라우트 그룹 `src/app/(member)/`. 현재 사이드바 통합 이후 구조.

### 6.1 이벤트 · 신청 · 대기열 〔0001_init, src/actions/registration.ts〕
- 이벤트 유형: `session` / `study` / `mogakco`(모각코) / `party`. (초기 devfest는 0008에서 제거) 〔schemas.ts eventSchema〕
- 이벤트 필드: 제목·설명·시작/종료일시·장소(place_id)·발표자·정원(capacity, nullable). 〔schemas.ts, 0011, 0026〕
- **신청 `register_for_event` (원자적 정원 경합 처리):** 회원만 가능(`NOT_MEMBER`), 중복 차단(`ALREADY_REGISTERED`). confirmed 수 < 정원이면 `confirmed`, 아니면 `waitlisted`. 정원 null이면 무제한. 〔0001_init:106〕
- **취소 `cancel_registration`:** confirmed 취소 시 대기열 최선착 1명 자동 승격, 승급자 이름 반환(알림용). 〔0024〕
- 대기 순번 조회 `my_waitlist_position` (타인 행은 RLS로 안 보이므로 RPC 필요). 〔0003〕
- 회원 이벤트 상세에서 신청자 **이름+상태만** 노출(`event_registrants`). 〔0033〕

### 6.2 출석 〔0001_init, 0036, src/actions/attendance.ts〕
- 출석 코드는 **영숫자 대문자 6자**(`^[A-Z0-9]{6}$`). 회원에게 숨김 — `event_codes`는 admin RLS 전용. 〔schemas.ts attendCodeSchema, 0001_init:39〕
- **`check_attendance` 검증 순서:** confirmed 신청자여야 함(`NOT_REGISTERED`) → 코드 발급됨(`NO_CODE_ISSUED`) → 코드 일치(`INVALID_CODE`) → 중복 아님(`ALREADY_CHECKED`).
- **시도 횟수 제한(0036):** `attendance_attempts` 테이블, **오답 5회/10분 초과 시 `TOO_MANY_ATTEMPTS`**. 10분 경과 시 카운터 리셋.
- 출석 성공 시 **자동 +10 포인트** (`grant_attendance_points` 트리거, reason '출석'). 〔0004_phase2〕
- 출석 이력은 프로필로 통합, `/attend`는 프로필로 리디렉트. 〔최근 커밋 9e01365〕

### 6.3 포인트 · 뱃지 〔0004_phase2, src/lib/points.ts〕
- `point_logs`(amount·reason·ref_event). 월별 합산 `sumPointsInMonth`. 〔src/lib/points.ts〕
- `badges` / `user_badges` — 운영진이 수여. 회원은 프로필에서 열람.

### 6.4 공지 〔0004_phase2, src/actions/notice.ts〕
`notices`(title·body·published·published_at). 회원은 발행된 공지 열람.

### 6.5 커뮤니티 (자유게시판 · 질문답변) 〔0021_member_board, src/actions/post.ts〕
- `posts.board` = `free`(자유) / `qna`(질문답변). 댓글 `comments`.
- Q&A는 답변 채택 `accept_answer` RPC. 〔0021〕
- 게시판·질문답변·회의록이 **커뮤니티 탭으로 통합**(최근 커밋 3e6879f).

### 6.6 회의록 〔0031_meetings, src/lib/notion.ts〕
`meetings` — **노션 공개 회의의 read-only 미러**.

### 6.7 설문 〔0004_phase2, 0013, 0014, src/actions/survey.ts〕
- `surveys.questions` = `[{id, type:'rating'|'text', label}]`. 응답 `survey_responses.answers` = `{qid: number|string}`.
- **응답 수정**: 본인 응답을, 설문이 열려 있는 동안만 수정 가능(0014).

### 6.8 문의 〔0012, src/actions/inquiry.ts〕
`inquiries.category` = `general`/`suggestion`/`bug`/`activity`/`etc`. 상태 `pending`/`answered`. 운영진이 답변(`admin_answer_inquiry`).

### 6.9 자료실 〔src/app/(member)/materials, src/lib/notion.ts〕
노션 연동 학습 자료.

### 6.10 프로필 · 온보딩 〔0023, 0028, 0034, src/actions/profile.ts〕
- 이름·학번·전공·전화·관심분야·포지션·영어 닉네임(0023, 선택)·학적상태(0034)·아바타(0028).
- 필수 입력(온보딩): 닉네임·학번·전공·전화·포지션. 〔schemas.ts profileSchema〕

### 6.11 그룹 (스터디 · 프로젝트) 〔0030_groups, src/actions/group.ts〕
- `groups`(지속 그룹) + `group_members`(자가가입 명단). `join_group` RPC. 정원 제한 있음.

### 6.12 인앱 알림 〔0025_notifications, src/actions/notification.ts〕
`notifications` — 1:1 타겟 알림(수신자 1명, fan-out 없음).

---

## 7. 운영진 기능

라우트 `src/app/admin/`. 사이드바는 대시보드 / 운영 / 모집 / 콘텐츠 / 관리 그룹으로 묶임. 콘텐츠·관리·모집 그룹은 기본 접힘 처리(최근 커밋). 〔최근 커밋 e483b48, b3e97a5〕

| 화면 | 기능 · 근거 |
|---|---|
| 대시보드 | 운영 요약 〔src/app/admin/page〕 |
| 회원 | 목록·상세, role/status/position/학적/프로필 수정 (admin RPC) 〔0007, 0009, 0034, member.ts〕 |
| 이벤트 | 생성·수정, **출석코드 발급** `admin_set_event_code`(md5 6자) 〔0001_init:198, event.ts〕 |
| 장소 | 장소 풀, lat/lng는 Geocoding 결과 재사용 〔0026, place.ts, geocode.ts〕 |
| 출석 | 출석 현황·관리 〔attendance-admin.ts〕 |
| 지원 심사 | 상태 4단계 `pending`/`waiting`(심사중, 0016)/`accepted`/`rejected`, 심사 메모(0017), **합격 시 role→member 자동 승격** 〔0016, 0017, application.ts〕 |
| 면접 일정 | 슬롯 생성·배정, 초대 발송 `admin_send_interview_invites`, 면접관 배정 〔0029, interview.ts〕 |
| 면접 질문 | 포지션별 질문 은행, `position IS NULL`=공통 〔0029_interview_questions〕 |
| 모집 설정 | 시즌·오픈여부·모집파트·지원기간(시작~종료일) 〔0017, 0027, recruiting.ts〕 |
| 공지 | 작성·발행 `admin_publish_notice` 〔0005, notice.ts〕 |
| 설문 | 생성·수정, **질문 프리셋**(0013), 결과 집계 〔survey.ts, survey-results.ts〕 |
| 문의 | 답변 처리 〔inquiry.ts〕 |
| 자료실 | 노션 연동 관리 |
| 포인트/뱃지 | 수동 지급 `admin_grant_points`(0 불가), 뱃지 수여 `admin_award_badge` 〔0004, points.ts〕 |
| 예산 | `budget_entries` 수입/지출·분류·금액·메모 〔0004, budget.ts〕 |
| 그룹 배정 | 관리자 배정도 자가가입과 동일 정원 제한 〔0032〕 |
| 감사 로그 | `audit_logs` 열람 (아래 §9) 〔audit.ts〕 |

---

## 8. 핵심 비즈니스 규칙 (요약)

1. **정원·대기·승격**: 신청은 원자적(`for update` 락) 처리, 취소 시 선착순 자동 승격. 〔0001, 0024〕
2. **출석 검증·시도 제한**: 6자 코드, confirmed만, 5회/10분 제한, 성공 시 +10 포인트. 〔0001, 0036, 0004〕
3. **오거나이저 유일성**: DB 유니크 인덱스로 전체 1명 강제. 〔0009〕
4. **지원 남용 방지**: 학번/전화 중복 차단 + IP 스로틀 + 전역 속도 캡. 〔0035〕
5. **권한 봉인**: role/status는 RPC 경유만, 함수 EXECUTE 화이트리스트. 〔0001, 0009〕

---

## 9. 자동화 · 알림

| 항목 | 사실 |
|---|---|
| 이벤트 리마인더 | Cron `/api/cron/event-reminder` — 다가오는 이벤트+신청수로 메시지 구성 후 발송 〔src/lib/event-reminder.ts〕 |
| 출석 경고 | Cron `/api/cron/attendance-warning` — `computeAttendanceWarnings`로 경고 대상 산출 〔src/lib/attendance-stats.ts〕 |
| Slack | 이벤트·출석 알림 자동 발송 〔src/lib/slack.ts〕 |
| 이메일 | 합불 통보 등, 발송 기록은 `audit_logs` 재사용(별도 테이블 없음) 〔0018, src/lib/email.ts〕 |
| 인앱 알림 | 1:1 타겟 〔0025〕 |
| GA4 | 애널리틱스 〔src/lib/ga4.ts, analytics.ts〕 |

**감사 로그(audit_logs) 특이사항**: 0031에서 **기존 데이터는 보존하되 모든 RPC의 신규 기록은 중단**됨. 즉 현재 감사 로그는 비활성 상태(과거 데이터만 존재). 〔0031_disable_audit_logging〕

---

## 10. 외부 연동

| 연동 | 용도 | 근거 |
|---|---|---|
| Supabase | 인증·DB·RLS | supabase/* |
| Google OAuth | 로그인 | src/app/auth |
| Slack | 이벤트·출석 알림 | src/lib/slack.ts |
| 이메일 | 합불·안내 | src/lib/email.ts |
| Notion | 회의록·자료실 read-only 미러 | src/lib/notion.ts |
| Google Meet | 면접/온라인 연동 | src/lib/google-meet.ts |
| Geocoding | 장소 좌표 | src/lib/geocode.ts |
| 네이버 지도 | 장소 딥링크 | docs/naver-map-* |

---

## 11. 도메인 이력 (마이그레이션 타임라인)

역추적 관점에서 "무엇이 언제 어떻게 바뀌었나"는 코드로 확인되는 결정의 궤적이다.

- 0001 기반: profiles/applications/events/출석 + 핵심 RPC + RLS.
- 0004 Phase2: 공지·설문·포인트·뱃지·예산.
- 0008 이벤트 유형 개편(devfest→mogakco), 0011 종료일시·주소, 0026 장소 풀.
- 0009 역할 개편(admin→organizer/team_member) + 포지션, 0027 비기너 추가.
- 0010 공개(익명) 지원, 0016 심사 4단계, 0017 모집 설정, 0035 남용 방지.
- 0021 커뮤니티 게시판, 0025 알림, 0029 면접 시스템, 0030 그룹, 0031 회의록.
- 0015 스폰서 제거, 0031 감사 로그 신규 기록 중단.
- 0036(최신) 출석 시도 횟수 제한.

---

## 12. 현재 진행 중 / 미완 (커밋·미커밋 상태 기준)

- **사이드바 정보구조(IA) 통합** 진행 중: 회원 8메뉴 통합, 콘텐츠·관리·모집 그룹 접힘. 〔최근 커밋 3e6879f, e483b48, b3e97a5, bcb822c〕
- **미커밋 변경(작업 트리)**: `schemas.ts`·`errors.ts`·`schemas.test.ts` 수정, 0036 출석 시도 제한 마이그레이션 및 테스트 신규. 〔git status〕
- 관련 계획 문서 존재: `docs/plans/analytics-dashboard-phase2.md`, `docs/security/security-hardening-remaining.md`, `docs/PRD/ia-adoption-plan.md`.

---

## 13. 코드로 확인되지 않는 것(추론 배제)

아래는 **의도적으로 채우지 않은 공백** — 코드에 사실이 없어 추론하지 않았다. 필요하면 팀 확인 후 별도 기입해야 한다.

- 각 기능의 **도입 배경·목표 지표·성공 기준(KPI)** — 코드에 없음.
- 역할/상태/포지션 enum의 **비즈니스적 정의**(예: dormant/withdrawn 운영 기준).
- 포인트 +10, 대기열 정책, 시도 5회/10분 등 **수치의 근거**(코드엔 값만 있고 사유 없음).
- **우선순위·로드맵**(진행 중 IA 통합의 최종 확정안은 미정 — service-wiki §8 "팀 합의 필요"로 명시됨).
- 사용자 수·이벤트 빈도 등 **실사용 데이터**.

---

_근거 파일 총람_: `supabase/migrations/0001–0036`, `src/lib/schemas.ts`·`errors.ts`·`constants.ts`, `src/actions/*`, `src/app/**` 라우트, `docs/service/service-wiki.md`. 기존 페이지별 상세는 `docs/PRD/{admin,member,public}/`.
