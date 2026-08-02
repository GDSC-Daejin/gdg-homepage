# 분석 대시보드 — Phase 2 (Task 4~6) · Codex 핸드오프

> 작성: 2026-07-21 · 대상 실행자: Codex (독립 세션)
> 원본 계획서 `docs/superpowers/plans/2026-07-19-analytics-dashboard.md`의 **Phase 1(계측: 동의 배너 + GA4/Clarity 조건부 로딩 + 4개 도메인 이벤트 발화)은 이미 구현·머지됨** — `src/lib/analytics.ts`, `src/components/analytics/` 존재. 건드리지 마라.
> 이 문서는 **남은 Phase 2(GA4 Data API 조회 + admin 대시보드 페이지)만** 현재 코드 기준으로 다시 정리한 것이다. 상세 코드는 원본 계획서 Task 4~6에 그대로 있으니 함께 참고하되, **아래 "현재 코드 기준 정정 2건"을 우선한다.**

**Goal:** GA4 Data API로 트래픽·유입·인기페이지·도메인이벤트를 조회해 admin에 무의존성 SVG/테이블 대시보드를 추가한다.

## Global Constraints

- **패키지 매니저는 pnpm** (npm/yarn 금지). Next.js 16 App Router, TypeScript strict.
- 신규 의존성은 **`google-auth-library`만** (이 Phase에서만 추가). 새 차트 라이브러리·`@google-analytics/data`(gRPC) 금지 — 인라인 SVG + REST fetch.
- 서비스 계정 자격증명은 **환경변수로만** 읽고 값을 코드/커밋에 넣지 마라: `GA4_PROPERTY_ID`, `GA_SA_CLIENT_EMAIL`, `GA_SA_PRIVATE_KEY`.
- **env 미설정 시 조용히 비활성화** — `get*`가 `null` 반환, 대시보드는 "분석이 설정되지 않았습니다" 폴백. 앱은 정상 동작.
- `src/lib/ga4.ts`는 `import "server-only"`. gtag/클라이언트 계측은 Phase 1에서 끝났으니 손대지 말 것.
- **커밋 규칙:** `git add <명시 경로>`로 내가 만든 파일만. `git add -A`/`git commit -a` 금지. `Co-Authored-By` 트레일러 금지(훅 거부).
- 완료 후 `pnpm test`(vitest, node env)·`pnpm build` 통과. 실시간 계측 검증은 브라우저·GA4 실시간 보고서로 수동.

---

## ⚠️ 현재 코드 기준 정정 2건 (원본 계획서보다 우선)

1. **사이드바 nav 삽입 위치** — 원본 계획서 Task 6은 존재하지 않는 "메인" 그룹에 넣으라고 되어 있다. 현재 [src/app/admin/AdminSidebarNav.tsx](../../src/app/admin/AdminSidebarNav.tsx)는 `groups: NavGroup[]`(운영/콘텐츠/관리/모집) + 접이식 구조다. **"운영" 그룹의 `items` 배열에서 `대시보드(/admin)` 항목 바로 다음에** `{ href: "/admin/analytics", label: "분석", icon: "analytics" }`를 추가하고, `icons` 맵에 `analytics` 아이콘 path를 추가하라(예: `analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2"`). 그룹 구조·접이식 로직은 건드리지 말 것.

2. **StatCard 재사용** — 원본 계획서 Task 6은 페이지 안에 인라인 `StatCard`를 새로 정의한다. **하지 마라.** 이미 [src/components/StatCard.tsx](../../src/components/StatCard.tsx)가 있고 props는 `{ label, value, hint?, emphasis? }`다. 이걸 import해서 쓰라(값은 문자열/숫자 — 컴포넌트 시그니처를 먼저 확인). `Section`/`RankTable`/`TrafficChart`는 페이지-로컬로 새로 만들어도 됨.

---

## 파일 구조 (Phase 2)

- Modify `package.json` — `google-auth-library` 추가 (`pnpm add google-auth-library`)
- Create `src/lib/ga4.ts` — 인증·조회·정규화 (server-only)
- Create `tests/ga4.test.ts` — 순수 매퍼 단위테스트
- Create `src/app/admin/analytics/page.tsx` — 대시보드 서버 컴포넌트
- Create `src/app/admin/analytics/TrafficChart.tsx` — 인라인 SVG 라인차트
- Modify `src/app/admin/AdminSidebarNav.tsx` — "분석" nav 항목(위 정정 1 참조)

---

