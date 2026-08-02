# 분석 계측 + admin 대시보드 설계

- 작성일: 2026-07-19
- 상태: 승인 대기
- 구현 담당: 별도 코딩 에이전트(Codex)에게 핸드오프 예정 → **이 문서는 대화 맥락 없이 단독으로 구현 가능해야 한다.**

## 1. 목표

GDG DJU 관리 시스템에 GA4와 MS Clarity를 도입해 유저 행동 지표를 수집하고, 운영진이 admin 안에서 핵심 지표를 볼 수 있는 커스텀 대시보드를 만든다.

기존 `@vercel/analytics`·`@vercel/speed-insights`는 그대로 유지한다. 세 도구는 역할이 겹치지 않게 쌓는다.

| 도구 | 역할 | 상태 |
|---|---|---|
| Vercel Analytics | 가볍고 쿠키 없는 방문/페이지뷰 집계 | 유지 (변경 없음) |
| GA4 | 이벤트·퍼널·유입·전환 (도메인 행동 추적) | **신규** |
| MS Clarity | 세션 리플레이·히트맵 (정성 분석) | **신규** |

**GTM은 도입하지 않는다.** 이 규모에서 운영진이 코드 없이 태그를 계속 추가할 시나리오가 없어 순수 오버헤드다. GA4·Clarity는 Next.js에 직접 주입한다.

## 2. 비목표 (Non-goals)

- GTM 도입
- Clarity 데이터를 대시보드에 차트로 끌어오기 (Clarity API는 얕음 → 콘솔 링크아웃만)
- Consent Mode v2의 쿠키리스 모델링 핑 (동의 전엔 스크립트를 아예 로드하지 않는 단순 방식 채택)
- 새 차트 라이브러리 도입 (인라인 SVG + 테이블/막대로 시작)
- Vercel Analytics 제거·교체

## 3. 사전 준비 — 계정/속성 생성 (사람이 수동으로 수행)

구현 에이전트는 코드만 작성한다. 아래 계정 생성은 사용자가 직접 하고, 산출되는 값들을 환경변수로 넣는다. 구현 에이전트는 **이 값들이 env로 주입된다고 가정**하고 코드를 작성한다 (값 하드코딩 금지).

### 3.1 GA4
1. Google Analytics → 속성(Property) 생성 → 웹 데이터 스트림 추가.
2. **측정 ID** `G-XXXXXXXXXX` 확보 → `NEXT_PUBLIC_GA4_MEASUREMENT_ID`.
3. 속성 설정에서 **속성 ID(숫자)** 확보 → `GA4_PROPERTY_ID`.

### 3.2 MS Clarity
1. clarity.microsoft.com → 프로젝트 생성.
2. **프로젝트 ID** 확보 → `NEXT_PUBLIC_CLARITY_PROJECT_ID`.
3. 프로젝트 대시보드 URL을 대시보드 링크아웃에 사용 (`https://clarity.microsoft.com/projects/view/<projectId>`).

### 3.3 GA4 Data API용 서비스 계정 (대시보드 Phase 2에서 필요)
1. Google Cloud Console → 프로젝트 선택/생성 → **Google Analytics Data API** 사용 설정.
2. 서비스 계정 생성 → JSON 키 발급.
3. JSON에서 `client_email`, `private_key` 추출 → `GA_SA_CLIENT_EMAIL`, `GA_SA_PRIVATE_KEY`.
4. GA4 속성 → 관리 → 속성 액세스 관리 → 위 `client_email`을 **뷰어**로 추가.

### 3.4 환경변수 종합

