# 분석 계측 + admin 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GA4·MS Clarity를 동의 기반으로 계측하고, GA4 Data API로 채운 커스텀 대시보드를 admin에 추가한다.

**Architecture:** 첫 방문 동의 배너로 게이팅 → 동의 시에만 GA4(gtag)·Clarity 스크립트 로드. 4개 도메인 이벤트를 각 라우트의 클라이언트 성공 지점에서 발화. 대시보드는 서버 컴포넌트가 `lib/ga4.ts`(google-auth-library + Data API REST)로 지표를 조회해 무의존성 SVG/테이블로 렌더.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19, Tailwind v4, vitest(node env). 신규 의존성: `google-auth-library`(Phase 2만).

**참조 스펙:** `docs/superpowers/specs/2026-07-19-analytics-dashboard-design.md`

## Global Constraints

- **GTM 도입 금지.** GA4·Clarity는 Next.js에 직접 주입.
- **동의 전엔 GA4·Clarity 스크립트를 로드하지 않는다.** localStorage 키 `analytics-consent`, 값 `"granted" | "denied"`.
- **env 미설정 시 조용히 비활성화** — 앱은 정상 동작, 어떤 분석 스크립트/요청도 발생하지 않음.
- **커스텀 이벤트 params에 PII(이름·이메일·전화) 금지.**
- 이벤트 이름 고정: `apply_submit`, `login`, `attendance_check`, `survey_submit`.
- gtag 호출은 **클라이언트에서만**. 서버 액션 안에서 발화 금지.
- 새 차트 라이브러리·`@google-analytics/data`(gRPC) 도입 금지. 인라인 SVG + REST fetch.
- Vercel Analytics(`@vercel/analytics`)는 변경하지 않는다.
- 테스트 환경은 vitest `node` — DOM 없음. 클라이언트 컴포넌트/실시간 계측은 브라우저·GA4 실시간 보고서로 수동 검증.
- 커밋 메시지 컨벤션: conventional prefix 또는 선두 emoji (기존 저장소 스타일). Co-Authored-By 트레일러는 이 워크트리에서 거부되므로 넣지 않는다.

## 파일 구조

**Phase 1 (계측)**
- Create `src/lib/analytics.ts` — `trackEvent` + `EVENTS` 상수 (클라이언트 이벤트 헬퍼)
- Create `src/components/analytics/AnalyticsProvider.tsx` — 동의 상태 관리 + 조건부 스크립트 주입
- Create `src/components/analytics/ConsentBanner.tsx` — 동의 배너 UI
- Modify `src/app/layout.tsx` — `<AnalyticsProvider />` 마운트
- Modify `src/app/apply/ApplyForm.tsx` — `apply_submit` 발화
- Modify `src/app/login/*` (로그인 성공 지점) — `login` 발화
- Modify `src/app/(member)/attend/*` (출석 성공 지점) — `attendance_check` 발화
- Modify `src/app/(member)/surveys/*` (설문 제출 성공 지점) — `survey_submit` 발화
- Create `tests/analytics.test.ts` — `trackEvent` 가드 단위테스트

**Phase 2 (대시보드)**
- Modify `package.json` — `google-auth-library` 추가
- Create `src/lib/ga4.ts` — 인증·조회·정규화 (server-only)
- Create `tests/ga4.test.ts` — 정규화 함수 단위테스트
- Create `src/app/admin/analytics/page.tsx` — 대시보드 서버 컴포넌트
- Create `src/app/admin/analytics/Charts.tsx` — 인라인 SVG 라인차트 + 막대 (client, 필요 시)
- Modify `src/app/admin/AdminSidebarNav.tsx` — "분석" nav 항목 + 아이콘

---

## Task 1: 이벤트 헬퍼 `lib/analytics.ts`

**Files:**
- Create: `src/lib/analytics.ts`
- Test: `tests/analytics.test.ts`

**Interfaces:**
- Produces:
  - `EVENTS`: `{ applySubmit: "apply_submit"; login: "login"; attendanceCheck: "attendance_check"; surveySubmit: "survey_submit" }`
  - `trackEvent(name: string, params?: Record<string, unknown>): void`

- [ ] **Step 1: 실패 테스트 작성**