## Task 4 — GA4 Data API 인증 + 트래픽 조회 `lib/ga4.ts`

원본 계획서 Task 4의 코드·테스트를 그대로 사용. 요지:

- `pnpm add google-auth-library`.
- 순수 함수 `parseRows(json): string[][]`, `mapTraffic(json): TrafficPoint[]` (export, 테스트 대상).
- `getAccessToken()`(JWT, `analytics.readonly` scope) → `runReport(body)`(REST `analyticsdata.googleapis.com/v1beta/properties/{id}:runReport`, `next: { revalidate: 3600 }`) → `getTrafficOverview(range): Promise<TrafficPoint[] | null>`.
- 타입: `DateRange = { startDate; endDate }`, `TrafficPoint = { date; activeUsers; sessions; pageViews }`.
- **env(`GA4_PROPERTY_ID`·`GA_SA_CLIENT_EMAIL`·`GA_SA_PRIVATE_KEY`) 없으면 `null` 반환.** `GA_SA_PRIVATE_KEY`는 `.replace(/\\n/g, "\n")` 처리.
- `tests/ga4.test.ts`: `parseRows`(rows 정규화 / 빈·null → `[]`), `mapTraffic`(숫자 변환) 검증.

**수용:** `pnpm test -- tests/ga4.test.ts` 통과.

---

## Task 5 — 유입·인기페이지·도메인이벤트 조회 (`lib/ga4.ts`에 추가)

원본 계획서 Task 5의 코드·테스트를 그대로 사용. 요지:

- 순수 매퍼 `mapChannels`/`mapPages`/`mapEvents` (export, 테스트 대상) — 각각 `parseRows` 재사용.
- `getAcquisition(range, limit=8)`(dim `sessionDefaultChannelGroup`, metric `sessions`), `getTopPages(range, limit=8)`(dim `pagePath`, metric `screenPageViews`), `getDomainEvents(range)`(dim `eventName`, metric `eventCount`, `inListFilter`로 `["apply_submit","login","attendance_check","survey_submit"]`만).
- 타입: `ChannelRow`/`PageRow`/`EventRow`. 각 `get*`는 env 없으면 `null`.
- `tests/ga4.test.ts`에 매퍼 테스트 append.

**수용:** `pnpm test -- tests/ga4.test.ts` 전체 통과.

---

## Task 6 — admin 대시보드 페이지 + nav

원본 계획서 Task 6의 페이지·차트 코드를 사용하되 **위 정정 1·2 반영**.

- `src/app/admin/analytics/TrafficChart.tsx`: `TrafficPoint[]`를 받아 세션 기준 인라인 SVG `polyline`. 빈 데이터는 "데이터가 없습니다.".
- `src/app/admin/analytics/page.tsx`(async 서버 컴포넌트):
  - `searchParams: Promise<{ range?: string }>` → `?range=7d`/`?range=30d`(기본 30일)로 `DateRange`(`{startDate: "30daysAgo", endDate: "today"}`) 산출.
  - `Promise.all([getTrafficOverview, getAcquisition, getTopPages, getDomainEvents])`.
  - `traffic === null`이면 "분석이 설정되지 않았습니다. GA4 환경변수를 확인하세요." 폴백.
  - 상단 통계 카드 4개(활성 유저·세션·페이지뷰·주요 전환) — **기존 `StatCard` 재사용**(정정 2).
  - 섹션: 트래픽 추이(`TrafficChart`), 유입 경로·인기 페이지(페이지-로컬 `RankTable`), 도메인 이벤트. `NEXT_PUBLIC_CLARITY_PROJECT_ID` 있으면 Clarity 링크.
  - 색상은 기존 토큰(`text-primary`/`bg-primary`, `--color-primary` 존재).
  - **접근 제어:** admin 레이아웃의 기존 `requireAdmin` 게이팅에 의존(페이지에서 별도 처리 불필요 — 기존 admin 라우트와 동일 패턴인지 확인).
- `AdminSidebarNav.tsx`: 정정 1대로 "운영" 그룹 대시보드 다음에 "분석" 추가 + `analytics` 아이콘.

**수용 기준:**
- env 미설정으로 `/admin/analytics` 접근 → 폴백, 에러 없음.
- env 설정 후: 카드 4·추이 차트·유입/페이지/이벤트 표·(있으면)Clarity 링크 렌더, `?range` 토글 동작.
- 사이드바 "운영"에 "분석" 항목·활성 표시 동작.
- 비admin 접근 차단(기존 게이팅). `pnpm test`·`pnpm build` 통과.
