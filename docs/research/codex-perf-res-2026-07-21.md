# 구현 지시서 (Codex용): RES 58 → 95 성능 개선 (2026-07-21)

Vercel Speed Insights (Desktop / Production / Last 7 Days) 기준 **Real Experience Score 58**.
문제 라우트: `/` (RES 59, 40 samples), `/profile` (RES 65, 5 samples).

| 지표 | 필드값(P75) | 상태 | 목표 |
|---|---|---|---|
| FCP | **6.44s** | ❌ Poor | < 1.8s |
| LCP | **5.96s** | ❌ Poor | < 2.5s |
| TTFB | 0.23s | ✅ | — |
| INP | 80ms | ✅ | — |
| CLS | 0 | ✅ | — |

> 이 문서는 **계획서**다. 구현은 Codex가 한다. 각 작업은 파일 경로·변경 전후·검증까지 지정돼 있다.

---

## 핵심 결론 (실측 근거)

로컬 프로덕션 빌드(`pnpm build && pnpm start`)를 브라우저로 로드해 `performance` API로 실측:

```
TTFB 33ms · DOMContentLoaded 300ms · first-paint = first-contentful-paint = 2588ms
렌더-블로킹 리소스: 메인 CSS 1개(44b79a31z_ey2.css, 26KB gz)뿐 — 285ms에 로드 완료
```

**TTFB·서버·페이로드는 문제가 아니다.** CSS가 285ms에 끝났는데 첫 페인트는 2.3초 뒤다.
이 2.3초 공백은 **메인스레드를 점유하는 클라이언트 JS 실행**이다. 범인:

- 로그아웃 랜딩(`/`)이 **Supabase JS 클라이언트 전체**(청크 240KB raw / 63KB gz)를 First Load로 싣고 하이드레이션에서 **806ms 메인스레드 실행**. 이 버튼은 클릭 전엔 Supabase가 필요 없다.
- 필드 데이터(실사용자 P75)는 로컬보다 느린 기기·네트워크라 이 2.3s가 6s로 증폭된다.

### 원인 순위

| # | 원인 | 영향 라우트 | 레버 |
|---|---|---|---|
| **1** | Supabase 브라우저 클라이언트가 First Load JS에 정적 포함(806ms 실행) | `/`, `/profile` | **최대** — FCP 직결 |
| 2 | Pretendard `@font-face` 92개(55KB raw)가 렌더-블로킹 CSS에 인라인 | 전 페이지 | 중 |
| 3 | `react-markdown`+remark 무거운 청크가 필요 없는 곳까지 실릴 여지 | 상세 라우트 | 중 |
| 4 | 랜딩 orb 4개의 다층 box-shadow + `backdrop-filter blur` 페인트 비용 | `/` (로그아웃) | 소 |

---

## 범위 밖 (이번에 하지 말 것)

- ❌ DB·스키마·RLS·쿼리 로직 변경
- ❌ `force-dynamic` 제거 / 렌더링 모드 전환 (TTFB 0.23s로 정상 — 서버는 병목 아님)
- ❌ 디자인·레이아웃 리디자인 (orb는 **비주얼 유지**한 채 페인트 비용만 낮춤)
- ❌ 새 의존성 추가 (`next/font`는 내장이라 허용)
- ❌ 기능·데이터 계약 변경 (로그인 동작·아바타 표시 결과는 동일해야 함)

## 필수 준수

- **AGENTS.md**: 이 저장소는 네가 아는 Next.js가 아니다(16.2.10). 코드 전에 `node_modules/next/dist/docs/`에서 관련 규약(dynamic import, `next/font`) 확인.
- **최소 diff**. 기존 스타일·컴포넌트 그대로.
- 커밋은 **명시 경로만** 스테이징(같은 워킹트리에 다른 세션 작업 가능). **Co-Authored-By 트레일러 넣지 말 것.**
- 각 작업 후 **§검증**의 측정을 돌려 before/after 수치를 남길 것.