`tests/analytics.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTS, trackEvent } from "@/lib/analytics";

describe("trackEvent", () => {
  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    delete globalThis.window;
  });

  it("window.gtag이 없으면 조용히 무시한다 (throw 안 함)", () => {
    // @ts-expect-error - node 환경엔 window 없음
    globalThis.window = {};
    expect(() => trackEvent("apply_submit")).not.toThrow();
  });

  it("window.gtag이 있으면 event 이름과 params로 호출한다", () => {
    const gtag = vi.fn();
    // @ts-expect-error - 테스트용 window 주입
    globalThis.window = { gtag };
    trackEvent(EVENTS.applySubmit, { position: "frontend" });
    expect(gtag).toHaveBeenCalledWith("event", "apply_submit", {
      position: "frontend",
    });
  });

  it("window 자체가 없어도 (SSR) throw 안 함", () => {
    expect(() => trackEvent("login")).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/analytics.test.ts`
Expected: FAIL — `Cannot find module '@/lib/analytics'`

- [ ] **Step 3: 구현**

`src/lib/analytics.ts`:
```ts
export const EVENTS = {
  applySubmit: "apply_submit",
  login: "login",
  attendanceCheck: "attendance_check",
  surveySubmit: "survey_submit",
} as const;

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params ?? {});
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/analytics.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/analytics.ts tests/analytics.test.ts
git commit -m "feat: GA4 이벤트 헬퍼 trackEvent 추가"
```

---

## Task 2: 동의 배너 + 조건부 스크립트 주입

**Files:**
- Create: `src/components/analytics/ConsentBanner.tsx`
- Create: `src/components/analytics/AnalyticsProvider.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: 없음 (env: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`)
- Produces: `<AnalyticsProvider />` (default 아님, named export), layout에 마운트되어 동의 시 `window.gtag` 전역 노출

- [ ] **Step 1: ConsentBanner 구현**

`src/components/analytics/ConsentBanner.tsx`:
```tsx
"use client";

import { Button } from "@/components/Button";

interface ConsentBannerProps {
  onDecision: (value: "granted" | "denied") => void;
}

export function ConsentBanner({ onDecision }: ConsentBannerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:bg-gray-50/95">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          서비스 개선을 위해 방문·행동 데이터를 수집합니다. 동의하시겠어요?
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => onDecision("denied")}>
            거부
          </Button>
          <Button variant="primary" onClick={() => onDecision("granted")}>
            동의
          </Button>
        </div>
      </div>
    </div>
  );
}
```

> 참고: `Button`이 `variant="secondary"`를 지원하는지 `src/components/Button.tsx`에서 확인. 없으면 존재하는 variant로 교체.

- [ ] **Step 2: AnalyticsProvider 구현**

`src/components/analytics/AnalyticsProvider.tsx`:
```tsx
"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { ConsentBanner } from "./ConsentBanner";

type Consent = "granted" | "denied" | "unknown";

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export function AnalyticsProvider() {
  const [consent, setConsent] = useState<Consent>("unknown");

  useEffect(() => {
    const stored = localStorage.getItem("analytics-consent");
    if (stored === "granted" || stored === "denied") setConsent(stored);
  }, []);

  function decide(value: "granted" | "denied") {
    localStorage.setItem("analytics-consent", value);
    setConsent(value);
  }

  const enabled = consent === "granted";

  return (
    <>
      {enabled && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {enabled && CLARITY_ID && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
        </Script>
      )}
      {consent === "unknown" && (GA_ID || CLARITY_ID) && (
        <ConsentBanner onDecision={decide} />
      )}
    </>
  );
}
```

- [ ] **Step 3: layout에 마운트**

`src/app/layout.tsx` — 기존 `<Analytics />` 근처에 추가:
```tsx
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
// ...
        {children}
        <AnalyticsProvider />
        <Analytics />
        <SpeedInsights />
```

- [ ] **Step 4: 타입·빌드 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 브라우저 검증 (preview_start로 dev 서버)**

`.env.local`에 임시 테스트용 `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_PROJECT_ID` 설정 후:
- 첫 방문 시 하단 동의 배너가 뜬다.
- 개발자도구 Network: 동의 전엔 `googletagmanager.com`·`clarity.ms` 요청 없음.
- "동의" 클릭 → 두 요청 발생, `window.gtag`가 함수로 존재.
- 새로고침 후 배너 안 뜨고 스크립트 자동 로드.
- localStorage에서 `analytics-consent` 삭제 후 새로고침 → 배너 다시 뜸.
- env 두 개 모두 제거하면 배너·스크립트 모두 안 뜸.

