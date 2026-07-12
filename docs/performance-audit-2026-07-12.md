# 성능 진단 — 로그인/페이지 이동 느림 (2026-07-12)

개선 작업 착수 전 현재 상태 브리핑. 코드 변경 없음, 조사만 진행.

## 환경

- Next.js 16.2.10 (App Router, Cache Components 모델 지원 버전)
- `next.config.ts`: 커스텀 설정 없음 — `cacheComponents` 미활성화
- Supabase (`@supabase/ssr`)로 인증/DB 접근, 프로젝트는 클라우드 인스턴스(`*.supabase.co`) — 로컬 도커 아님

## 실측 결과

`.env.local`의 실제 Supabase 프로젝트에 대해 직접 측정. 방법과 원본 수치는 각 항목에 기재.

| 호출 | 평균 | 최소 | 최대 | 측정 방법 (n=8) |
|---|---|---|---|---|
| `auth.getUser()` 원격 검증 (세션 있을 때) | **111.4ms** | 79.8ms | 174.9ms | `/auth/v1/user` 엔드포인트에 직접 요청, `time_total` 측정 |
| `profiles` select 1건 | **77.7ms** | 51.0ms | 133.9ms | anon 키로 `supabase.from("profiles").select("id").limit(1)` 8회 반복 |
| `auth.getUser()` (세션 없음, 익명) | 0.1ms | 0.0ms | 0.4ms | 브라우저 SDK가 로컬에서 즉시 반환 — **네트워크 호출 자체가 없음** |

> 익명 상태(로그인 안 한 방문자)에서는 `getUser()`가 로컬에서 즉시 끝나므로, 아래 원인 1·2가 만드는 지연은 **로그인된 사용자에게만 실제로 발생**한다. 로그인 세션이 있을 때 서버가 호출하는 것과 동일한 `/auth/v1/user` 엔드포인트를 직접 때려서 그 경우의 원격 검증 비용(111.4ms)을 별도로 측정했다.

계산:

- `getProfile()` 1회 실행 비용 (코드상 `getUser()` → `profiles` select 순차 실행): **111.4 + 77.7 ≈ 189.1ms**
- 현재 코드: 레이아웃 + 페이지가 각각 호출 → **189.1 × 2 ≈ 378.2ms**, 이 중 **189.1ms는 순수 중복 낭비**
- OAuth 콜백의 불필요한 `getUser()` 추가 호출: **+111.4ms**가 로그인 리다이렉트 경로에 그대로 추가

TTFB를 dev 서버(`next dev`, Turbopack)에서 정적/동적 페이지 간 비교 시도했으나, 온디맨드 컴파일 노이즈가 커서(`/about` 92~181ms 변동) 신뢰할 수 있는 수치가 아니었다 — 이 항목은 프로덕션 빌드(`next build && next start`)로 재측정 필요. 대신 아래 원인 3은 코드상 객관적 사실(라우트 세그먼트 설정)로 근거를 남긴다.

## 핵심 원인 (영향도 순)

### 1. `middleware.ts` 부재 — 세션 갱신을 매 요청마다 수행

`src/lib/supabase/server.ts`의 주석은 "미들웨어가 세션 갱신을 담당하므로 무시"라고 되어 있지만, 실제로 `middleware.ts` 파일이 프로젝트에 **존재하지 않는다**. Supabase `getAll/setAll` 쿠키 훅에서 `setAll` 실패를 조용히 무시하도록 되어 있어 증상이 드러나지 않고 있었을 뿐이다.

미들웨어가 없으면 세션 갱신·쿠키 refresh를 매 요청의 서버 컴포넌트 렌더링 경로에서 떠안게 되어, 매 페이지 요청마다 `auth.getUser()`가 Supabase Auth 서버에 매번 검증 왕복(네트워크 호출)을 한다. (`getUser()`는 로컬 JWT 디코드가 아니라 항상 원격 검증을 수행하는 API — 의도된 보안 동작이지만 미들웨어 없이는 매 페이지에서 반복된다.)

### 2. 인증 확인 함수가 요청당 중복 호출됨 (N+1)

`(member)/layout.tsx`와 그 하위 거의 모든 `page.tsx`(예: [attend/page.tsx](src/app/(member)/attend/page.tsx), [profile/page.tsx](src/app/(member)/profile/page.tsx))가 각각 `getProfile()` / `requireProfile()`을 **따로** 호출한다. `admin/layout.tsx`와 그 하위 페이지들도 동일한 패턴.

[`src/lib/auth.ts`](src/lib/auth.ts)의 `getProfile()`은 React `cache()`로 감싸져 있지 않아, 한 번의 네비게이션(레이아웃 렌더 + 페이지 렌더)마다:

- `auth.getUser()` 왕복 × 2
- `profiles` 테이블 select 왕복 × 2

총 4번의 순차적 네트워크 호출이 매 페이지 이동마다 발생한다. 이 두 호출은 병렬화도 안 되어 있고(`await` 순차), 요청 단위로 캐싱(dedupe)도 안 되어 있다.

### 3. 전체 라우트가 `force-dynamic` — 정적 렌더링/캐시 전무

41개 page/layout 중 **35개**가 `export const dynamic = "force-dynamic"`을 선언. Next.js 16의 Cache Components(`use cache`, `<Suspense>` 기반 부분 사전 렌더링)를 전혀 사용하지 않아, about/team/events처럼 로그인과 무관한 정적 콘텐츠까지 매번 서버에서 처음부터 다시 렌더링한다. `next.config.ts`에도 `cacheComponents: true` 설정이 없다.

### 4. OAuth 콜백에 불필요한 왕복 추가