```
# 클라이언트 노출 (Phase 1)
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_PROJECT_ID=xxxxxxxxxx

# 서버 전용 (Phase 2)
GA4_PROPERTY_ID=123456789
GA_SA_CLIENT_EMAIL=xxx@yyy.iam.gserviceaccount.com
GA_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- Vercel 환경변수에 등록. `GA_SA_PRIVATE_KEY`는 개행이 `\n` 이스케이프로 저장되므로 코드에서 `.replace(/\\n/g, "\n")` 처리.
- **환경변수가 없으면 계측·대시보드는 조용히 비활성화**되고 앱은 정상 동작해야 한다 (로컬 개발·env 미설정 상태 보호).

## 4. Phase 1 — 계측 레이어

### 4.1 동의 게이팅 정책
- 첫 방문 시 동의 배너 노출. 선택을 `localStorage`(키: `analytics-consent`, 값: `"granted" | "denied"`)에 저장.
- **동의(`granted`) 전에는 GA4·Clarity 스크립트를 아예 로드하지 않는다.** 거부 시에도 로드하지 않는다.
- Vercel Analytics는 쿠키가 없으므로 배너와 무관하게 항상 동작 (변경 없음).

### 4.2 신규 파일

#### `src/components/analytics/AnalyticsProvider.tsx` (client)
- 최상위에서 동의 상태를 읽어 관리.
- 동의 `granted`이고 env 존재 시:
  - GA4: `gtag.js`를 측정 ID로 주입, `gtag('js', new Date())` + `gtag('config', MEASUREMENT_ID)`.
  - Clarity: 표준 Clarity 스니펫을 프로젝트 ID로 주입.
- Next.js의 `next/script` 사용 (`strategy="afterInteractive"`).
- 동의 상태 미결정 시 `<ConsentBanner>` 렌더.

#### `src/components/analytics/ConsentBanner.tsx` (client)
- 하단 고정 배너. 문구 예: "서비스 개선을 위해 방문·행동 데이터를 수집합니다. 동의하시겠어요?" + [동의] [거부] 버튼.
- 선택 시 `localStorage`에 저장하고 배너를 닫으며, 동의면 즉시 스크립트 로드를 트리거(상태 갱신).
- 기존 디자인 토큰/버튼 컴포넌트(`@/components/Button`) 재사용, admin/member 어디서든 첫 방문 시 1회 노출.

#### `src/lib/analytics.ts`
- `trackEvent(name: string, params?: Record<string, unknown>): void`
  - `window.gtag`가 있으면 `gtag('event', name, params)` 호출, 없으면 no-op.
- 이벤트 이름 상수 export (오타 방지):
  ```ts
  export const EVENTS = {
    applySubmit: "apply_submit",
    login: "login",
    attendanceCheck: "attendance_check",
    surveySubmit: "survey_submit",
  } as const;
  ```

### 4.3 layout 연결
- `src/app/layout.tsx`의 `<body>` 안, 기존 `<Analytics />`/`<SpeedInsights />` 근처에 `<AnalyticsProvider />` 추가.

### 4.4 커스텀 이벤트 계약 (4개)

| 이벤트 | GA4 event name | 발화 위치 (클라이언트 성공 지점) | params |
|---|---|---|---|
| 지원서 제출 | `apply_submit` | `src/app/apply/ApplyForm.tsx` — `submitApplication` 성공 후 `setDone(true)` 분기(현재 32번째 줄 `else` 브랜치) | `{ position }` |
| 로그인 | `login` | 로그인 성공 클라이언트 핸들러 (`src/app/login` / `src/app/auth` 흐름의 성공 지점) | `{ method: "email" }` 등 실제 방식 |
| 출석 체크 | `attendance_check` | 멤버 출석 완료 성공 지점 (`src/app/(member)/attend`) | `{ event_id }` 가능 시 |
| 설문 응답 | `survey_submit` | 설문 응답 제출 성공 지점 (`src/app/(member)/surveys`) | `{ survey_id }` 가능 시 |

구현 노트:
- 모든 이벤트는 **클라이언트 성공 콜백에서** `trackEvent(EVENTS.x, {...})`로 발화. 서버 액션 안에서 발화하지 말 것 (gtag는 브라우저 전용).
- params는 있으면 좋고, 없으면 빈 이벤트로도 무방. 도메인 ID를 넘길 때 개인식별정보(이름·이메일·전화)는 절대 넣지 않는다.
- `apply_submit`은 위치가 확정(ApplyForm의 `setDone(true)` 라인). 나머지 3개는 해당 라우트의 성공 핸들러를 찾아 동일 패턴으로 삽입.

### 4.5 Phase 1 수용 기준
- [ ] 첫 방문 시 동의 배너가 뜬다. 선택은 새로고침 후에도 유지된다.
- [ ] 동의 전/거부 시 GA4·Clarity 네트워크 요청이 발생하지 않는다.
- [ ] 동의 후 GA4 실시간 보고서에 `page_view`가 잡힌다.
- [ ] 동의 후 Clarity에 세션이 기록된다.
- [ ] 지원서 제출/로그인/출석/설문 완료 시 GA4 실시간 이벤트에 각 이벤트가 잡힌다.
- [ ] env 미설정 시 앱이 정상 동작하고 어떤 분석 스크립트도 로드되지 않는다.

## 5. Phase 2 — admin 대시보드

Phase 1로 데이터가 쌓이기 시작한 뒤 착수. 데이터 소스는 GA4 Data API.

### 5.1 데이터 레이어 — `src/lib/ga4.ts` (server-only)

- 새 의존성: **`google-auth-library`** (경량). `@google-analytics/data`(gRPC, 무거움)는 쓰지 않고 Data API v1beta **REST**를 `fetch`로 호출.
- 인증: `GA_SA_CLIENT_EMAIL` + `GA_SA_PRIVATE_KEY`로 JWT → 액세스 토큰.
- 엔드포인트: `POST https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`
- Next 캐시: 각 조회에 `next: { revalidate: 3600 }` (GA4 지연 감안, 1시간 캐시).
- env 미설정 시 각 함수는 `null`을 반환 → UI는 "분석 미설정" 안내로 폴백.

조회 함수 (각각 `runReport` 1회):

| 함수 | dimensions | metrics | 비고 |
|---|---|---|---|
| `getTrafficOverview(range)` | `date` | `activeUsers`, `sessions`, `screenPageViews` | 추이 라인차트용 시계열 |
| `getAcquisition(range)` | `sessionDefaultChannelGroup` (또는 `sessionSource`/`sessionMedium`) | `sessions` | 유입 경로, 상위 N |
| `getTopPages(range)` | `pagePath` | `screenPageViews` | 인기 페이지, 상위 N |
| `getDomainEvents(range)` | `eventName` | `eventCount` | `eventName` in (`apply_submit`,`login`,`attendance_check`,`survey_submit`) 필터 |

- `range`: `{ startDate, endDate }` (예: `7daysAgo`~`today`, `30daysAgo`~`today`). 기본 30일.
- 반환 타입은 UI가 바로 쓰기 쉬운 정규화된 배열/객체로 (raw GA4 응답을 그대로 노출하지 말 것).

### 5.2 UI — `src/app/admin/analytics/page.tsx` (server component)
- admin 레이아웃 하위이므로 `requireAdmin()` 게이팅은 이미 적용됨 (별도 인증 코드 불필요).
- `export const dynamic`는 admin layout이 `force-dynamic`이라 상속. 데이터는 `ga4.ts`의 `revalidate`로 캐시.
- 구성:
  - **요약 카드 4개**: 활성 유저 · 세션 · 페이지뷰 · 주요 전환 수(도메인 이벤트 합).
  - **트래픽 추이**: `getTrafficOverview` 결과를 인라인 SVG 라인/영역 차트로. 기간 토글(7일/30일)은 쿼리스트링(`?range=7d|30d`)으로.
  - **유입 경로 / 인기 페이지 / 도메인 이벤트**: 각각 상위 N개를 테이블 + 가로 막대(비율)로.
  - **Clarity 링크아웃**: "세션 리플레이 보기" 버튼 → Clarity 프로젝트 URL(새 탭).
- 차트는 새 라이브러리 없이 인라인 SVG + Tailwind로 구현. 데이터 없음/미설정 상태의 빈 화면 처리 포함.

### 5.3 admin 사이드바 nav 추가
- `src/app/admin/AdminSidebarNav.tsx`의 `groups`에서 "메인" 그룹(현재 `대시보드`)에 항목 추가:
  ```ts
  { href: "/admin/analytics", label: "분석", icon: "analytics" }
  ```
- `icons` 맵에 `analytics` 키의 SVG path 추가 (막대차트류 아이콘, 기존 `viewBox="0 0 24 24"`·stroke 스타일에 맞춰).

### 5.4 Phase 2 수용 기준
- [ ] `/admin/analytics` 접근 시 admin만 볼 수 있다 (비admin 리다이렉트, 기존 게이팅).
- [ ] 4개 요약 카드가 GA4 실데이터로 채워진다.
- [ ] 트래픽 추이 차트가 렌더되고 7일/30일 토글이 동작한다.
- [ ] 유입 경로·인기 페이지·도메인 이벤트 표가 상위 N개를 보여준다.
- [ ] Clarity 링크아웃이 프로젝트 콘솔로 연결된다.
- [ ] env 미설정/데이터 없음 시 "분석 미설정" 폴백이 뜨고 에러 없이 렌더된다.
- [ ] 사이드바 "메인" 그룹에 "분석" 항목이 추가되고 활성 표시가 동작한다.

## 6. 의존성 변화
- 추가: `google-auth-library` (Phase 2, 서버 인증).
- 추가 안 함: GTM, `@google-analytics/data`, 차트 라이브러리.

## 7. 리스크 / 결정 근거
- **동의 전 미로딩** 방식은 데이터 손실(동의 안 한 유저)이 있지만 PIPA 안전 + 구현 단순. 추후 Consent Mode로 업그레이드 가능.
- **REST + google-auth-library**로 서버리스(Vercel) 번들 경량화. gRPC 회피.
- **무의존성 SVG 차트**로 시작 → 인터랙션 요구가 커지면 Recharts 도입은 별도 작업.
- 커스텀 이벤트 params에 PII 금지 (GA4 정책 + 개인정보 보호).
