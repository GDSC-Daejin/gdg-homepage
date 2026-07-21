# 보안 하드닝 구현계획서 (Codex 핸드오프)

> 작성: 2026-07-19 · 대상 실행자: Codex (독립 세션)
> 이 문서는 사전 대화 맥락 없이 실행 가능하도록 자기완결적으로 작성됨.

## 배경 (읽고 시작할 것)

이 앱(GDG DJU 동아리 관리)의 **1차 보안 방어선은 Supabase RLS + SECURITY DEFINER RPC**다.
앱단 `requireAdmin`/`requireProfile`([src/lib/auth.ts](../src/lib/auth.ts))은 보조선이다.
정적 분석 결과 치명적 구멍은 없었고, 아래는 **방어 강화(hardening)와 남용 방지** 작업이다.

### 실행자 필수 규칙

1. **이 Next.js는 변형 버전(16.2.10)이다.** API를 추정하지 말고 `node_modules/next/dist/docs/` 의 해당 가이드를 먼저 읽어라. (참고: [AGENTS.md](../AGENTS.md))
2. **RLS 정책을 절대 약화시키지 마라.** 특히 `profiles` 테이블 read 정책을 넓히지 말 것 (Task 5 참조).
3. **DB 변경은 새 마이그레이션 파일로만.** 기존 `supabase/migrations/*.sql` 수정 금지. 다음 번호는 **`0025`** 부터. 파일명 규칙: `00NN_snake_case.sql`.
4. 각 Task는 **독립 PR** 로 낼 것. Task 간 의존성 없음.
5. 테스트: `npm test` (vitest). 기존 테스트는 [tests/](../tests/)·[src/](../src/) 산재. 새 로직엔 최소 1개 검증 테스트 추가.
6. 응답/커밋/에러 메시지는 기존 코드처럼 **한국어 사용자 문구** 유지 (`toKoreanError`, `ActionResult` 패턴).
7. 스코프 밖 코드 리팩터·포맷 변경 금지. 변경 라인은 각 Task 목표에 직결되게.

### 우선순위

| 순위 | Task | 위험도 | 유형 |
|---|---|---|---|
| P0 | 1. HTTP 보안 헤더 | 하 | 앱 설정 |
| P0 | 2. 공개 지원폼 남용 방지 | 중 | 앱 + DB |
| P1 | 3. 출석 코드 강화 + 시도 제한 | 하~중 | DB |
| P1 | 4. 게시판 뮤테이션 소유권 이중화 | 하(구조적) | 앱 |
| P2 | 5. 작성자명 노출용 안전 뷰 | 하(선제) | DB + 앱 |
| P3 | 6. Cron 시크릿 상수시간 비교 | 최하 | 앱 |

P2/P3은 여력 있을 때. P0 두 개가 최우선.

---

## Task 1 — HTTP 보안 헤더 추가 (P0)

**문제:** [next.config.ts](../next.config.ts)에 `headers()`가 없어 CSP·HSTS·X-Frame-Options 등 전무. 클릭재킹·XSS 심층방어 부재.

**주의:** 이 앱은 인라인 테마 스크립트(`dangerouslySetInnerHTML`, [src/app/layout.tsx:21](../src/app/layout.tsx))와 Vercel Analytics/Speed Insights, Supabase 호출을 쓴다. **엄격한 enforcing CSP는 인라인 스크립트를 깨뜨린다.** 따라서:

- 즉시 안전한 헤더는 **enforce** 로 넣는다.
- CSP는 **`Content-Security-Policy-Report-Only`** 로 먼저 넣어 위반만 수집한다. (nonce 배선은 후속 작업)

**구현:** `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` 를 먼저 읽고, `next.config.ts`의 `nextConfig`에 `async headers()` 추가:

- `source: '/(.*)'` 전 경로 대상
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy-Report-Only`: `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `connect-src 'self' https://*.supabase.co https://api.resend.com`; `frame-ancestors 'none'`; `base-uri 'self'` (실제 사용 도메인은 배포 환경 확인 후 조정 — Supabase URL은 `NEXT_PUBLIC_SUPABASE_URL` 기준)

