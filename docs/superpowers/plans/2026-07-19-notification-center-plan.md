# 구현계획서 (마스터) — 인앱 알림 센터

> **실행자: Codex.** 이 문서가 진입점이다. 설계는 `docs/superpowers/specs/2026-07-19-notification-center-design.md`(승인됨, 권위 있음).
> 상세 계획은 두 트랙 파일로 분리:
> - 백엔드/DB: [`2026-07-19-notification-center-plan-backend.md`](2026-07-19-notification-center-plan-backend.md)
> - 프론트/UI: [`2026-07-19-notification-center-plan-frontend.md`](2026-07-19-notification-center-plan-frontend.md)

## 한 줄 요약

정원 승급·문의 답변·배지 수여 3개 사건을 기존 SECURITY DEFINER RPC 안에서 `notifications` row로 원자적 생성하고, 회원 셸에 벨+드롭다운으로 노출한다. 신규 테이블 1개, 신규 파일 2개, 수정 파일 4개. Slack(스태프용)은 그대로 병존.

## 트랙 간 의존성 (중요)

**백엔드 트랙이 프론트 트랙보다 먼저 완료돼야 한다** — 프론트 코드는 `src/lib/types.ts`의 `Notification` 타입과 `notifications` 테이블에 의존해 컴파일된다.

- 최소 선행: 백엔드 스텝 1~7(테이블 DDL + RLS + 3개 RPC + `Notification` 타입)까지 머지.
- 병렬로 진행하려면, 백엔드 트랙 C(타입)만 먼저 `types.ts`에 넣으면 프론트 트랙이 컴파일된다.

## 통합 실행 순서

1. **백엔드**: `supabase/migrations/0025_notifications.sql` — 테이블 + 인덱스 2개 + RLS(SELECT/UPDATE own) + 3개 RPC `create or replace`(각 RPC에 `insert into notifications` 1회). → 백엔드 계획서 A·B.
2. **백엔드**: `src/lib/types.ts` — `NotificationType` union + `Notification` interface. → 백엔드 계획서 C. **(이 시점부터 프론트 트랙 병렬 가능)**
3. **프론트**: `src/lib/format.ts`에 `formatRelativeKst` 추가 → `src/lib/demoData.ts`에 `DEMO_NOTIFICATIONS` → `src/actions/notification.ts`(`markNotificationsRead`/`markAllRead`) → `src/app/(member)/NotificationBell.tsx` → `MemberShell.tsx` async화 + 조회 + placeholder(48-66행) 교체. → 프론트 계획서 A~E.
4. **검증**: 백엔드 정적 테스트(`tests/notifications-migration.test.ts`) + `npm test` + `tsc` + dev 서버 육안 검증(벨·드롭다운·읽음·빈 상태·다크·모바일). → 각 계획서 D/F.
5. **회귀**: `git diff --stat`에 `src/actions/registration|inquiry|points.ts` **없음** 확인(백엔드는 SQL만 수정, 액션 무변경). 기존 member 라우트 정상 렌더.

## 핵심 설계 결정 (두 트랙 공통 전제)

- **알림 생성 = 기존 RPC 안에서.** 행동 주체(스태프)와 수신자(회원)가 달라 순진한 RLS insert 불가 + 원자성 필요 → 3개 definer RPC에 insert 삽입. RLS INSERT 정책 없음(definer가 RLS 우회, `force row level security` 미사용 확인됨).
- **가드**: 승급 없음/중복 배지 등 "실제 사건 미발생" 경로는 기존 제어 흐름·제약(트랜잭션 롤백)으로 알림도 자연히 0건 — 추가 코드 불필요.
- **TypeScript 액션 무변경**: 세 RPC 시그니처·반환 타입 불변.
- **벨 실제 위치 = 사이드바 푸터**(`MemberShell.tsx:48-66`의 disabled placeholder). 드롭다운은 **위로**(`bottom-full`) 연다. 레이아웃 이동 없음.

## 통합 파일 영향

**신규 (3)**
- `supabase/migrations/0025_notifications.sql` — 테이블·RLS·3개 RPC 수정
- `src/actions/notification.ts` — read 처리 액션
- `src/app/(member)/NotificationBell.tsx` — 벨 + 드롭다운(client)
- (테스트) `tests/notifications-migration.test.ts`

**수정 (4)**
- `src/lib/types.ts` — `Notification` 타입
- `src/lib/format.ts` — `formatRelativeKst`
- `src/lib/demoData.ts` — `DEMO_NOTIFICATIONS`
- `src/app/(member)/MemberShell.tsx` — async화 + 조회 + 벨 삽입

## 통합 리스크 / 블로커

| # | 리스크 | 해결 |
|---|---|---|
| 1 | `admin_answer_inquiry`가 수신자 user_id를 스코프에 안 가짐 (`0004:191-199`) | `declare v_user/v_title` + `update ... returning user_id, title into` — 원자적 1쿼리. 백엔드 B-2 |
| 2 | 프론트가 `Notification` 타입에 선행 의존 | 백엔드 스텝 2(타입)를 먼저 머지 |
| 3 | 벨이 사이드바 푸터라 아래로 열면 뷰포트 이탈 | `bottom-full mb-2`로 위로 오픈 |
| 4 | `format.ts`에 상대시간 헬퍼 없음 | `formatRelativeKst` 최소 추가(재발명 아님) |
| 5 | 라이브 DB 통합 테스트 하네스 없음 | RPC 동작은 수동 SQL로 검증(백엔드 D-2). CI 자동화는 스코프 밖 후속 |
| 6 | 데모 write no-op → 읽음이 새로고침 시 원복 | 스펙상 정상 동작 |

## 스코프 밖 (후속 노트)

- 전용 `/notifications` 페이지, 새 공지 fan-out, 실시간 푸시(웹소켓)
- Community Store 시임에 Notification reads/ops 편입
- `CONTEXT.md` 운영 개념에 Notification 용어 정의 추가
- `EventType` 문서 드리프트 정정(`devfest`→`party`) — 별건
