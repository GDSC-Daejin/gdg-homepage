# 면접 일정 시스템 (Interview Scheduling) 설계

> 작성일: 2026-07-19 · 상태: 승인됨 · 구현 이관 대상: Codex

## 배경 / 목적

동아리 채용 면접(구글 미트)을 지금은 수기로 조율한다. 이 시스템은 **서류 통과자에게 면접 슬롯을 셀프 예약시키고, 지원자별 Google Meet 링크를 자동생성해 저장**한다. 저장된 Meet 링크(`meet_code`)는 후속 시스템(면접 녹음 요약 자동 적재, 별도 spec)의 매칭 키가 된다.

이 spec의 범위는 **일정 예약 + Meet 링크 자동생성까지**다. 녹음·요약은 범위 밖(키만 심어둔다).

## 핵심 제약 (확정 사실)

- **지원은 완전 익명이다.** `applications.applicant_id`는 nullable이고 지원자는 로그인 계정이 없다 ([src/actions/application.ts](../../../src/actions/application.ts)). → 지원자 예약은 인증 화면이 아니라 **이메일 매직링크(토큰)** 로 한다.
- **Meet 링크 자동생성**은 무료 Gmail + OAuth refresh token 방식. Google Meet API는 user authentication만 지원(서비스 계정 불가). 7일 토큰 만료를 피하려면 OAuth 동의화면 게시상태를 **Production**으로 둔다(검증 절차는 불필요 — 승인 계정 1개라 미검증 경고·100명 상한 모두 무해).
- 모집 4단계(원서접수 마감 / 서류검토 / 면접 / 최종합격)는 **기존 status로 매핑**하고 새 status를 만들지 않는다:
  - 서류 탈락 → 기존 `rejected` 처리 → **남은 `pending` = 서류 통과**
  - pending 통과자에게 링크 일괄발송(토큰 생성) = 면접 대상
  - 면접 후 → 기존 `accepted`(→member 승급) / `rejected`
  - 단계별 **날짜 기간** 관리는 이 시스템 밖(향후 recruiting_settings 확장 건)

## 데이터 모델

### 신규 테이블: `interview_slots`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | |
| `season` | text not null | 모집 시즌 (recruiting_settings.season과 정렬) |
| `starts_at` | timestamptz not null | 면접 시작 시각 |
| `duration_min` | int not null default 30 | 소요 시간 |
| `application_id` | uuid null → applications(id) on delete set null | 예약한 지원자. **null = 빈 슬롯** |
| `interviewer_id` | uuid null → profiles(id) | 운영진이 배정한 면접관 |
| `meet_uri` | text null | 예약 시 자동생성된 Meet 링크 |
| `meet_code` | text null | Meet API meetingCode — 후속 녹음 매칭 키 |
| `status` | text not null default 'open' check in ('open','booked','completed','canceled') | |
| `created_at` / `updated_at` | timestamptz | |

- RLS enable. 읽기: 공개 read는 열지 않음(슬롯 목록은 토큰 검증 RPC를 통해서만 노출). 쓰기: RPC(SECURITY DEFINER)로만.
- 인덱스: `(season, status)`, `(application_id)`.

### 기존 테이블 변경: `applications`

```sql
alter table public.applications
  add column interview_token uuid unique;
```

- 매직링크용 토큰. null = 면접 미초대. 값 존재 = 초대됨.
- `/interview?token=<uuid>`로 지원자를 이 application에 연결.

### 마이그레이션

- 신규 파일 `supabase/migrations/0029_interview_scheduling.sql` (현재 최신 0028).
- 기존 컨벤션 준수: 테이블 + RLS enable + 쓰기 RPC(`is_admin()` 가드 + `log_audit`), `revoke ... from public, anon` / `grant ... to authenticated` (익명 예약 RPC만 anon grant).

## RPC / 서버 액션

기존 패턴(`src/actions/*.ts` + SECURITY DEFINER RPC) 준수.

### 어드민 (admin-only, `is_admin()` 가드 + `log_audit`)

- `admin_create_interview_slots(p_season text, p_starts_at timestamptz[], p_duration_min int)` — 빈 슬롯 일괄 생성.
- `admin_assign_interviewer(p_slot uuid, p_interviewer uuid)` — 면접관 배정.
- `admin_send_interview_invites(p_application_ids uuid[])` — 선택한 pending 지원자에게 `interview_token` 발급(없으면 생성). 토큰 반환 → 서버 액션이 이메일 발송. (이메일 발송 자체는 TS 서버 액션, RPC는 토큰 발급만)
- `admin_regenerate_meet_link(p_slot uuid)` — Meet 생성 실패한 슬롯 재시도용(서버 액션이 Meet API 호출 후 저장).

### 지원자 (익명, 토큰 검증)

- `get_interview_context(p_token uuid)` — 토큰 → application 요약(이름, 시즌) + 자기 예약 여부 + 해당 시즌 빈 슬롯 목록.
- `book_interview_slot(p_token uuid, p_slot uuid)` — **원자적 claim**: `UPDATE interview_slots SET application_id=..., status='booked' WHERE id=p_slot AND status='open'`. 0행이면 `SLOT_TAKEN`. 이미 예약한 토큰이면 `ALREADY_BOOKED`. 성공 시 slot id 반환 → 서버 액션이 Meet API 호출해 `meet_uri/meet_code` 저장.

