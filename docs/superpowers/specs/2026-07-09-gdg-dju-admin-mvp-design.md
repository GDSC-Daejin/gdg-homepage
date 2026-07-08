# GDG DJU 동아리 관리 시스템 — MVP 설계

날짜: 2026-07-09
상태: 승인됨

## 목표

GDG DJU 동아리의 회원·출석·이벤트 운영을 하나의 웹 앱으로 관리한다.
운영진용 어드민과 일반 회원용 화면을 모두 포함하며, 배포·운영 비용은 0원이어야 한다.

## 확정된 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 스택 | Next.js(App Router) + TypeScript + Tailwind + Supabase | Spring Boot + SQLite는 무료 배포 불가(무료 호스팅은 휘발성 디스크, SQLite 데이터 유실). Vercel + Supabase는 완전 무료 |
| 배포 | Vercel Hobby (프론트+서버 로직), Supabase Free (DB·인증) | 별도 백엔드 서버 없음 |
| 인증 | Supabase Auth — Google OAuth | GDG 특성상 전원 구글 계정 보유 |
| 사용자 범위 | 운영진 어드민 + 회원용 화면 + 지원자 화면 | 출석 체크·세션 신청은 회원이 직접 수행 |
| MVP 범위 | 회원 관리 + 출석 + 이벤트/세션 3종 | 자료실·설문·통계 확장·뱃지·예산·감사로그는 2차 |
| 디자인 시스템 | Claude Design 프로젝트에서 DesignSync로 import | 프로젝트: claude.ai/design/p/84e18722-9ad3-4b0d-ab35-974607dfdc9d |

## 아키텍처

```
Vercel (무료)                          Supabase (무료)
┌─────────────────────────┐          ┌──────────────────┐
│ Next.js App Router + TS │  ◄────►  │ Postgres (DB)    │
│  /admin/*   운영진 화면  │          │ Auth (Google)    │
│  /(member)  회원용 화면  │          │ RLS (2차 방어)   │
│  Server Actions (쓰기)  │          └──────────────────┘
└─────────────────────────┘
```

- **읽기**: Server Component에서 Supabase 서버 클라이언트로 조회.
- **쓰기**: Server Action에서 role 검사 후 처리. 권한 로직은 서버 코드에 집중.
- **RLS**: 모든 테이블에 활성화하되 2차 방어선. 정책은 단순하게 유지(본인 행 접근 + admin 전체 접근).
- 클라이언트에서 supabase-js로 DB 직접 쓰기는 하지 않는다.

## 역할과 권한

| 역할 | 권한 |
|---|---|
| `admin` (운영진) | 전체 회원/지원서/이벤트/출석 관리 |
| `member` (일반 회원) | 본인 프로필 편집, 이벤트 조회/신청/취소, 출석 코드 입력 |
| `applicant` (신입 지원자) | 지원서 제출, 본인 지원서 결과 확인 |

- 첫 Google 로그인 시 `profiles` 행 자동 생성, 기본 role은 `applicant`.
- 지원서 합격 처리 시 role을 `member`로 승격. admin 지정은 admin만 가능.
- 회원 상태: `active` / `dormant`(휴면) / `withdrawn`(탈퇴) — admin이 변경.

## DB 스키마

```
profiles
  id uuid PK (= auth.users.id)
  name text, student_no text, major text, phone text
  interests text[]            -- Android/Web/ML 등
  role text: admin|member|applicant
  status text: active|dormant|withdrawn
  joined_at timestamptz

applications
  id uuid PK
  applicant_id uuid FK → profiles
  season text                 -- 예: "2026-2"
  answers jsonb               -- 질문/답변
  status text: pending|accepted|rejected
  reviewed_by uuid, reviewed_at timestamptz

events
  id uuid PK
  type text: session|study|devfest
  title text, description text
  starts_at timestamptz, location text, speaker text
  capacity int                -- null이면 무제한
  attendance_code text        -- 6자리, 어드민이 발급/재발급
  created_by uuid

event_registrations
  id uuid PK
  event_id FK, user_id FK, UNIQUE(event_id, user_id)
  status text: confirmed|waitlisted
  created_at timestamptz      -- 대기열 순서 기준

attendances
  id uuid PK
  event_id FK, user_id FK, UNIQUE(event_id, user_id)
  checked_at timestamptz
```

## 핵심 흐름

### 출석 체크
1. 어드민이 이벤트 상세에서 6자리 출석 코드 발급(재발급 가능).
2. 회원이 출석 페이지에서 코드 입력 → 검증 후 `attendances` 기록.
3. QR은 코드가 프리필된 URL을 QR로 표시하는 것으로 갈음(별도 스캐너 불필요).
4. 출석률 미달 회원은 어드민 화면에 경고 표시. 자동 이메일 발송은 2차.

### 이벤트 신청 / 대기열
1. 회원이 신청 → 정원 미달이면 `confirmed`, 초과면 `waitlisted`.
2. confirmed 취소 발생 시 대기열 1번(가장 오래된 waitlisted)을 자동 승격.
3. 동시 신청 경합은 DB 트랜잭션(Postgres function)으로 처리.

### 지원서 심사
1. 지원자가 로그인 후 지원서 제출(시즌별 1회).
2. 어드민이 목록에서 검토 → 합격(role 승격) / 불합격 처리.

## 화면 목록 (MVP)

**어드민 (`/admin`)** — admin role만 접근
- 대시보드: 회원 수, 활동 회원, 다가오는 이벤트, 최근 출석률 요약
- 회원: 목록(검색/필터), 상세, role·status 변경
- 지원서: 시즌별 목록, 상세, 합격/불합격 처리
- 이벤트: 목록, 생성/수정, 상세(신청자·대기열·출석 현황·출석 코드)
- 출석: 회원별 출석률 테이블, 미달자 경고 표시

**회원 (`/`)**
- Google 로그인 / 온보딩(프로필 입력)
- 내 프로필 조회/편집
- 이벤트 목록, 상세, 신청/취소 (대기열 순번 표시)
- 출석 코드 입력

**지원자**
- 지원서 작성/제출, 결과 확인

## 에러 처리 / 엣지 케이스

- 출석 코드 불일치, 미신청 이벤트 출석 시도, 중복 출석 → 사용자에게 명확한 한국어 메시지.
- 정원 경합: Postgres function 내 트랜잭션으로 원자 처리.
- 미로그인 접근: 로그인 페이지로 리다이렉트. member가 /admin 접근 시 403.
- Supabase 무료 프로젝트는 7일 무사용 시 일시정지 — 실사용으로 유지, README에 복구 방법 명시.

## 테스트

- 권한 검사·대기열 승격·출석 검증 등 핵심 로직은 순수 함수/Server Action 단위로 분리해 Vitest 테스트.
- DB function(대기열 승격)은 SQL 테스트 또는 로컬 Supabase에서 검증.

## 2차 범위 (이번에 만들지 않음)

자료실(Storage), 설문/만족도, 통계 대시보드 확장, 공지+알림, 뱃지/포인트, 예산 관리, 감사 로그, 출석 미달 자동 이메일.