---

## 작업 1 — Supabase 클라이언트를 First Load에서 제거 (최우선)

브라우저 Supabase 클라이언트를 **모듈 최상단에서 정적 import** 하는 client 컴포넌트가 3곳. 각각 실제로 필요한 시점(클릭/이펙트)까지 로딩을 미뤄 First Load 청크에서 `@supabase/supabase-js`(240KB raw)를 뺀다.

대상:
- `src/app/landing-preview/GoogleLoginButton.tsx` — 클릭 시에만 필요
- `src/components/Avatar.tsx` — 마운트 후 이펙트에서 사용
- `src/app/(member)/profile/ProfileAvatar.tsx` — 동일

### 1-1. `GoogleLoginButton.tsx`
현재: 파일 상단 `import { createClient } from "@/lib/supabase/client"`.
변경: 최상단 정적 import를 제거하고 **핸들러 안에서 동적 import**.

```tsx
"use client";

export function GoogleLoginButton({ className }: { className?: string }) {
  async function handleGoogleLogin() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }
  return (
    <button type="button" className={className} onClick={handleGoogleLogin}>
      Google로 로그인하기
    </button>
  );
}
```

이것만으로 로그아웃 랜딩(`/`)의 First Load에서 Supabase 청크가 빠진다 — 랜딩엔 이 버튼이 유일한 Supabase 소비자다.

### 1-2. `Avatar.tsx` / `ProfileAvatar.tsx`
`createClient`를 이펙트 안에서 동적 import로 전환. 예(`Avatar.tsx`):

```tsx
useEffect(() => {
  let active = true;
  (async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    // ...기존 로직 그대로, active 가드로 언마운트 후 setState 방지
  })();
  return () => { active = false; };
}, [/* 기존 deps */]);
```

- 기존 이펙트 로직·의존성·표시 결과는 **동일하게** 유지. import 시점만 지연.
- 언마운트 경합 방지 가드(`active`) 추가.

**주의**: `@/lib/supabase/client` 외에 이 컴포넌트들이 top-level에서 끌어오는 다른 무거운 정적 import가 없는지 확인. 있으면 그것도 청크 분리 대상.

---

## 작업 2 — Pretendard 폰트를 렌더-블로킹 CSS에서 분리

`src/app/globals.css:2` 의
`@import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";`
는 92개 `@font-face`(55KB raw)를 **Tailwind가 번들하는 렌더-블로킹 CSS**에 인라인한다. 폰트 자체는 `font-display: swap`이라 텍스트를 막진 않지만, 블로킹 CSS 파싱 비용을 키운다.

**권장(안전·최소)**: `next/font/local` 로 Pretendard Variable을 self-host + `preload`.

1. `src/app/fonts.ts` 신설:
```ts
import localFont from "next/font/local";

export const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
  preload: true,
});
```
2. `src/app/layout.tsx`: `<html>` 에 `className={pretendard.variable}` 추가.
3. `globals.css`: 상단 `@import "pretendard/..."` **삭제**, `--font-sans` 를 `var(--font-pretendard), -apple-system, ...` 로.

> 트레이드오프: dynamic-subset(글자별 조각 로드)을 버리고 variable woff2 1개(≈1MB, 단 `preload`+`swap`로 논블로킹)로 바꾼다. 실사용 대부분이 한글이라 어차피 다수 subset을 받으므로 순증이 크지 않고, 렌더-블로킹 CSS에서 55KB가 빠지는 이득이 확실하다.
>
> **먼저 `node_modules/pretendard/dist/web/variable/woff2/` 에 `PretendardVariable.woff2` 존재를 확인**하고 없으면 static 파일 경로를 조정. self-host가 여의치 않으면 이 작업은 **보류(P2)** 하고 작업 1·3만으로 재측정.

---

## 작업 3 — `react-markdown` 지연 로드 확인

