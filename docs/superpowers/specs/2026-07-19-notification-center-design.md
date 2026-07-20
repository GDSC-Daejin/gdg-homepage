# 인앱 알림 센터 — 설계안 (Spec)

> 2026-07-19. 승인된 설계. 구현은 Codex에 인계 예정 — 이 문서 + 구현계획서까지가 산출물.

## 배경 · 문제

서비스의 비동기 사건(정원 승급·문의 답변·배지 수여)이 전부 "회원이 다시 방문해야 앎"에 묶여 있다. 정원 승급 알림·이벤트 리마인더는 이미 있지만 **`postSlack`으로 스태프 채널에만** 발송돼(`src/actions/registration.ts:45`, `src/lib/event-reminder.ts`) 정작 대상 회원 개인에게는 도달하지 않는다. 홈 대시보드(`HomeDashboard.tsx`)가 완성되면서 회원용 알림을 꽂을 무대가 생겼다.

**목표**: 회원 개인에게 도달하는 인앱 알림 레이어를 추가한다. 기존 Slack(스태프용)은 그대로 병존.

## 스코프

### MVP에 포함
- **알림 이벤트 3종** (전부 1:1 타겟, 수신자 1명, fan-out 없음):
  - 정원 승급 (waitlist→confirmed)
  - 문의 답변 완료
  - 배지 수여
- **소비자 UI**: 헤더 벨 + 드롭다운 (안 읽음 배지, 항목 클릭 시 이동+읽음, 모두 읽음)
- **Demo Mode**: 벨은 정적 예시 알림 표시, write는 기존 no-op 정책 유지

### 스코프에서 제외 (YAGNI)
- 전용 `/notifications` 페이지 (드롭다운으로 충분)
- 새 공지 fan-out 알림 (회원 수만큼 row — 볼륨 리스크)
- 실시간 푸시(웹소켓/SSE) — 폴링/페이지 로드 read로 충분
- Slack 제거 — 스태프용으로 유지
- Community Store 시임 편입 — 시임이 현재 read 전용이고 형제 액션들이 다 Supabase 직접 호출이라 이번엔 맞춤. 후속 과제로 노트.

## 핵심 아키텍처 결정

### 알림 생성을 기존 RPC 안에 넣는다 (별도 알림 서비스 X)

알림은 **행동 주체(스태프)와 수신자(회원)가 다르다.** 따라서:
- 순진한 "본인 것만 insert" RLS로는 불가 (staff가 member 앞으로 insert해야 함)
- 별도 서비스 함수/RPC를 두면 액션과 알림 생성이 두 번의 쓰기로 갈라져 원자성이 깨짐

→ **이미 존재하는 3개 RPC 안에서 알림 row를 같이 insert.** SECURITY DEFINER 함수라 RLS를 우회하고, 같은 트랜잭션이라 원자적이며, 서버 액션 TypeScript 코드는 사실상 안 바뀐다(마이그레이션만 수정).

| 사건 | 수정할 기존 RPC | 수신자 | link |
|---|---|---|---|
| 정원 승급 | `cancel_registration` (migration 0024에서 이미 승급자 반환) | 승급된 회원 | `/events/{event_id}` |
| 문의 답변 | `admin_answer_inquiry` | 문의 작성자(`inquiries.user_id`) | `/inquiries` |
| 배지 수여 | `admin_award_badge` | 수여 대상 user | `/profile` |

각 RPC는 액션 수행 후, 대상 user_id 앞으로 `notifications` row 하나를 insert. 문구(title/body)는 생성 시점에 확정해 denormalize.

## 데이터 모델 — `notifications` (migration 0025)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `recipient_id` | uuid not null → profiles(id) on delete cascade | |
| `type` | text not null | `'registration_promoted'` \| `'inquiry_answered'` \| `'badge_awarded'` (CHECK 제약) |
| `title` | text not null | 렌더된 문구. join 없이 읽기 |
| `body` | text | nullable, 부가 설명 |
| `link` | text | nullable, 클릭 시 이동 경로 |
| `read_at` | timestamptz | nullable, null = 안 읽음 |
| `created_at` | timestamptz not null default now() | |

**인덱스**:
- `(recipient_id, created_at desc)` — 목록 조회
- 부분 인덱스 `(recipient_id) where read_at is null` — 안 읽음 카운트

**RLS**:
- SELECT: `recipient_id = auth.uid()`
- UPDATE: `recipient_id = auth.uid()` (read_at 갱신용)
- INSERT: 직접 insert 불가. 위 3개 SECURITY DEFINER RPC 경유로만.
- DELETE: MVP에선 불필요(정책 없음).

## 소비자 UI — 헤더 벨 + 드롭다운

- **위치**: `src/app/(member)/MemberShell.tsx` 헤더 영역. 벨 컴포넌트 신규.
- **서버 데이터**: 로그인 회원의 최근 알림 N개(desc) + 안 읽음 카운트(`read_at is null`).
- **드롭다운**: 최근 알림 목록. 각 항목 = title/body/상대시간. 클릭 → `link` 이동 + 그 알림 read 처리.
- **모두 읽음**: `markAllRead()` 액션.
- **읽음 처리 액션**: `markNotificationsRead(ids)` / `markAllRead()` — "본인 것 update" RLS로 허용. 신규 파일 `src/actions/notification.ts`.
- **빈 상태**: 알림 없을 때 안내 문구.

## Demo Mode

- 벨은 데모에서 정적 예시 알림 0~2개(`src/lib/demoData.ts`에 추가) 표시.
- 읽음 처리·insert write는 데모 어댑터의 기존 no-op(신뢰할 만한 성공 형태) 정책 그대로.

## 테스트 (성공 기준)

- 각 RPC(`cancel_registration`/`admin_answer_inquiry`/`admin_award_badge`) 호출 시 대상 user 앞 `notifications` row가 정확히 1개 생성되는지 (통합/SQL 검증).
- 안 읽음 카운트 = `read_at is null` 개수 일치.
- `markNotificationsRead`/`markAllRead` 후 read_at 채워지고 카운트 감소.
- RLS: 타인의 알림을 select/update 못 함.
- 승급/답변/수여가 실제로 일어나지 않은 경로(예: 승급자 없음)에선 알림이 생성되지 않음.

## 파일 영향 요약

**신규**
- `supabase/migrations/0025_notifications.sql` — 테이블 + RLS + 3개 RPC 수정
- `src/actions/notification.ts` — read 처리 액션
- `src/app/(member)/NotificationBell.tsx` (또는 유사) — 벨 + 드롭다운

**수정**
- `src/app/(member)/MemberShell.tsx` — 헤더에 벨 삽입
- `src/lib/types.ts` — `Notification` 타입
- `src/lib/demoData.ts` — 데모 알림 예시

**후속(스코프 밖 노트)**
- Community Store 시임에 NotificationReads/Ops 편입
- CONTEXT.md 운영 개념에 Notification 용어 정의 추가