기존 `experimental.turbopackFileSystemCacheForDev` 설정은 **그대로 둘 것.**

**수용 기준:**
- `npm run build` 성공.
- 로컬 실행 후 응답 헤더에 위 항목 존재(예: `curl -I localhost:3000`).
- Report-Only라 기존 UI(테마 토글, 애널리틱스)가 **깨지지 않아야** 함. 콘솔의 CSP 위반 리포트를 PR 설명에 요약.

---

## Task 2 — 공개 지원폼 남용 방지 (P0)

**문제:** [src/actions/application.ts](../src/actions/application.ts)의 `submitApplication`은 rate limit·CAPTCHA가 없다. `(email, season)` unique 제약([0010](../supabase/migrations/0010_public_application.sql))만 있어 이메일만 바꾸면 무제한 삽입 가능. 게다가 anon 키로 PostgREST를 **직접 호출**하면 앱 레이어를 우회한다(현재 [0019](../supabase/migrations/0019_application_insert_deadline_check.sql)의 anon insert 정책만 통과하면 됨).

**전략 (2단 방어):**

### 2-A. DB 백스톱 (PostgREST 직접 호출까지 차단) — 마이그레이션 `0025_application_abuse_guard.sql`

`applications` 테이블에 `BEFORE INSERT` 트리거(SECURITY DEFINER 함수)를 추가해 anon/직접 호출 모두에 강제:

- **동일인 캡:** 같은 `(student_no, season)` 또는 `(phone, season)` 조합이 이미 존재하면 `raise exception 'DUPLICATE_APPLICANT'`. (이메일만 바꾸는 우회 차단)
- **전역 속도 캡(backstop):** 최근 1분 내 삽입된 `applications` 행이 N건(예: 20) 이상이면 `raise exception 'RATE_LIMITED'`. (대량 스크립트 삽입 완화 — 크루드하지만 IP 없이 가능한 유일한 DB 방어)

> 참고: DB는 클라이언트 IP를 보지 못하므로 IP 기반은 앱 레이어(2-B)에서만 가능. 트리거는 `created_at` 인덱스 전제 — 없으면 함께 생성.

에러 코드는 `toKoreanError`([src/lib/errors.ts](../src/lib/errors.ts))에 한국어 매핑 추가:
- `DUPLICATE_APPLICANT` → "이미 같은 학번/연락처로 지원한 내역이 있어요"
- `RATE_LIMITED` → "잠시 후 다시 시도해주세요"

### 2-B. 앱 레이어 IP rate limit (실제 폼 남용 = 99% 케이스 차단)

`submitApplication` 시작부에 IP 기반 스로틀 추가. **새 외부 의존성 없이** Supabase 테이블로 구현:

- 마이그레이션 `0025`에 `submission_throttle` 테이블 추가: `(ip text, window_start timestamptz, count int)` + SECURITY DEFINER RPC `check_submission_rate(p_ip text)` — 예: IP당 10분에 5회 초과 시 false 반환. 이 RPC는 `authenticated`/`anon` 모두 execute 허용.
- 서버 액션에서 IP 추출: `const h = await headers()` → `h.get("x-forwarded-for")?.split(",")[0]?.trim()`. (Vercel은 `x-forwarded-for` 제공. [src/actions/notice.ts:109](../src/actions/notice.ts)에 `headers()` 사용 선례 있음.)
- 초과 시 `{ error: "잠시 후 다시 시도해주세요" }` 반환하고 insert 스킵.

> **결정 필요 없음(기본안 채택):** Upstash/Vercel KV 같은 신규 의존성은 도입하지 않는다(YAGNI). 이후 트래픽이 실제로 문제되면 그때 교체.

### 2-C. (선택, Phase 2) Cloudflare Turnstile

PostgREST 직접 호출은 IP 스로틀로도 완벽 차단 불가. 근본 방어가 필요하면 Turnstile 토큰을 서버 액션에서 검증. **이번 스코프에서는 하지 말 것.** 문서에만 후속으로 남긴다.