`src/components/Markdown.tsx` 가 `react-markdown` + `remark-gfm` + `remark-breaks` 를 정적 import 한다(큰 청크). 이 컴포넌트를 쓰는 라우트(게시판/공지/QnA 상세)에서 **본문 아래에 있는 마크다운이 First Load를 부풀리지 않도록** 소비처에서 `next/dynamic` 으로 감싼다.

```tsx
import dynamic from "next/dynamic";
const Markdown = dynamic(() => import("@/components/Markdown").then(m => m.Markdown), {
  loading: () => <div className="animate-pulse ..." />,
});
```

- 먼저 **소비처를 grep** (`grep -rln "components/Markdown" src/`) 하고, 이미 dynamic이면 이 작업은 건너뛴다.
- `Markdown.tsx` 가 `'use client'` 인지 확인 후 `ssr` 옵션 결정. SEO 필요한 공지 본문이면 `ssr: true` 유지.

---

## 작업 4 — 랜딩 orb 페인트 비용 절감 (선택, P3)

`src/app/landing-preview/landing-preview.css` 의 orb 4개는 다층 `box-shadow`(외부+inset 2겹) + `.material` `backdrop-filter: blur(20px)`. **비주얼은 유지**하되 초기 페인트 비용만 낮춘다:

- inset 그림자 2겹 → 1겹으로 축소, 외부 그림자 blur 반경 소폭 축소.
- orb 진입 애니메이션을 `opacity`/`transform` 만으로(이미 대부분 그럼) — layout/paint 유발 속성 없는지 확인.
- `@media (prefers-reduced-motion: reduce)` 에서 orb 애니메이션 정지(전역 baseline이 이미 처리하는지 확인, 아니면 추가).

작업 1로 목표(RES 90+)에 도달하면 **생략 가능**. 먼저 1을 반영·측정하고 판단.

---

## 검증

각 작업 후 **프로덕션 빌드 기준**으로 측정. (dev 서버 수치는 무의미)

### 1. 번들에서 Supabase 제거 확인 (작업 1)
```bash
pnpm build
# 로그아웃 랜딩이 참조하는 청크에 supabase가 없어야 함
PORT=3999 pnpm start &
sleep 4
# 랜딩 First Load 스크립트 목록
curl -s http://localhost:3999/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u
# 각 청크에서 supabase 시그니처 검색 → 0 이어야 목표 달성
```

### 2. 첫 페인트 실측 (브라우저 콘솔에서)
```js
(() => {
  const p = performance.getEntriesByType('paint');
  const nav = performance.getEntriesByType('navigation')[0];
  return { ttfb: Math.round(nav.responseStart),
           fcp: Math.round(p.find(x=>x.name==='first-contentful-paint')?.startTime) };
})()
```
- **기준선(현재)**: fcp ≈ 2588ms (로컬)
- **작업 1 후 기대**: Supabase 806ms 실행 제거로 fcp 대폭 하락(로컬 < 1000ms 목표).

### 3. 회귀 없음
```bash
pnpm test          # vitest 통과
pnpm build         # 타입/빌드 통과
```
- 로그인 버튼 클릭 → Google OAuth 리다이렉트 정상.
- 아바타(멤버 셸·프로필) 이미지 정상 표시.

### 4. 배포 후 최종 확인
- Vercel Speed Insights에서 3~7일 후 `/`·`/profile` RES 재확인. 목표 **90+**.
- 필드 데이터는 지연 반영되므로, 배포 직후엔 위 로컬 fcp 하락으로 선행 판단.

---

## 실행 순서 요약

1. **작업 1** (Supabase 지연) → 빌드 → §검증 1·2 로 fcp 하락 확인 ← **여기서 대부분 해결될 것**
2. 부족하면 **작업 3** (Markdown 동적) → 재측정
3. 그래도 부족하면 **작업 2** (폰트 self-host) → 재측정
4. **작업 4** 는 90 미달 시에만