- [ ] **Step 6: 커밋**

```bash
git add src/components/analytics/ src/app/layout.tsx
git commit -m "feat: 동의 배너 기반 GA4·Clarity 조건부 로딩"
```

---

## Task 3: 4개 도메인 이벤트 발화 연결

**Files:**
- Modify: `src/app/apply/ApplyForm.tsx`
- Modify: 로그인 성공 지점 (`src/app/login/` 하위 클라이언트 컴포넌트)
- Modify: 출석 성공 지점 (`src/app/(member)/attend/` 하위 클라이언트 컴포넌트)
- Modify: 설문 제출 성공 지점 (`src/app/(member)/surveys/` 하위 클라이언트 컴포넌트)

**Interfaces:**
- Consumes: `trackEvent`, `EVENTS` (Task 1)

- [ ] **Step 1: 지원서 제출 (`apply_submit`)**

`src/app/apply/ApplyForm.tsx` — 상단 import 추가:
```tsx
import { trackEvent, EVENTS } from "@/lib/analytics";
```
`handleSubmit`의 성공 분기 수정 (현재 `else setDone(true);` 부분):
```tsx
      const result = await submitApplication(formData);
      if (result?.error) setError(result.error);
      else {
        trackEvent(EVENTS.applySubmit, { position });
        setDone(true);
      }
```

- [ ] **Step 2: 로그인 (`login`)**

`src/app/login/` 하위에서 로그인 **성공** 클라이언트 콜백을 찾는다 (성공 후 리다이렉트/상태변경 지점). 그 직후에:
```tsx
import { trackEvent, EVENTS } from "@/lib/analytics";
// 성공 직후:
trackEvent(EVENTS.login, { method: "email" });
```
> 로그인 방식이 이메일 외(OAuth 등)면 `method`를 실제 값으로. 성공 판정이 서버 액션 결과라면 클라이언트 콜백에서 결과가 성공일 때만 발화.

- [ ] **Step 3: 출석 체크 (`attendance_check`)**

`src/app/(member)/attend/` 하위 출석 완료 성공 지점에서:
```tsx
import { trackEvent, EVENTS } from "@/lib/analytics";
// 출석 성공 직후 (가능하면 이벤트 ID 포함):
trackEvent(EVENTS.attendanceCheck, { event_id: eventId });
```
> `eventId` 변수가 없으면 params 없이 `trackEvent(EVENTS.attendanceCheck)`.

- [ ] **Step 4: 설문 응답 (`survey_submit`)**

`src/app/(member)/surveys/` 하위 설문 제출 성공 지점에서:
```tsx
import { trackEvent, EVENTS } from "@/lib/analytics";
// 제출 성공 직후:
trackEvent(EVENTS.surveySubmit, { survey_id: surveyId });
```
> `surveyId` 변수가 없으면 params 없이 발화.

- [ ] **Step 5: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 실시간 검증**

dev 서버에서 동의 후 각 흐름을 1회씩 실행 → GA4 → 보고서 → 실시간에서 `apply_submit`·`login`·`attendance_check`·`survey_submit` 이벤트가 잡히는지 확인. (params에 이름·이메일·전화 없는지 재확인.)

- [ ] **Step 7: 커밋**

```bash
git add src/app/apply/ApplyForm.tsx src/app/login src/app/\(member\)/attend src/app/\(member\)/surveys
git commit -m "feat: 지원·로그인·출석·설문 GA4 이벤트 계측"
```

---

## Task 4: GA4 Data API 인증 + 트래픽 조회 `lib/ga4.ts`

**Files:**
- Modify: `package.json` (`google-auth-library` 추가)
- Create: `src/lib/ga4.ts`
- Test: `tests/ga4.test.ts`

**Interfaces:**
- Produces:
  - 타입: `DateRange = { startDate: string; endDate: string }`
  - 타입: `TrafficPoint = { date: string; activeUsers: number; sessions: number; pageViews: number }`
  - `parseRows(json: unknown): string[][]` — GA4 runReport 응답을 `[dimVals..., metricVals...]` 문자열 행 배열로 정규화 (순수 함수, export)
  - `getTrafficOverview(range: DateRange): Promise<TrafficPoint[] | null>` — env 없으면 `null`
  - 내부: `runReport(body): Promise<unknown | null>`, `getAccessToken(): Promise<string | null>`

