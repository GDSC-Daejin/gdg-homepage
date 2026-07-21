# 보안 하드닝 — 남은 작업 (Task 3~6) · Codex 핸드오프

> 작성: 2026-07-21 · 대상 실행자: Codex (독립 세션)
> 이 문서는 사전 대화 맥락 없이 실행 가능하도록 자기완결적으로 작성됨.
> 원본 `docs/security-hardening-plan.md`의 P0(Task 1·2)는 **이미 구현·머지됨**(보안 헤더 + 공개 지원폼 남용 방지, 마이그레이션 `0035_application_abuse_guard.sql`). 이 문서는 **남은 Task 3~6만** 현재 코드 기준으로 다시 정리한 것이다.

## 배경 (읽고 시작할 것)

이 앱(GDG DJU 동아리 관리)의 **1차 보안 방어선은 Supabase RLS + SECURITY DEFINER RPC**다. 앱단 `requireAdmin`/`requireProfile`([src/lib/auth.ts](../src/lib/auth.ts))은 보조선이다. 아래는 **방어 강화(hardening)와 남용 방지** 작업이다.

### 실행자 필수 규칙

1. **이 Next.js는 변형 버전(16.x)이다.** API를 추정하지 말고 `node_modules/next/dist/docs/`의 해당 가이드를 먼저 읽어라. (참고: [AGENTS.md](../AGENTS.md))
2. **패키지 매니저는 pnpm** (npm/yarn 금지).
3. **RLS 정책을 절대 약화시키지 마라.** 특히 `profiles` 테이블 read 정책을 넓히지 말 것 (Task 5 참조).
4. **DB 변경은 새 마이그레이션 파일로만.** 기존 `supabase/migrations/*.sql` 수정 금지. **다음 번호는 `0036`부터**(현재 `0035`까지 존재 — 임의로 다른 번호 집지 말 것). 파일명 규칙: `00NN_snake_case.sql`.
5. 각 Task는 **독립 PR/커밋**으로. Task 간 의존성 없음.
6. **커밋 규칙:** 이 워킹트리엔 다른 세션의 미커밋 변경이 섞여 있을 수 있다. `git add <명시 경로>`로 **내가 만든 파일만** — `git add -A`/`git commit -a` 금지. 커밋 메시지에 `Co-Authored-By` 트레일러 금지(훅이 거부).
7. 테스트: `pnpm test` (vitest). 새 로직엔 최소 1개 검증 테스트 추가. 완료 후 `pnpm test`와 `pnpm build` 통과 확인.
8. 응답/에러 메시지는 기존 코드처럼 **한국어 사용자 문구** 유지 (`toKoreanError`, `ActionResult` 패턴).
9. 스코프 밖 리팩터·포맷 변경 금지.

### 우선순위 / 마이그레이션 배정

| 순위 | Task | 위험도 | 유형 | 마이그레이션 |
|---|---|---|---|---|
| P1 | 3. 출석 코드 시도 제한 | 하~중 | DB + 앱 | `0036_attendance_attempt_limit.sql` |
| P1 | 4. 게시판 뮤테이션 소유권 이중화 | 하(구조적) | 앱 | 없음 |
| P2 | 5. 작성자명 노출용 안전 뷰 | 하(선제) | DB + 앱 | `0037_public_author_view.sql` |
| P3 | 6. Cron 시크릿 상수시간 비교 | 최하 | 앱 | 없음 |

> **범위 밖(이번에 하지 말 것):** CSP nonce 강제 전환(현재 `Content-Security-Policy-Report-Only` 유지) · Turnstile/CAPTCHA · Supabase 대시보드 설정.

---

## Task 3 — 출석 코드 시도 제한 (P1)

**핵심은 "무제한 추측 차단"이다. 코드 길이 확장(6자→8자)은 하지 않는다.**