> Meet API 호출은 SQL RPC가 아니라 **TS 서버 액션**에서. RPC로 슬롯을 먼저 claim(원자성 확보)한 뒤, 액션이 `createMeetSpace()` 호출 → 성공 시 링크 저장. 실패해도 예약은 유지(폴백 참조).

## Meet API 연동 모듈

`src/lib/google-meet.ts` (서버 전용):

```
createMeetSpace(): Promise<{ meetingUri: string; meetingCode: string; name: string }>
```

- refresh token → access token 교환(`https://oauth2.googleapis.com/token`) → `POST https://meet.googleapis.com/v2/spaces`.
- env 3개(서버 전용, 클라이언트 노출 금지 — `SUPABASE_SERVICE_ROLE_KEY` 취급 패턴 준수):
  - `GOOGLE_MEET_CLIENT_ID`
  - `GOOGLE_MEET_CLIENT_SECRET`
  - `GOOGLE_MEET_REFRESH_TOKEN`
- `.env.example`에 3개 추가.
- 타임아웃/실패 시 throw → 호출부(예약 액션)가 폴백 처리.

## 화면

### 어드민 `/admin/interviews` (신규)

`/admin/applications` 옆 사이드바 항목 추가 ([src/app/admin/AdminSidebarNav.tsx](../../../src/app/admin/AdminSidebarNav.tsx)). 세 블록:

1. **슬롯 만들기** — `datetime-local` 인풋 여러 개 추가 → 일괄 생성. 시즌은 현재 모집 시즌 자동.
2. **면접 링크 발송** — pending 지원자 목록에서 **다중선택** → "면접 링크 보내기" → 토큰 발급 + 이메일 발송. (전원 자동 아님 — 보류자 제외 가능)
3. **예약 현황** — 예약 슬롯 리스트: 지원자 · 시간 · 면접관 배정 드롭다운 · Meet 링크 · 상태. Meet 링크 null이면 "재생성" 버튼. 지원자명 → `/admin/applications`로 연결.

### 지원자 `/interview?token=xxx` (신규, 공개·로그인 불필요)

- `get_interview_context`로 토큰 검증 → 지원자 이름 + 빈 슬롯 목록.
- 슬롯 선택 → `book_interview_slot` → Meet 링크 생성 → 확정 화면(시간·Meet 링크) + 확인 이메일.
- 이미 예약 → 자기 예약 표시(재예약 차단). 토큰 무효 → 에러 안내 페이지.

## 데이터 흐름 (예약 1건)

```
지원자 매직링크 클릭 (/interview?token=)
  → get_interview_context: 토큰 검증, 빈 슬롯 조회
  → 슬롯 선택
  → book_interview_slot: 원자적 claim (WHERE status='open')
  → [서버 액션] createMeetSpace() 호출
  → meet_uri/meet_code 저장 + 확인 이메일(sendInterviewInviteEmail)
  → 확정 화면
```

## 이메일

`src/lib/email.ts`에 함수 추가(기존 `sendResultEmail`의 Resend fetch 패턴 그대로):

- `sendInterviewInviteEmail({ to, name, season, bookingUrl })` — 매직링크 안내.
- `sendInterviewConfirmEmail({ to, name, startsAt, meetUri })` — 예약 확정 안내.
- `RESEND_API_KEY` 없으면 skip(기존과 동일).

## 에러 처리

| 상황 | 처리 |
|---|---|
| 동시 예약 경쟁 | `WHERE status='open'` 조건부 UPDATE. 진 쪽 → `SLOT_TAKEN` → "이미 예약된 시간이에요, 다시 선택" |
| **Meet API 실패** | **예약 유지**, `meet_uri` null. 어드민 예약현황에 "재생성" 버튼. 예약이 구글 장애로 막히면 안 됨 |
| 토큰 무효/재사용 | `get_interview_context`에서 감지 → 에러 안내 페이지 |
| 같은 토큰 재예약 | `ALREADY_BOOKED` → 기존 예약 표시 |
| refresh token 만료/무효 | 서버 로그 + 어드민에 Meet 생성 실패로 노출(재생성으로 복구) |

## 테스트 (vitest, 프레임워크 추가 없음)

- 슬롯 원자적 claim: 동시 예약 시 한 명만 성공(조건부 UPDATE 로직).
- 토큰 검증 분기: 무효 / 재사용 / 이미예약.
- Meet 모듈: fetch mock으로 `spaces.create` 응답 파싱 + 토큰 교환.

## 선행 세팅 (수동 — 구현 전/중)

1. ✅ Google Meet API enable (완료).
2. OAuth 동의화면 → 게시상태 **Production**, 스코프 `https://www.googleapis.com/auth/meetings.space.created` 추가.
3. OAuth 클라이언트 ID 생성 → client id/secret.
4. 동아리 Gmail 1회 승인 → **refresh token** 획득 → `.env`에 3개 저장. (토큰 획득용 1회성 스크립트는 구현 시 제공)

로그인용 GCP 프로젝트와 **분리된 프로젝트** 사용(민감 스코프 격리).

## 범위 밖 (명시)

- 면접 녹음·요약 자동 적재 (후속 spec — `meet_code`가 매칭 키).
- 모집 단계별 날짜 기간 관리 (recruiting_settings 확장 건).
- Google Calendar 이벤트/알림 생성 (Meet 링크만 생성).
- Meet 링크 자동생성의 서비스 계정/도메인 위임 방식(무료 Gmail이라 불가).