- [ ] **Step 1: 의존성 설치**

Run: `npm install google-auth-library`
Expected: `package.json` dependencies에 추가됨

- [ ] **Step 2: 정규화 실패 테스트 작성**

`tests/ga4.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseRows, mapTraffic } from "@/lib/ga4";

const sample = {
  rows: [
    {
      dimensionValues: [{ value: "20260701" }],
      metricValues: [{ value: "12" }, { value: "30" }, { value: "88" }],
    },
    {
      dimensionValues: [{ value: "20260702" }],
      metricValues: [{ value: "9" }, { value: "20" }, { value: "60" }],
    },
  ],
};

describe("parseRows", () => {
  it("dimension+metric 값을 문자열 행 배열로 편다", () => {
    expect(parseRows(sample)).toEqual([
      ["20260701", "12", "30", "88"],
      ["20260702", "9", "20", "60"],
    ]);
  });

  it("rows 없으면 빈 배열", () => {
    expect(parseRows({})).toEqual([]);
    expect(parseRows(null)).toEqual([]);
  });
});

describe("mapTraffic", () => {
  it("트래픽 포인트로 매핑하고 숫자로 변환한다", () => {
    expect(mapTraffic(sample)).toEqual([
      { date: "20260701", activeUsers: 12, sessions: 30, pageViews: 88 },
      { date: "20260702", activeUsers: 9, sessions: 20, pageViews: 60 },
    ]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/ga4.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ga4'`

- [ ] **Step 4: 구현**

`src/lib/ga4.ts`:
```ts
import "server-only";
import { JWT } from "google-auth-library";

export type DateRange = { startDate: string; endDate: string };
export type TrafficPoint = {
  date: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
};

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const CLIENT_EMAIL = process.env.GA_SA_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GA_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");

export function parseRows(json: unknown): string[][] {
  const rows = (json as { rows?: unknown[] } | null)?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as {
      dimensionValues?: { value: string }[];
      metricValues?: { value: string }[];
    };
    return [
      ...(row.dimensionValues ?? []).map((d) => d.value),
      ...(row.metricValues ?? []).map((m) => m.value),
    ];
  });
}

export function mapTraffic(json: unknown): TrafficPoint[] {
  return parseRows(json).map(([date, u, s, v]) => ({
    date,
    activeUsers: Number(u ?? 0),
    sessions: Number(s ?? 0),
    pageViews: Number(v ?? 0),
  }));
}

async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) return null;
  const client = new JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const { access_token } = await client.authorize();
  return access_token ?? null;
}

async function runReport(body: Record<string, unknown>): Promise<unknown | null> {
  if (!PROPERTY_ID) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      next: { revalidate: 3600 },
    },
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getTrafficOverview(
  range: DateRange,
): Promise<TrafficPoint[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  if (json === null) return null;
  return mapTraffic(json);
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test -- tests/ga4.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/lib/ga4.ts tests/ga4.test.ts
git commit -m "feat: GA4 Data API 트래픽 조회 모듈"
```

---

## Task 5: 유입 경로·인기 페이지·도메인 이벤트 조회

**Files:**
- Modify: `src/lib/ga4.ts`
- Test: `tests/ga4.test.ts`

**Interfaces:**
- Consumes: `parseRows`, `runReport`, `DateRange` (Task 4)
- Produces:
  - 타입: `ChannelRow = { channel: string; sessions: number }`
  - 타입: `PageRow = { path: string; views: number }`
  - 타입: `EventRow = { name: string; count: number }`
  - `getAcquisition(range, limit?): Promise<ChannelRow[] | null>`
  - `getTopPages(range, limit?): Promise<PageRow[] | null>`
  - `getDomainEvents(range): Promise<EventRow[] | null>`
  - 순수 매퍼 `mapChannels`, `mapPages`, `mapEvents` (export, 테스트 대상)

- [ ] **Step 1: 매퍼 실패 테스트 추가**