**문제:**
1. **시도 제한 없음** — `check_attendance`([0001](../supabase/migrations/0001_init.sql))에 실패 카운터가 없어, 확정 등록자가 불참 상태로 출석 코드를 **무제한 추측** 가능(부정 출석). ← **이게 실질 위험, 이번 작업의 목표.**
2. **생성기·검증 불일치** — `admin_set_event_code`([0004:177](../supabase/migrations/0004_phase2.sql))가 `upper(substr(md5(random()::text), 1, 6))` → md5는 16진수라 실제 문자 16종뿐인데, 스키마([src/lib/schemas.ts](../src/lib/schemas.ts) `attendCodeSchema`)는 "영숫자 6자"로 표기. 표기·실제 불일치를 해소한다(길이는 6자 유지).

**구현 — 마이그레이션 `0036_attendance_attempt_limit.sql`:**

1. **시도 제한 테이블·로직 (주작업):**
   - `attendance_attempts` 테이블 `(event_id uuid, user_id uuid, attempts int, last_attempt timestamptz, primary key(event_id, user_id))`.
   - `check_attendance`(SECURITY DEFINER 유지) 재정의:
     - 진입 시 해당 `(event_id, user_id)` 시도 기록 확인. **실패 N회(예: 5) 초과 + 쿨다운(예: 10분) 미경과**면 `raise exception 'TOO_MANY_ATTEMPTS'`.
     - 코드 불일치 시 `attempts` 증가(upsert)·`last_attempt` 갱신.
     - 출석 성공 시 해당 행 카운터 리셋(또는 삭제).
2. **생성기 정합화 (부수작업, 길이 6 유지):**
   - `admin_set_event_code` 재정의: `md5` 대신 실제 영숫자를 만드는 방식으로 6자 생성(예: `create extension if not exists pgcrypto;` 후 `gen_random_bytes` → base32 인코딩 후 앞 6자, 혼동 문자는 그대로 두거나 치환). **최종 형식(길이·허용 문자)을 아래 스키마 정규식과 정확히 일치**시킬 것.
   - **호환성:** 6자를 유지하므로 기존 발급 코드 대부분 그대로 통과. 재발급·"새 이벤트부터" 공지 불필요.

**앱 변경:**
- [src/lib/schemas.ts](../src/lib/schemas.ts) `attendCodeSchema` 정규식을 새 생성 형식과 **정확히** 일치(길이 6 유지). 현재 정규식·사용처를 `grep attendCodeSchema`로 먼저 확인하고, 클라이언트 입력 UI가 특정 형식을 가정하면 함께 맞출 것.
- `toKoreanError`([src/lib/errors.ts](../src/lib/errors.ts))에 `TOO_MANY_ATTEMPTS` → "시도 횟수를 초과했어요. 잠시 후 다시 해주세요" 매핑 추가.

**수용 기준:**
- 잘못된 코드 5회 후 `TOO_MANY_ATTEMPTS` 발동(테스트).
- 성공 시 카운터 리셋 → 이후 정상 출석 가능.
- `admin_set_event_code`가 6자 영숫자를 발급하고 정상 출석 동작.
- `attendCodeSchema` 단위 테스트가 새 형식 검증. `pnpm test`/`pnpm build` 통과.

---

## Task 4 — 게시판 뮤테이션 소유권 이중화 (P1, 구조적)

**문제:** [src/actions/post.ts](../src/actions/post.ts)의 `updatePost`/`deletePost`/`deleteComment`는 앱단 소유권 체크 없이 RLS에만 의존. **현재는 안전**(posts RLS가 `author_id = auth.uid()` 강제, [0021](../supabase/migrations/0021_member_board.sql))하나 방어선이 한 겹이라 훗날 정책 회귀 시 조용히 IDOR화.

**구현 (DB 변경 없음, 앱 레이어 이중화):**