**수용 기준:**
- 같은 학번으로 두 번 지원 시 두 번째가 한국어 에러로 거부.
- 짧은 시간 반복 제출 시 IP 스로틀 발동(테스트로 검증).
- 정상 1회 지원은 그대로 성공.
- `npm test` 통과 + 트리거/스로틀 로직 테스트 1개 추가.

---

## Task 3 — 출석 코드 강화 + 시도 제한 (P1)

**문제:**
[0004:181](../supabase/migrations/0004_phase2.sql)의 `admin_set_event_code`가 `upper(substr(md5(random()::text), 1, 6))` → md5는 16진수라 실제 알파벳 **16종(≈16.7M)**, 스키마([src/lib/schemas.ts:53](../src/lib/schemas.ts) `attendCodeSchema`)는 "영숫자 6자"라 표기와 불일치. 또 `check_attendance`([0001](../supabase/migrations/0001_init.sql))에 **시도 제한이 없어** 확정 등록자가 불참 상태로 코드를 무제한 추측 가능(부정 출석).

**구현 — 마이그레이션 `0026_attendance_code_hardening.sql`:**

1. `create extension if not exists pgcrypto;` (Supabase 기본 사용 가능)
2. `admin_set_event_code` 재정의: 암호학적 난수 기반 **base32 8자** 생성. 예)
   `upper(substr(encode(gen_random_bytes(10), 'base32'), 1, 8))` 후 혼동 문자(`0/O`, `1/I`) 치환 또는 그대로. 최종 코드 길이·알파벳을 아래 스키마와 **정확히 일치**시킬 것.
3. 시도 제한: `check_attendance`에 실패 카운터 추가. `attendance_attempts` 테이블 `(event_id, user_id, attempts int, last_attempt timestamptz)` 를 두고, 실패 시 증가, N회(예: 5) 초과+쿨다운 미경과면 `raise exception 'TOO_MANY_ATTEMPTS'`. 성공 시 카운터 리셋. 함수는 SECURITY DEFINER 유지.

**앱 변경:**
- [src/lib/schemas.ts](../src/lib/schemas.ts) `attendCodeSchema` 정규식을 새 코드 형식에 맞게 수정(예: `/^[A-Z2-9]{8}$/`). 클라이언트 입력 UI가 6자 가정하는 곳 있으면 함께 조정(grep `attendCodeSchema` 사용처).
- `toKoreanError`에 `TOO_MANY_ATTEMPTS` → "시도 횟수를 초과했어요. 잠시 후 다시 해주세요" 매핑.

> **호환성 주의:** 기존에 발급된 6자 코드가 DB에 있으면 새 스키마 정규식이 그 코드 입력을 막는다. 마이그레이션에서 기존 `event_codes`를 새 형식으로 재발급하거나, 운영상 새 이벤트부터 적용됨을 PR에 명시.

**수용 기준:**
- 새 코드가 base32 8자로 발급되고 정상 출석 체크 동작.
- 잘못된 코드 5회 후 `TOO_MANY_ATTEMPTS` 발동(테스트).
- `attendCodeSchema` 단위 테스트가 새 형식 검증.

---

## Task 4 — 게시판 뮤테이션 소유권 이중화 (P1, 구조적)

**문제:** [src/actions/post.ts](../src/actions/post.ts)의 `updatePost`/`deletePost`/`deleteComment`는 앱단 소유권 체크 없이 RLS에만 의존. **현재는 안전**(posts RLS가 `author_id = auth.uid()` 강제, [0021](../supabase/migrations/0021_member_board.sql))하나 방어선이 한 겹이라, 훗날 정책 회귀 시 조용히 IDOR화.

**구현 (DB 변경 없음, 앱 레이어 이중화):**

각 함수에서 뮤테이션 전에 소유권을 앱단에서도 확인:
- `updatePost(id, ...)`: `posts`에서 `author_id` 조회 → `profile.id`와 불일치 시 `{ error: "권한이 없어요" }`. (update는 소유자만)
- `deletePost(id, ...)` / `deleteComment(id, ...)`: 소유자 **또는 관리자** 허용. `requireProfile()` 결과 role이 `ADMIN_ROLES`([src/lib/types.ts](../src/lib/types.ts)) 포함이면 통과, 아니면 소유권 확인.