`tests/ga4.test.ts`에 append:
```ts
import { mapChannels, mapPages, mapEvents } from "@/lib/ga4";

describe("mapChannels/mapPages/mapEvents", () => {
  it("채널 행 매핑", () => {
    const json = {
      rows: [
        { dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "40" }] },
      ],
    };
    expect(mapChannels(json)).toEqual([{ channel: "Organic Search", sessions: 40 }]);
  });

  it("페이지 행 매핑", () => {
    const json = {
      rows: [{ dimensionValues: [{ value: "/apply" }], metricValues: [{ value: "15" }] }],
    };
    expect(mapPages(json)).toEqual([{ path: "/apply", views: 15 }]);
  });

  it("이벤트 행 매핑", () => {
    const json = {
      rows: [{ dimensionValues: [{ value: "apply_submit" }], metricValues: [{ value: "7" }] }],
    };
    expect(mapEvents(json)).toEqual([{ name: "apply_submit", count: 7 }]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/ga4.test.ts`
Expected: FAIL — `mapChannels` 등 export 없음

- [ ] **Step 3: 구현 추가**

`src/lib/ga4.ts`에 append:
```ts
export type ChannelRow = { channel: string; sessions: number };
export type PageRow = { path: string; views: number };
export type EventRow = { name: string; count: number };

const DOMAIN_EVENTS = ["apply_submit", "login", "attendance_check", "survey_submit"];

export function mapChannels(json: unknown): ChannelRow[] {
  return parseRows(json).map(([channel, s]) => ({
    channel,
    sessions: Number(s ?? 0),
  }));
}

export function mapPages(json: unknown): PageRow[] {
  return parseRows(json).map(([path, v]) => ({ path, views: Number(v ?? 0) }));
}

export function mapEvents(json: unknown): EventRow[] {
  return parseRows(json).map(([name, c]) => ({ name, count: Number(c ?? 0) }));
}

export async function getAcquisition(
  range: DateRange,
  limit = 8,
): Promise<ChannelRow[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });
  if (json === null) return null;
  return mapChannels(json);
}

export async function getTopPages(
  range: DateRange,
  limit = 8,
): Promise<PageRow[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit,
  });
  if (json === null) return null;
  return mapPages(json);
}

export async function getDomainEvents(
  range: DateRange,
): Promise<EventRow[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: DOMAIN_EVENTS },
      },
    },
  });
  if (json === null) return null;
  return mapEvents(json);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/ga4.test.ts`
Expected: PASS (전체 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ga4.ts tests/ga4.test.ts
git commit -m "feat: GA4 유입·페이지·도메인이벤트 조회 추가"
```

---

## Task 6: admin 대시보드 페이지 + nav

**Files:**
- Create: `src/app/admin/analytics/page.tsx`
- Create: `src/app/admin/analytics/TrafficChart.tsx`
- Modify: `src/app/admin/AdminSidebarNav.tsx`

**Interfaces:**
- Consumes: `getTrafficOverview`, `getAcquisition`, `getTopPages`, `getDomainEvents`, `TrafficPoint` 등 (Task 4·5)

- [ ] **Step 1: 트래픽 SVG 차트 컴포넌트**

`src/app/admin/analytics/TrafficChart.tsx`:
```tsx
import type { TrafficPoint } from "@/lib/ga4";

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
  }
  const w = 640;
  const h = 160;
  const max = Math.max(...data.map((d) => d.sessions), 1);
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data
    .map((d, i) => `${i * step},${h - (d.sessions / max) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-primary"
        points={pts}
      />
    </svg>
  );
}
```

- [ ] **Step 2: 대시보드 페이지**

`src/app/admin/analytics/page.tsx`:
```tsx
import {
  getAcquisition,
  getDomainEvents,
  getTopPages,
  getTrafficOverview,
  type DateRange,
} from "@/lib/ga4";
import { TrafficChart } from "./TrafficChart";

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

function rangeFor(param?: string): DateRange {
  const days = param === "7d" ? 7 : 30;
  return { startDate: `${days}daysAgo`, endDate: "today" };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = rangeFor(rangeParam);
  const [traffic, channels, pages, events] = await Promise.all([
    getTrafficOverview(range),
    getAcquisition(range),
    getTopPages(range),
    getDomainEvents(range),
  ]);

  if (traffic === null) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        분석이 설정되지 않았습니다. GA4 환경변수를 확인하세요.
      </div>
    );
  }

  const totals = traffic.reduce(
    (a, p) => ({
      users: a.users + p.activeUsers,
      sessions: a.sessions + p.sessions,
      views: a.views + p.pageViews,
    }),
    { users: 0, sessions: 0, views: 0 },
  );
  const conversions = (events ?? []).reduce((s, e) => s + e.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">분석</h1>
        <div className="flex gap-1 text-sm">
          <a href="?range=7d" className="rounded px-2 py-1 hover:bg-gray-100">7일</a>
          <a href="?range=30d" className="rounded px-2 py-1 hover:bg-gray-100">30일</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="활성 유저" value={totals.users} />
        <StatCard label="세션" value={totals.sessions} />
        <StatCard label="페이지뷰" value={totals.views} />
        <StatCard label="주요 전환" value={conversions} />
      </div>

      <Section title="트래픽 추이 (세션)">
        <TrafficChart data={traffic} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="유입 경로">
          <RankTable rows={(channels ?? []).map((c) => [c.channel, c.sessions])} />
        </Section>
        <Section title="인기 페이지">
          <RankTable rows={(pages ?? []).map((p) => [p.path, p.views])} />
        </Section>
      </div>

      <Section title="도메인 이벤트">
        <RankTable rows={(events ?? []).map((e) => [e.name, e.count])} />
      </Section>

      {CLARITY_ID && (
        <a
          href={`https://clarity.microsoft.com/projects/view/${CLARITY_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Clarity 세션 리플레이 보기 →
        </a>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </section>
  );
}