각 함수에서 뮤테이션 전 소유권을 앱단에서도 확인:
- `updatePost(id, ...)`: `posts`에서 `author_id` 조회 → `profile.id`와 불일치 시 `{ error: "권한이 없어요" }`. (수정은 소유자만)
- `deletePost(id, ...)` / `deleteComment(id, ...)`: 소유자 **또는 관리자** 허용. `requireProfile()` role이 `ADMIN_ROLES`([src/lib/types.ts](../src/lib/types.ts)) 포함이면 통과, 아니면 소유권 확인.

`createPost`/`createComment`는 이미 `author_id: profile.id`로 삽입하므로 변경 불필요. `acceptAnswer`는 RPC 내부에서 `author_id = auth.uid()` 확인하므로 그대로 둘 것.

> RLS는 그대로 유지(제거 금지). 이건 **추가 방어선**이지 대체가 아니다.

**수용 기준:**
- 타인 글 수정/삭제 호출 시 앱 레이어에서 한국어 에러 반환(RLS 도달 전 차단).
- 관리자는 타인 글 삭제 가능(기존 RLS `own or admin delete`와 일치).
- 정상 소유자 동작 유지. 테스트 1개 추가.

---

## Task 5 — 작성자명 노출용 안전 뷰 (P2, 선제)

**문제/맥락:** [src/components/board/PostListPage.tsx:35](../src/components/board/PostListPage.tsx)·[PostDetailPage.tsx:53](../src/components/board/PostDetailPage.tsx)가 `profiles(name)`을 조인하지만, `profiles: self read` RLS([0001](../supabase/migrations/0001_init.sql))상 **타인 프로필은 못 읽어** 작성자명이 누락될 수 있음. 이를 고치려 `profiles` read 정책을 넓히면 **phone·student_no·email이 전 멤버에게 노출**된다 — 절대 금지.

**구현 — 마이그레이션 `0037_public_author_view.sql`:**

- `profiles`에서 **`id`, `name`, `nickname`만** 노출하는 안전 뷰 생성. 예: `create view public.member_public as select id, name, nickname from profiles;` — **민감 컬럼(phone/student_no/email/major/interests) 절대 미포함**. 멤버가 select 할 수 있게 권한 부여하되, PG/Supabase 버전에 맞춰 `security_invoker`/`security_barrier` 옵션을 검토(목표: 멤버가 다른 작성자의 이름/닉네임만 읽음).
- 게시판 조회 코드([PostListPage.tsx](../src/components/board/PostListPage.tsx), [PostDetailPage.tsx](../src/components/board/PostDetailPage.tsx), 그리고 board/qna 상세 페이지)의 `profiles(name)` 조인을 새 뷰(`member_public`) 기준으로 교체.

**수용 기준:**
- 게시판에서 **타인 작성자명이 정상 표시**됨.
- 멤버 세션으로 뷰/조인을 통해 phone/student_no/email 등은 **조회 불가**(검증).
- `profiles` 원본 테이블 RLS는 변경 없음. `pnpm test`/`pnpm build` 통과.

---

## Task 6 — Cron 시크릿 상수시간 비교 (P3, 최하)

**문제:** [src/app/api/cron/attendance-warning/route.ts:16](../src/app/api/cron/attendance-warning/route.ts)·[event-reminder/route.ts:16](../src/app/api/cron/event-reminder/route.ts)의 `request.headers.get("authorization") !== \`Bearer ${process.env.CRON_SECRET}\`` 는 비상수시간 비교. 네트워크 경유라 실익은 미미하나 정석은 상수시간.

**구현:** `crypto.timingSafeEqual`로 교체(길이 불일치 방어 포함 — 길이 다르면 즉시 거부). 두 라우트가 동일 패턴이니 공용 헬퍼로 뽑아도 됨(스코프 최소화). `CRON_SECRET` 미설정 시 기존처럼 거부 응답 유지.

**수용 기준:** 올바른 시크릿은 통과, 틀리면 401 유지. 기존 cron 동작 불변.