[`auth/callback/route.ts`](src/app/auth/callback/route.ts)에서 `exchangeCodeForSession(code)` 직후 곧바로 `auth.getUser()`를 다시 호출한다. `exchangeCodeForSession`이 이미 세션/유저 정보를 반환하므로 이 추가 호출은 로그인 리다이렉트 경로에 왕복 1회를 더 얹는다.

## 영향 요약

| 문제 | 영향받는 흐름 | 실측 기반 비용 |
|---|---|---|
| 미들웨어 부재 → `getUser()` 매 요청 원격 검증 | 로그인된 사용자의 모든 페이지 | 1회당 111.4ms (n=8 실측) |
| `getProfile()` 중복 호출 (레이아웃+페이지) | `/`, `(member)/*`, `admin/*` 전체 | 네비게이션당 378.2ms 중 189.1ms가 순수 중복 |
| `force-dynamic` 전면 적용 (35/41 라우트) | 정적 콘텐츠 페이지 포함 | 캐시/사전렌더링 이점 0 (코드 사실, TTFB는 프로덕션 빌드로 재측정 필요) |
| 콜백 중복 `getUser()` | 로그인 직후 1회 | +111.4ms |

## 프론트엔드 이슈

### 5. Pretendard 가변 폰트 2.06MB를 서브셋 없이 전체 로드

[`globals.css:2`](src/app/globals.css:2)에서 `@import "pretendard/dist/web/variable/pretendardvariable.css"`로 로드하는데, 이 CSS가 가리키는 실제 폰트 파일은:

```
node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2 — 2,057,688 bytes (2.06MB)
```

weight 45~920 전체 축을 담은 서브셋 없는 단일 파일이다. `font-display: swap`이라 텍스트 렌더링 자체는 막지 않지만:

- CSS `@import`는 렌더링 체인에 순차 왕복을 추가한다 (`globals.css` → `pretendardvariable.css` → `@font-face` src) — `next/font`(자동 `<link rel=preload>` 삽입)를 안 쓰므로 이 2MB 파일은 프리로드되지 않는다.
- 같은 npm 패키지 안에 유니코드 범위별로 쪼갠 대안이 이미 설치돼 있는데 미사용 상태다: `pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css` (`@font-face` 92개, 서브셋당 30~40KB, 필요한 글자 범위만 요청). 이걸로 바꾸면 최초 로드 시 실제로 받는 폰트 용량이 2MB → 초기 화면에 쓰이는 글자 기준 수십 KB로 줄어든다.
- 이 CSS는 `globals.css`를 통해 루트 레이아웃에서 전역 로드되므로 **모든 페이지**가 이 2MB 요청을 물고 간다.

### 6. 첫 진입 페이지(로그인/랜딩)가 통째로 클라이언트 컴포넌트

[`src/app/login/page.tsx`](src/app/login/page.tsx) 전체(456줄)가 `"use client"`. 실제로 클라이언트가 필요한 지점은 Google 로그인 버튼의 `onClick` 핸들러(`handleGoogleLogin`, 84·422번 줄) 하나뿐이고, 나머지(히어로 카피, 컨페티 장식, 기능 카드, 통계, `next/font/google`로 불러오는 Space Grotesk·Archivo 등)는 전부 정적 콘텐츠다.

게다가 [`src/app/page.tsx`](src/app/page.tsx)는 비로그인 사용자에게 `/login`으로 리다이렉트하는 대신 이 `LoginPage`를 **루트 경로에서 직접 import해 렌더링**한다 — 즉 이 무거운 클라이언트 컴포넌트가 서비스의 첫 진입점(`/`) 자체다. 서버에서 정적 HTML로 그려낼 수 있는 콘텐츠가 전부 클라이언트 JS 번들과 하이드레이션 비용으로 나간다. 버튼 하나만 별도 클라이언트 아일랜드로 분리하면 나머지는 서버 컴포넌트로 되돌릴 수 있는 구조다.

(dev 모드 Turbopack 청크는 온디맨드 분할이라 실제 프로덕션 번들 KB와 다르게 잡혀 여기선 정확한 전송량 수치를 남기지 않음 — `next build` 프로덕션 산출물로 별도 측정 필요)

### 7. `loading.tsx` 전무 — 라우트 전환 시 로딩 스켈레톤 없음

41개 라우트 전체에 `loading.tsx`가 **0개**. 원인 3(35개 라우트가 `force-dynamic`)과 결합하면, 서버가 인증 확인(원인 1·2, 페이지당 최대 378ms) + 데이터 조회를 마칠 때까지 사용자는 흰 화면만 본다. 백엔드 지연을 못 없애더라도 `loading.tsx`만 추가하면 체감 속도는 즉시 개선된다 — 프론트 단독으로 가능한 수정.

## 다음 단계 (미착수, 승인 대기)

1. `middleware.ts` 추가해 세션 갱신을 미들웨어로 이관
2. `getProfile()`을 React `cache()`로 감싸 요청당 1회로 dedupe, 레이아웃에서 가져온 profile을 페이지로 prop 전달(중복 호출 제거)
3. 콜백에서 중복 `getUser()` 제거 — `exchangeCodeForSession` 반환값 재사용
4. 정적/비개인화 콘텐츠(about, team, events 목록 등)에 `force-dynamic` 제거 검토 후 캐시 적용
5. Pretendard를 `pretendardvariable-dynamic-subset.css` 서브셋 방식으로 교체 (또는 `next/font/local`로 자체 호스팅 + preload)
6. 로그인/랜딩 페이지에서 버튼만 클라이언트 아일랜드로 분리, 나머지는 서버 컴포넌트로 전환
7. 라우트별 `loading.tsx` 추가 (최소 루트 레이아웃 그룹 단위부터)