`createPost`/`createComment`는 이미 `author_id: profile.id`로 삽입하므로 변경 불필요. `acceptAnswer`는 RPC가 내부에서 `author_id = auth.uid()` 확인하므로 그대로 둘 것.

> RLS는 그대로 유지(제거하지 말 것). 이건 **추가 방어선**이지 대체가 아니다.

**수용 기준:**
- 타인 글 수정/삭제 액션 호출 시 앱 레이어에서 한국어 에러 반환(RLS 도달 전 차단).
- 관리자는 타인 글 삭제 가능(기존 RLS `own or admin delete`와 일치).
- 정상 소유자 동작 유지. 테스트 1개 추가.

---

## Task 5 — 작성자명 노출용 안전 뷰 (P2, 선제)

**문제/맥락:** [src/components/board/PostListPage.tsx:35](../src/components/board/PostListPage.tsx)가 `profiles(name)`을 조인하지만, `profiles: self read` RLS([0001](../supabase/migrations/0001_init.sql))상 **타인 프로필은 못 읽어** 작성자명이 "탈퇴한 회원"으로 표시될 수 있음. 이를 고치려 `profiles` read 정책을 넓히면 **phone·student_no·email이 전 멤버에게 노출**된다 — 절대 금지.

**구현 — 마이그레이션 `0027_public_author_view.sql`:**

- `profiles`에서 **`id`, `name`, `nickname`만** 노출하는 안전 뷰 또는 SECURITY DEFINER 함수 생성. 예: `create view public.member_public as select id, name, nickname from profiles;` + 멤버에게 select 허용하되 **민감 컬럼(phone/student_no/email/major/interests) 절대 미포함**.
  - 뷰 사용 시 `security_invoker=off`(정의자 권한) 또는 별도 RLS 고려 — Supabase/PG 버전에 맞게 `security_barrier`/`security_invoker` 옵션 검토. 목표: 멤버가 다른 작성자의 이름/닉네임만 읽을 수 있게.
- 게시판 조회 코드([PostListPage.tsx](../src/components/board/PostListPage.tsx) 및 [src/app/(member)/board/[id]/page.tsx](../src/app/(member)/board/[id]/page.tsx), qna 대응 페이지)의 `profiles(name)` 조인을 새 뷰 기준으로 교체.

**수용 기준:**
- 게시판에서 **타인 작성자명이 정상 표시**됨.
- 멤버 세션으로 뷰/조인을 통해 phone/student_no/email 등은 **조회 불가**(검증).
- `profiles` 원본 테이블 RLS는 변경 없음.

---

## Task 6 — Cron 시크릿 상수시간 비교 (P3, 최하)

**문제:** [src/app/api/cron/attendance-warning/route.ts:16](../src/app/api/cron/attendance-warning/route.ts)·[event-reminder/route.ts:16](../src/app/api/cron/event-reminder/route.ts)의 `!== \`Bearer ${CRON_SECRET}\`` 는 비상수시간 비교. 네트워크 경유라 실익 미미하나 정석은 상수시간.

**구현:** `crypto.timingSafeEqual`로 교체(길이 불일치 방어 포함). 두 라우트 동일 패턴이므로 공용 헬퍼로 뽑아도 됨(단, 스코프 최소화).

**수용 기준:** 올바른 시크릿은 통과, 틀리면 401 유지. 기존 cron 동작 불변.

---

## 범위 밖(이번에 하지 말 것)

- Turnstile/CAPTCHA 실제 연동(Task 2-C, Phase 2)
- Enforcing CSP + nonce 배선(Task 1의 Report-Only가 위반 수집한 뒤 별도 작업)
- Supabase 대시보드 설정(OAuth redirect 허용목록, 이메일 확인 정책) — 코드 밖 운영 점검 사항, 이 문서 대상 아님