function RankTable({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
  }
  const max = Math.max(...rows.map(([, v]) => v), 1);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-gray-700" title={label}>
            {label}
          </span>
          <span className="relative h-2 flex-1 rounded bg-gray-100">
            <span
              className="absolute inset-y-0 left-0 rounded bg-primary"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-gray-900">
            {value.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

> `text-primary`/`bg-primary` 등은 기존 globals.css 토큰. 존재 확인 후 사용.

- [ ] **Step 3: 사이드바 nav 항목 추가**

`src/app/admin/AdminSidebarNav.tsx`:
- `icons` 맵에 추가:
```ts
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
```
- "메인" 그룹 items에 추가:
```ts
  { title: "메인", items: [
    { href: "/admin", label: "대시보드", icon: "dashboard" },
    { href: "/admin/analytics", label: "분석", icon: "analytics" },
  ] },
```

- [ ] **Step 4: 타입·빌드 확인**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음

- [ ] **Step 5: 브라우저 검증**

- env(`GA4_PROPERTY_ID`,`GA_SA_CLIENT_EMAIL`,`GA_SA_PRIVATE_KEY`) 미설정 상태로 `/admin/analytics` 접근 → "분석이 설정되지 않았습니다" 폴백, 에러 없음.
- env 설정 후: 카드 4개·추이 차트·유입/페이지/이벤트 표·Clarity 링크 렌더. `?range=7d`/`?range=30d` 토글 동작.
- 사이드바 "메인"에 "분석" 항목, 활성 표시 동작.
- 비admin 계정으로 접근 시 기존 `requireAdmin` 게이팅으로 차단.

- [ ] **Step 6: 커밋**

```bash
git add src/app/admin/analytics src/app/admin/AdminSidebarNav.tsx
git commit -m "feat: admin 분석 대시보드 페이지 추가"
```

---

## Self-Review 결과

- **Spec 커버리지:** 계정 준비(§3, 사람 수동, 계획 대상 아님) / 동의·게이팅(Task 2) / 4 이벤트(Task 1·3) / ga4 4 조회(Task 4·5) / 대시보드 UI·nav·Clarity 링크(Task 6) / env 폴백(Task 2·4·6) — 모두 태스크로 매핑됨.
- **플레이스홀더:** 코드 스텝은 실제 코드 포함. 로그인·출석·설문 이벤트 삽입 지점은 파일 위치만 지정(해당 흐름의 성공 콜백)하고 삽입 코드는 명시 — 저장소마다 다른 성공 판정 로직에 맞추기 위한 최소 위임.
- **타입 일관성:** `parseRows`/`mapTraffic`/`mapChannels`/`mapPages`/`mapEvents`/`get*` 시그니처가 Task 4→5→6에서 일치. `TrafficPoint`·`ChannelRow`·`PageRow`·`EventRow` 필드명 일관.
