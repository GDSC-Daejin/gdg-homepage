# WDS 디자인 시스템 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GDG DJU 어드민의 애드혹 컴포넌트를 Wanted Design System(WDS) 토큰 위에 올린 일관된 공통 컴포넌트 라이브러리로 재구축한다 (다크모드 유지, 카탈로그 페이지 없음).

**Architecture:** WDS `--wds-*` CSS 변수를 단일 진실 원천으로 `:root`(light)/`.dark`(직접 설계)에 정의하고, Tailwind v4 `@theme inline` 으로 기존 유틸(`bg-primary`, `text-gray-*`)과 신규 시맨틱 유틸(`text-label-alternative`, `bg-fill-normal`)에 매핑한다. `globals.css` 한 파일 재작성으로 124개 소비 파일 대부분이 무수정으로 WDS 팔레트를 채택한다. 이후 핵심 프리미티브를 WDS API 로 재작성하고 호출부를 이전한 뒤, 신규 컴포넌트를 추가한다.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Tailwind v4 (`@theme inline`), Pretendard Variable, vitest.

## Global Constraints

- **폰트:** 교체 금지. 이미 설치된 Pretendard Variable 유지 (WDS Pretendard JP 대체).
- **다크모드:** 유지. `.dark` 클래스 토글 기반(`src/lib/theme.ts`). 모든 WDS 토큰은 `.dark` 오버라이드를 가진다.
- **토큰 소비:** Tailwind 유틸 클래스 + 기존 `cn()` 헬퍼(`src/lib/cn.ts`, 단순 join). 인라인 `style={{}}` 지양.
- **커밋 메시지:** `Co-Authored-By` 라인 금지 (커밋 훅이 거부함). 한국어 커밋 메시지.
- **검증 게이트:** 컴포넌트 단위 테스트 하네스(RTL)가 없으므로 각 태스크는 `npx next build`(타입체크+컴파일) 통과 + `npx vitest run` 유지 + preview 브라우저 육안 확인으로 검증한다. 프레젠테이션 컴포넌트에 className 문자열을 assert 하는 단위 테스트는 작성하지 않는다(저가치).
- **Next 16 주의:** AGENTS.md — Next 16 은 학습 데이터와 다를 수 있음. App Router 관련 불확실하면 `node_modules/next/dist/docs/` 확인.
- **레퍼런스:** WDS 토큰 원본 `/Users/jieunsse/Downloads/untitled/project/_ds/wanted-design-system-84e18722-9ad3-4b0d-ab35-974607dfdc9d/tokens/` (aliases.css, typography.css). 컴포넌트 시각 스펙 `공통 컴포넌트 라이브러리.dc.html`.

---

## File Structure

**Phase 1 — 토큰 기반**
- Modify: `src/app/globals.css` — WDS 토큰(`:root`+`.dark`) + `@theme inline` 매핑 + 타이포 램프. 유일한 토큰 소스.

**Phase 2 — 핵심 프리미티브 (WDS API) + 호출부 이전**
- Modify: `src/components/Button.tsx` — WDS variant/color/size 모델
- Modify: `src/components/Badge.tsx` → ContentBadge API
- Modify: `src/components/Input.tsx`, `Select.tsx`, `Card.tsx`, `StatCard.tsx`, `PageHeader.tsx`, `EmptyState.tsx`
- Modify: 호출부 (`Button`: ~30개 파일, `Badge`: ~25개 파일) — 새 API 로 기계적 이전

**Phase 3 — 신규 라이브러리 컴포넌트** (`src/components/` 신규 파일)
- `Divider.tsx`, `SectionHeader.tsx`, `TopBar.tsx`, `DataTable.tsx`, `ListCell.tsx`, `StatusBadge.tsx`, `Tag.tsx`, `Chip.tsx`, `Textarea.tsx`, `SearchBar.tsx`, `SegmentedControl.tsx`, `IconButton.tsx`, `Alert.tsx`, `Callout.tsx`, `Toast.tsx`

---

# PHASE 1 — 토큰 기반

## Task 1: `globals.css` WDS 토큰 재작성

**Files:**
- Modify: `src/app/globals.css` (전체 교체)

**Interfaces:**
- Produces: Tailwind 유틸 — 기존(`bg-primary`, `text-gray-{50..900}`, `bg-success/warning/danger`, `shadow-card`) + 신규(`text-label-{normal,neutral,alternative,assistive,disable}`, `bg-fill-{normal,strong,alternative}`, `border-line-{normal,neutral,alternative}`, `bg-bg`/`bg-bg-alt`/`bg-bg-elevated`, `text-accent-{red,orange,green,cyan,blue,violet,purple,pink}`, `bg-primary-bg`, `text-primary-strong`, `rounded-2xl`). 타이포 클래스 `.wds-{display1..caption2}` + `.wds-w-{regular,medium,semibold,bold}`.

- [ ] **Step 1: `globals.css` 전체를 아래 내용으로 교체**

```css
@import "tailwindcss";
@import "pretendard/dist/web/variable/pretendardvariable.css";

@custom-variant dark (&:where(.dark, .dark *));

/* ============================================================
   Wanted Design System tokens — single source of truth (light)
   ============================================================ */
:root {
  /* Brand / primary (Blue) */
  --wds-primary: rgb(0,102,255);
  --wds-primary-strong: rgb(0,94,235);
  --wds-primary-heavy: rgb(0,84,209);
  --wds-primary-bg: rgb(234,242,254);

  /* Labels (text) — grey ramp with alpha */
  --wds-label-normal: rgb(23,23,23);
  --wds-label-strong: rgb(0,0,0);
  --wds-label-neutral: rgba(46,47,51,0.88);
  --wds-label-alternative: rgba(55,56,60,0.61);
  --wds-label-assistive: rgba(55,56,60,0.28);
  --wds-label-disable: rgba(55,56,60,0.16);

  /* Backgrounds & surfaces */
  --wds-bg: rgb(255,255,255);
  --wds-bg-alt: rgb(247,247,248);
  --wds-bg-elevated: rgb(255,255,255);

  /* Fills (neutral translucent) */
  --wds-fill-normal: rgba(112,115,124,0.08);
  --wds-fill-strong: rgba(112,115,124,0.16);
  --wds-fill-alternative: rgba(112,115,124,0.05);

  /* Lines / borders */
  --wds-line-normal: rgba(112,115,124,0.22);
  --wds-line-neutral: rgba(112,115,124,0.16);
  --wds-line-alternative: rgba(112,115,124,0.08);

  /* Status */
  --wds-status-positive: rgb(0,191,64);
  --wds-status-cautionary: rgb(255,153,0);
  --wds-status-negative: rgb(255,66,66);
  --wds-status-positive-bg: rgb(233,249,238);
  --wds-status-negative-bg: rgb(254,235,235);
  --wds-status-cautionary-bg: rgb(255,244,229);

  /* Accent foregrounds */
  --wds-accent-red: rgb(255,66,66);
  --wds-accent-orange: rgb(255,153,0);
  --wds-accent-green: rgb(0,191,64);
  --wds-accent-cyan: rgb(0,152,178);
  --wds-accent-blue: rgb(0,94,235);
  --wds-accent-violet: rgb(101,65,242);
  --wds-accent-purple: rgb(151,71,255);
  --wds-accent-pink: rgb(255,71,133);

  /* Elevation / shadows */
  --wds-shadow-card: 0 1px 2px 0 rgba(23,23,23,0.06), 0 0 1px 0 rgba(23,23,23,0.07);
  --wds-shadow-emphasize: 0 1px 4px 0 rgba(0,0,0,0.08), 0 0 1px 0 rgba(0,0,0,0.12);
  --wds-shadow-strong: 0 2px 8px 0 rgba(0,0,0,0.12), 0 0 1px 0 rgba(0,0,0,0.12);
  --wds-shadow-heavy: 0 6px 12px 0 rgba(0,0,0,0.12), 0 0 1px 0 rgba(0,0,0,0.12);

  /* Type ramp: size / line-height / letter-spacing (WDS typography.css) */
  --title-display1-size: 56px;   --title-display1-line: 72px;  --title-display1-spacing: -0.0319em;
  --title-display2-size: 40px;   --title-display2-line: 52px;  --title-display2-spacing: -0.0282em;
  --title-display3-size: 36px;   --title-display3-line: 48px;  --title-display3-spacing: -0.027em;
  --title-title1-size: 32px;     --title-title1-line: 44px;    --title-title1-spacing: -0.0253em;
  --title-title2-size: 28px;     --title-title2-line: 38px;    --title-title2-spacing: -0.0236em;
  --title-title3-size: 24px;     --title-title3-line: 32px;    --title-title3-spacing: -0.023em;
  --heading-heading1-size: 22px; --heading-heading1-line: 30px; --heading-heading1-spacing: -0.0194em;
  --heading-heading2-size: 20px; --heading-heading2-line: 28px; --heading-heading2-spacing: -0.012em;
  --headline-headline1-size: 18px; --headline-headline1-line: 26px; --headline-headline1-spacing: -0.002em;
  --headline-headline2-size: 17px; --headline-headline2-line: 24px; --headline-headline2-spacing: 0em;
  --body-body1-size: 16px;  --body-body1-line: 24px;  --body-body1-spacing: 0.0057em;
  --body-body2-size: 15px;  --body-body2-line: 22px;  --body-body2-spacing: 0.0096em;
  --label-label1-size: 14px; --label-label1-line: 20px; --label-label1-spacing: 0.0145em;
  --label-label2-size: 13px; --label-label2-line: 18px; --label-label2-spacing: 0.0194em;
  --caption-caption1-size: 12px; --caption-caption1-line: 16px; --caption-caption1-spacing: 0.0252em;
  --caption-caption2-size: 11px; --caption-caption2-line: 14px; --caption-caption2-spacing: 0.0311em;
}

/* ============================================================
   Dark overrides — light alpha 계층을 어두운 표면 위 white-alpha 로 미러링
   (WDS 라이트 전용이라 직접 설계; 세부 alpha 는 육안 튜닝 여지)
   ============================================================ */
.dark {
  --wds-primary: rgb(51,133,255);
  --wds-primary-strong: rgb(90,160,255);
  --wds-primary-bg: rgba(51,133,255,0.18);

  --wds-label-normal: rgb(247,247,248);
  --wds-label-strong: rgb(255,255,255);
  --wds-label-neutral: rgba(247,247,248,0.88);
  --wds-label-alternative: rgba(247,247,248,0.61);
  --wds-label-assistive: rgba(247,247,248,0.34);
  --wds-label-disable: rgba(247,247,248,0.20);

  --wds-bg: rgb(23,24,26);
  --wds-bg-alt: rgb(27,28,30);
  --wds-bg-elevated: rgb(33,34,37);

  --wds-fill-normal: rgba(255,255,255,0.09);
  --wds-fill-strong: rgba(255,255,255,0.16);
  --wds-fill-alternative: rgba(255,255,255,0.05);

  --wds-line-normal: rgba(255,255,255,0.22);
  --wds-line-neutral: rgba(255,255,255,0.15);
  --wds-line-alternative: rgba(255,255,255,0.09);

  --wds-status-positive-bg: rgba(0,191,64,0.16);
  --wds-status-negative-bg: rgba(255,66,66,0.16);
  --wds-status-cautionary-bg: rgba(255,153,0,0.16);

  --wds-shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.24);
  color-scheme: dark;
}

/* ============================================================
   Tailwind theme — static keys (emit :root vars for .wds-* classes)
   ============================================================ */
@theme {
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, system-ui,
    "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
}

/* ============================================================
   Tailwind theme (inline) — map utilities onto WDS vars so .dark
   overrides propagate at runtime.
   ============================================================ */
@theme inline {
  /* Back-compat: existing utility names remapped to WDS */
  --color-primary: var(--wds-primary);
  --color-primary-bright: var(--wds-primary-strong);
  --color-primary-hover: var(--wds-primary-strong);
  --color-primary-soft: var(--wds-primary-bg);
  --color-primary-soft-hover: var(--wds-fill-strong);

  --color-gray-50: var(--wds-bg-alt);
  --color-gray-100: var(--wds-fill-normal);
  --color-gray-200: var(--wds-line-neutral);
  --color-gray-300: var(--wds-line-normal);
  --color-gray-400: var(--wds-label-assistive);
  --color-gray-500: var(--wds-label-alternative);
  --color-gray-600: var(--wds-label-neutral);
  --color-gray-700: var(--wds-label-neutral);
  --color-gray-800: var(--wds-label-normal);
  --color-gray-900: var(--wds-label-normal);

  --color-success: var(--wds-status-positive);
  --color-success-soft: var(--wds-status-positive-bg);
  --color-warning: var(--wds-status-cautionary);
  --color-warning-soft: var(--wds-status-cautionary-bg);
  --color-danger: var(--wds-status-negative);
  --color-danger-soft: var(--wds-status-negative-bg);

  /* WDS semantic utilities (new / upgraded components) */
  --color-label-normal: var(--wds-label-normal);
  --color-label-neutral: var(--wds-label-neutral);
  --color-label-alternative: var(--wds-label-alternative);
  --color-label-assistive: var(--wds-label-assistive);
  --color-label-disable: var(--wds-label-disable);

  --color-fill-normal: var(--wds-fill-normal);
  --color-fill-strong: var(--wds-fill-strong);
  --color-fill-alternative: var(--wds-fill-alternative);

  --color-line-normal: var(--wds-line-normal);
  --color-line-neutral: var(--wds-line-neutral);
  --color-line-alternative: var(--wds-line-alternative);

  --color-bg: var(--wds-bg);
  --color-bg-alt: var(--wds-bg-alt);
  --color-bg-elevated: var(--wds-bg-elevated);

  --color-primary-strong: var(--wds-primary-strong);
  --color-primary-heavy: var(--wds-primary-heavy);
  --color-primary-bg: var(--wds-primary-bg);

  --color-accent-red: var(--wds-accent-red);
  --color-accent-orange: var(--wds-accent-orange);
  --color-accent-green: var(--wds-accent-green);
  --color-accent-cyan: var(--wds-accent-cyan);
  --color-accent-blue: var(--wds-accent-blue);
  --color-accent-violet: var(--wds-accent-violet);
  --color-accent-purple: var(--wds-accent-purple);
  --color-accent-pink: var(--wds-accent-pink);

  --shadow-card: var(--wds-shadow-card);
}

/* ============================================================
   Typography ramp utility classes (pair with .wds-w-* weight)
   ============================================================ */
.wds-display1  { font-family: var(--font-sans); font-size: var(--title-display1-size); line-height: var(--title-display1-line); letter-spacing: var(--title-display1-spacing); }
.wds-display2  { font-family: var(--font-sans); font-size: var(--title-display2-size); line-height: var(--title-display2-line); letter-spacing: var(--title-display2-spacing); }
.wds-display3  { font-family: var(--font-sans); font-size: var(--title-display3-size); line-height: var(--title-display3-line); letter-spacing: var(--title-display3-spacing); }
.wds-title1    { font-family: var(--font-sans); font-size: var(--title-title1-size); line-height: var(--title-title1-line); letter-spacing: var(--title-title1-spacing); }
.wds-title2    { font-family: var(--font-sans); font-size: var(--title-title2-size); line-height: var(--title-title2-line); letter-spacing: var(--title-title2-spacing); }
.wds-title3    { font-family: var(--font-sans); font-size: var(--title-title3-size); line-height: var(--title-title3-line); letter-spacing: var(--title-title3-spacing); }
.wds-heading1  { font-family: var(--font-sans); font-size: var(--heading-heading1-size); line-height: var(--heading-heading1-line); letter-spacing: var(--heading-heading1-spacing); }
.wds-heading2  { font-family: var(--font-sans); font-size: var(--heading-heading2-size); line-height: var(--heading-heading2-line); letter-spacing: var(--heading-heading2-spacing); }
.wds-headline1 { font-family: var(--font-sans); font-size: var(--headline-headline1-size); line-height: var(--headline-headline1-line); letter-spacing: var(--headline-headline1-spacing); }
.wds-headline2 { font-family: var(--font-sans); font-size: var(--headline-headline2-size); line-height: var(--headline-headline2-line); letter-spacing: var(--headline-headline2-spacing); }
.wds-body1     { font-family: var(--font-sans); font-size: var(--body-body1-size); line-height: var(--body-body1-line); letter-spacing: var(--body-body1-spacing); }
.wds-body2     { font-family: var(--font-sans); font-size: var(--body-body2-size); line-height: var(--body-body2-line); letter-spacing: var(--body-body2-spacing); }
.wds-label1    { font-family: var(--font-sans); font-size: var(--label-label1-size); line-height: var(--label-label1-line); letter-spacing: var(--label-label1-spacing); }
.wds-label2    { font-family: var(--font-sans); font-size: var(--label-label2-size); line-height: var(--label-label2-line); letter-spacing: var(--label-label2-spacing); }
.wds-caption1  { font-family: var(--font-sans); font-size: var(--caption-caption1-size); line-height: var(--caption-caption1-line); letter-spacing: var(--caption-caption1-spacing); }
.wds-caption2  { font-family: var(--font-sans); font-size: var(--caption-caption2-size); line-height: var(--caption-caption2-line); letter-spacing: var(--caption-caption2-spacing); }

.wds-w-regular  { font-weight: 400; }
.wds-w-medium   { font-weight: 500; }
.wds-w-semibold { font-weight: 600; }
.wds-w-bold     { font-weight: 700; }

body {
  background: var(--wds-bg-alt);
  color: var(--wds-label-normal);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: 빌드로 컴파일/타입 검증**

Run: `npx next build`
Expected: 성공 (Tailwind 가 새 유틸을 인식, CSS 컴파일 에러 없음). 실패 시 `@theme inline` 문법·중복 키 확인.

- [ ] **Step 3: 기존 테스트 유지 확인**

Run: `npx vitest run`
Expected: 기존 스위트(format, schemas) PASS (globals 변경과 무관하므로 그대로 통과해야 함).

- [ ] **Step 4: preview 육안 확인 (라이트/다크)**

`.claude/launch.json` 에 dev 서버 구성이 없으면 생성 후 `preview_start`. 대표 화면 3개를 확인:
`/admin/budget`(또는 존재하는 첫 admin 화면), `/admin/members`, `/admin/points`.
- 라이트: 배경이 near-white(`#f7f7f8`), primary 가 WDS 블루(`#0066ff`), 텍스트/보더 정상.
- 다크: `.dark` 토글 시 배경 어둡고 텍스트 밝음, 카드/보더 대비 유지.
`preview_screenshot` 로 라이트/다크 각 1장 확보. 대비가 심하게 깨지면 `.dark` 의 label/fill alpha 를 튜닝(±0.05).

- [ ] **Step 5: 커밋**

```bash
git add src/app/globals.css
git commit -m "feat(ds): globals.css를 WDS 토큰 기반으로 재작성 (라이트+다크, Tailwind 매핑, 타이포 램프)"
```

---

# PHASE 2 — 핵심 프리미티브 (WDS API) + 호출부 이전

## Task 2: Button — WDS variant/color/size 모델

**Files:**
- Modify: `src/components/Button.tsx`

**Interfaces:**
- Produces: `Button` — `variant?: "solid" | "outlined" | "text"` (기본 `"solid"`), `color?: "primary" | "assistive" | "negative"` (기본 `"primary"`), `size?: "large" | "medium" | "small" | "tiny"` (기본 `"medium"`), `round?: boolean`, 그 외 `ButtonHTMLAttributes<HTMLButtonElement>`.
- Consumes: `cn` from `@/lib/cn`.

- [ ] **Step 1: `Button.tsx` 전체 교체**

```tsx
import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "solid" | "outlined" | "text";
type ButtonColor = "primary" | "assistive" | "negative";
type ButtonSize = "large" | "medium" | "small" | "tiny";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  round?: boolean;
}

// [variant][color] → Tailwind classes
const styles: Record<ButtonVariant, Record<ButtonColor, string>> = {
  solid: {
    primary: "bg-primary text-white hover:bg-primary-strong",
    assistive: "bg-fill-normal text-label-normal hover:bg-fill-strong",
    negative: "bg-danger text-white hover:opacity-90",
  },
  outlined: {
    primary: "border border-primary text-primary bg-transparent hover:bg-primary-bg",
    assistive: "border border-line-normal text-label-neutral bg-transparent hover:bg-fill-normal",
    negative: "border border-danger text-danger bg-transparent hover:bg-danger-soft",
  },
  text: {
    primary: "bg-transparent text-primary hover:bg-primary-bg",
    assistive: "bg-transparent text-label-neutral hover:bg-fill-normal",
    negative: "bg-transparent text-danger hover:bg-danger-soft",
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  large: "h-12 px-5 text-[16px]",
  medium: "h-10 px-4 text-[15px]",
  small: "h-[34px] px-3.5 text-[14px]",
  tiny: "h-7 px-3 text-[13px]",
};

export function Button({
  variant = "solid",
  color = "primary",
  size = "medium",
  round,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        round ? "rounded-full" : "rounded-lg",
        styles[variant][color],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: 빌드 → 호출부 타입 에러 목록 확인**

Run: `npx next build`
Expected: FAIL — 기존 호출부(`variant="primary|secondary|ghost|danger|danger-outline"`, `size="sm|md"`)가 새 타입과 불일치. 에러 목록을 이전 대상 파일 리스트로 사용.

- [ ] **Step 3: 호출부 이전 — 아래 매핑 규칙을 기계적으로 적용**

이전 대상 열거: `grep -rln '<Button' src --include='*.tsx'`

prop 매핑 (기존 → 신규):
- `variant="primary"` → 삭제 (기본값 solid/primary) 또는 명시 `variant="solid" color="primary"`. **간결히: prop 제거.**
- `variant="secondary"` → `variant="outlined" color="primary"`
- `variant="ghost"` → `variant="text" color="assistive"`
- `variant="danger"` → `color="negative"` (variant 기본 solid)
- `variant="danger-outline"` → `variant="outlined" color="negative"`
- `size="sm"` → `size="small"`
- `size="md"` → 삭제 (기본 medium)
- 그 외 prop(`type`, `disabled`, `onClick`, `className`, `children`)은 유지.

각 파일 수정 후 진행. 특히 확인 필요: `secondary` 가 강조 보조 버튼이면 `outlined`, 텍스트성이면 `text` — 문맥상 애매하면 `outlined color="primary"` 로 통일.

- [ ] **Step 4: 빌드 재확인**

Run: `npx next build`
Expected: PASS — 모든 Button 호출부 타입 통과.

- [ ] **Step 5: preview 확인**

`/admin/points`(solid/ghost/danger 혼재: `BadgeManager` 삭제 모달) 등에서 버튼 3종 variant 시각 확인. `preview_screenshot` 1장.

- [ ] **Step 6: 커밋**

```bash
git add src/components/Button.tsx src
git commit -m "feat(ds): Button을 WDS variant/color/size 모델로 재설계하고 호출부 이전"
```

---

## Task 3: Badge → ContentBadge API

**Files:**
- Modify: `src/components/Badge.tsx`

**Interfaces:**
- Produces: `Badge` — `color: "primary" | "neutral" | "green" | "orange" | "red" | "violet" | "cyan"`, `variant?: "solid" | "outlined"` (기본 `"solid"`), `size?: "small" | "medium"` (기본 `"medium"`), `children`, `className?`.
- Consumes: `cn`.

- [ ] **Step 1: `Badge.tsx` 전체 교체**

```tsx
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeColor = "primary" | "neutral" | "green" | "orange" | "red" | "violet" | "cyan";
type BadgeVariant = "solid" | "outlined";

interface BadgeProps {
  color: BadgeColor;
  variant?: BadgeVariant;
  size?: "small" | "medium";
  children: ReactNode;
  className?: string;
}

// solid: 반투명 배경 틴트 + accent 전경. outlined: 투명 배경 + accent 보더/전경.
const solid: Record<BadgeColor, string> = {
  primary: "bg-primary-bg text-primary",
  neutral: "bg-fill-normal text-label-neutral",
  green: "bg-[rgba(0,191,64,0.12)] text-accent-green",
  orange: "bg-[rgba(255,153,0,0.14)] text-accent-orange",
  red: "bg-[rgba(255,66,66,0.12)] text-accent-red",
  violet: "bg-[rgba(101,65,242,0.12)] text-accent-violet",
  cyan: "bg-[rgba(0,152,178,0.12)] text-accent-cyan",
};

const outlined: Record<BadgeColor, string> = {
  primary: "border border-primary/40 text-primary",
  neutral: "border border-line-normal text-label-neutral",
  green: "border border-[rgba(0,191,64,0.4)] text-accent-green",
  orange: "border border-[rgba(255,153,0,0.4)] text-accent-orange",
  red: "border border-[rgba(255,66,66,0.4)] text-accent-red",
  violet: "border border-[rgba(101,65,242,0.4)] text-accent-violet",
  cyan: "border border-[rgba(0,152,178,0.4)] text-accent-cyan",
};

export function Badge({ color, variant = "solid", size = "medium", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold whitespace-nowrap",
        size === "small" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-[12px]",
        variant === "solid" ? solid[color] : outlined[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: 빌드 → 호출부 에러 목록 확인**

Run: `npx next build`
Expected: FAIL — 기존 `tone`/`solid` prop 불일치.

- [ ] **Step 3: 호출부 이전 — 매핑 규칙 적용**

대상 열거: `grep -rln '<Badge' src --include='*.tsx'` (주의: `BadgeManager`, `BadgeCard`, `BadgeType` 은 무관 — `<Badge ` 정확히 매칭).

`tone` → `color` 매핑:
- `tone="primary"` → `color="primary"`
- `tone="success"` → `color="green"`
- `tone="warning"` → `color="orange"`
- `tone="danger"` → `color="red"`
- `tone="neutral"` → `color="neutral"`
- `solid` prop(있으면) → 제거 (기본 solid). outlined 원하는 곳 없으면 그대로.
- `STATUS_TONE`/`TYPE_TONES` 같은 매핑 객체가 있으면 그 객체의 값 타입을 `BadgeColor` 로 바꾸고 값들도 위 규칙으로 치환 (예: `success` → `green`). 해당 상수 위치: `grep -rn 'TONE\|TONES' src --include='*.tsx'`.

- [ ] **Step 4: 빌드 재확인**

Run: `npx next build`
Expected: PASS.

- [ ] **Step 5: preview 확인**

`/admin/members`(역할/상태 배지), `/admin/notices`(게시/미게시) 에서 배지 색 확인. `preview_screenshot` 1장.

- [ ] **Step 6: 커밋**

```bash
git add src/components/Badge.tsx src
git commit -m "feat(ds): Badge를 WDS ContentBadge API(color/variant)로 재설계하고 호출부 이전"
```

---

## Task 4: Field 계열 — Input / Select / Textarea + Card / StatCard / PageHeader / EmptyState

Field·표면 컴포넌트를 WDS 스펙(높이 46, radius 11, line/label 토큰)으로 업그레이드. API 변경 없음(스타일만) → 호출부 무수정.

**Files:**
- Modify: `src/components/Input.tsx`, `src/components/Select.tsx`, `src/components/Card.tsx`, `src/components/StatCard.tsx`, `src/components/PageHeader.tsx`, `src/components/EmptyState.tsx`
- Create: `src/components/Textarea.tsx`

**Interfaces:**
- Produces: `Textarea` — `label?: ReactNode`, `error?: string`, 그 외 `TextareaHTMLAttributes<HTMLTextAreaElement>`. StatCard `variant?: "neutral" | "accent" | "primary"` 추가(기존 `emphasis` 제거 → 호출부 확인).
- Consumes: `cn`, `Card`.

- [ ] **Step 1: `Input.tsx` — WDS Field 스타일로 교체**

```tsx
import { InputHTMLAttributes, ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "label"> {
  label?: ReactNode;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="wds-caption1 wds-w-semibold text-label-alternative">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-[46px] w-full rounded-[11px] border bg-bg-elevated px-[15px] text-[14px] font-medium text-label-normal placeholder:font-normal placeholder:text-label-assistive outline-none transition-colors disabled:opacity-60",
          error ? "border-danger focus:border-danger" : "border-line-normal focus:border-primary",
          className,
        )}
        {...props}
      />
      {error && <p className="wds-caption1 text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: `Textarea.tsx` 신규 생성**

```tsx
import { TextareaHTMLAttributes, ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "label"> {
  label?: ReactNode;
  error?: string;
}

export function Textarea({ label, error, id, className, ...props }: TextareaProps) {
  const generatedId = useId();
  const areaId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={areaId} className="wds-caption1 wds-w-semibold text-label-alternative">
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        className={cn(
          "min-h-24 w-full resize-y rounded-[11px] border bg-bg-elevated px-[15px] py-[13px] text-[14px] font-medium leading-relaxed text-label-normal placeholder:font-normal placeholder:text-label-assistive outline-none transition-colors disabled:opacity-60",
          error ? "border-danger focus:border-danger" : "border-line-normal focus:border-primary",
          className,
        )}
        {...props}
      />
      {error && <p className="wds-caption1 text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: `Select.tsx` — Field 스타일 정렬**

`Select.tsx` 를 읽고, 컨트롤의 트리거/필드 요소 클래스를 Input 과 동일 토큰으로 맞춘다(높이 46, `rounded-[11px]`, `border-line-normal`, focus `border-primary`, 텍스트 `text-label-normal`, placeholder `text-label-assistive`). 라벨은 `wds-caption1 wds-w-semibold text-label-alternative`. 내부 로직/드롭다운 구조는 유지, 색·치수 토큰만 교체. (커스텀 셀렉트이므로 파일 실제 구조에 맞춰 클래스 치환.)

- [ ] **Step 4: `Card.tsx` — WDS 표면**

```tsx
import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line-neutral bg-bg-elevated p-6 shadow-card",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 5: `StatCard.tsx` — variant 3종 (neutral/accent/primary)**

```tsx
import { ReactNode } from "react";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  variant?: "neutral" | "accent" | "primary";
}

export function StatCard({ label, value, hint, icon, variant = "neutral" }: StatCardProps) {
  if (variant === "primary") {
    return (
      <Card className="border-transparent bg-primary shadow-none">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-white/85">{icon}</span>}
          <p className="wds-label2 wds-w-semibold text-white/85">{label}</p>
        </div>
        <p className="mt-3 wds-title2 wds-w-bold tabular-nums text-white">{value}</p>
        {hint && <p className="mt-1 wds-caption1 text-white/70">{hint}</p>}
      </Card>
    );
  }
  const accent = variant === "accent";
  return (
    <Card>
      <div className="flex items-center gap-1.5">
        {icon && <span className={accent ? "text-accent-red" : "text-label-assistive"}>{icon}</span>}
        <p className={cn("wds-label2 wds-w-semibold", accent ? "text-accent-red" : "text-label-alternative")}>{label}</p>
      </div>
      <p className={cn("mt-3 wds-title2 wds-w-bold tabular-nums", accent ? "text-accent-red" : "text-label-normal")}>{value}</p>
      {hint && <p className="mt-1 wds-caption1 text-label-assistive">{hint}</p>}
    </Card>
  );
}
```

- [ ] **Step 6: StatCard 호출부 이전** — `emphasis` prop → `variant`.

대상: `grep -rln '<StatCard' src --include='*.tsx'`. 매핑: `emphasis`(또는 `emphasis={true}`) → `variant="primary"`. 나머지는 기본 `neutral`. 지출/부정 수치 카드가 있으면 `variant="accent"` 로(문맥 판단, 예: 총 지출).

- [ ] **Step 7: `PageHeader.tsx` — 타이포 토큰 정렬**

```tsx
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 pb-6">
      <div>
        <h1 className="wds-title3 wds-w-bold text-label-normal">{title}</h1>
        {description && <p className="mt-1 wds-body2 text-label-alternative">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 8: `EmptyState.tsx` — 토큰 정렬**

```tsx
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-line-neutral bg-bg-elevated py-16 text-center shadow-card">
      {icon && (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-fill-normal text-label-assistive">
          {icon}
        </div>
      )}
      <p className="wds-headline2 wds-w-bold text-label-normal">{title}</p>
      {description && <p className="wds-body2 text-label-alternative">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 9: 빌드 + 테스트 + preview**

Run: `npx next build && npx vitest run`
Expected: PASS (StatCard 호출부 이전 완료 시 타입 통과).
preview: 폼 화면(`/admin/notices/new` 또는 `EventForm`)과 통계 화면(`/admin/budget`)에서 인풋/텍스트영역/카드/스탯카드 확인. `preview_screenshot` 1장.

- [ ] **Step 10: 커밋**

```bash
git add src/components src
git commit -m "feat(ds): Field·표면 컴포넌트(Input/Select/Textarea/Card/StatCard/PageHeader/EmptyState) WDS 스타일 업그레이드"
```

---

# PHASE 3 — 신규 라이브러리 컴포넌트

> 각 태스크: 컴포넌트 생성 → `npx next build` 통과 → 최소 1곳 실제 화면에 연결(또는 애드혹 마크업 대체) → preview 확인 → 커밋. 연결처가 마땅치 않으면 커밋 메시지에 "(미연결)" 표기하고 다음 사용 시 채택.

## Task 5: Divider + SectionHeader + TopBar (레이아웃)

**Files:**
- Create: `src/components/Divider.tsx`, `src/components/SectionHeader.tsx`, `src/components/TopBar.tsx`

**Interfaces:**
- Produces: `Divider` (`variant?: "hairline" | "thick"`, `orientation?: "horizontal" | "vertical"`), `SectionHeader` (`title: string`, `count?: ReactNode`, `action?: ReactNode`), `TopBar` (`title: string`, `path?: string`, `context?: ReactNode`).

- [ ] **Step 1: `Divider.tsx`**

```tsx
import { cn } from "@/lib/cn";

interface DividerProps {
  variant?: "hairline" | "thick";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function Divider({ variant = "hairline", orientation = "horizontal", className }: DividerProps) {
  if (orientation === "vertical") {
    return <div className={cn("w-px self-stretch bg-line-neutral", className)} />;
  }
  return (
    <div
      className={cn(
        variant === "thick" ? "h-2 w-full rounded-full bg-fill-alternative" : "h-px w-full bg-line-neutral",
        className,
      )}
    />
  );
}
```

- [ ] **Step 2: `SectionHeader.tsx`**

```tsx
import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  count?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="wds-heading2 wds-w-bold text-label-normal">{title}</h2>
        {count != null && (
          <span className="wds-caption1 wds-w-medium rounded-full bg-fill-alternative px-2.5 py-1 text-label-assistive">
            {count}
          </span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 3: `TopBar.tsx`**

```tsx
import { ReactNode } from "react";

interface TopBarProps {
  title: string;
  path?: string;
  context?: ReactNode;
}

export function TopBar({ title, path, context }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-3">
        <span className="wds-headline2 wds-w-bold text-label-normal">{title}</span>
        {path && <span className="wds-label2 wds-w-medium text-label-assistive">{path}</span>}
      </div>
      {context && (
        <div className="flex items-center gap-2 rounded-lg border border-line-neutral bg-bg-elevated px-3 py-1.5 shadow-card">
          {context}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 빌드 + 커밋**

Run: `npx next build`  Expected: PASS.
```bash
git add src/components/Divider.tsx src/components/SectionHeader.tsx src/components/TopBar.tsx
git commit -m "feat(ds): 레이아웃 컴포넌트 추가 (Divider/SectionHeader/TopBar)"
```

---

## Task 6: StatusBadge + Tag + Chip (상태)

**Files:**
- Create: `src/components/StatusBadge.tsx`, `src/components/Tag.tsx`, `src/components/Chip.tsx`

**Interfaces:**
- Produces: `StatusBadge` (`tone: "positive" | "cautionary" | "negative"`, `label: string`), `Tag` (`variant?: "fill" | "outline"`, `onRemove?: () => void`, `children`), `Chip` (`active?: boolean`, `onClick?: () => void`, `children`).

- [ ] **Step 1: `StatusBadge.tsx`**

```tsx
type Tone = "positive" | "cautionary" | "negative";

const dot: Record<Tone, string> = {
  positive: "bg-accent-green",
  cautionary: "bg-accent-orange",
  negative: "bg-accent-red",
};

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 wds-label2 wds-w-medium text-label-neutral">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: `Tag.tsx`**

```tsx
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TagProps {
  variant?: "fill" | "outline";
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
}

export function Tag({ variant = "fill", onRemove, children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 wds-label2 wds-w-medium",
        variant === "fill" ? "bg-fill-normal text-label-neutral" : "border border-line-normal text-label-neutral",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-label-assistive hover:text-label-neutral" aria-label="제거">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 3: `Chip.tsx`**

```tsx
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-2 wds-label2 wds-w-semibold transition-colors",
        active
          ? "bg-primary text-white"
          : "border border-line-normal text-label-neutral hover:bg-fill-normal",
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: 빌드 + 커밋**

Run: `npx next build`  Expected: PASS.
```bash
git add src/components/StatusBadge.tsx src/components/Tag.tsx src/components/Chip.tsx
git commit -m "feat(ds): 상태 컴포넌트 추가 (StatusBadge/Tag/Chip)"
```

---

## Task 7: SearchBar + SegmentedControl + IconButton (입력·액션)

**Files:**
- Create: `src/components/SearchBar.tsx`, `src/components/SegmentedControl.tsx`, `src/components/IconButton.tsx`

**Interfaces:**
- Produces: `SearchBar` (`value: string`, `onChange: (v: string) => void`, `placeholder?: string`), `SegmentedControl` (`items: { key: string; label: string }[]`, `value: string`, `onChange: (key: string) => void`), `IconButton` (`variant?: "normal" | "outlined" | "background" | "danger"`, `size?: "sm" | "md"`, + `ButtonHTMLAttributes`, `children` = 아이콘).

- [ ] **Step 1: `SearchBar.tsx`**

```tsx
interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="flex h-[46px] items-center gap-2.5 rounded-[11px] border border-line-normal bg-bg-elevated px-[15px] focus-within:border-primary">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="shrink-0 text-label-assistive">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[14px] font-medium text-label-normal placeholder:font-normal placeholder:text-label-assistive outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: `SegmentedControl.tsx`**

```tsx
import { cn } from "@/lib/cn";

interface SegmentedControlProps {
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}

export function SegmentedControl({ items, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex gap-1 rounded-[10px] bg-fill-alternative p-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 wds-label2 wds-w-semibold transition-colors",
            value === it.key ? "bg-bg-elevated text-label-normal shadow-card" : "text-label-alternative hover:text-label-neutral",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `IconButton.tsx`**

```tsx
import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type IconVariant = "normal" | "outlined" | "background" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconVariant;
  size?: "sm" | "md";
  children: ReactNode;
}

const variants: Record<IconVariant, string> = {
  normal: "border-transparent text-label-neutral hover:bg-fill-normal",
  outlined: "border-line-neutral text-label-neutral hover:bg-fill-normal",
  background: "border-transparent bg-fill-normal text-label-neutral hover:bg-fill-strong",
  danger: "border-transparent text-label-neutral hover:border-danger hover:bg-danger-soft hover:text-danger",
};

export function IconButton({ variant = "normal", size = "md", className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-[9px] border transition-colors disabled:opacity-50",
        size === "sm" ? "h-8 w-8" : "h-[38px] w-[38px]",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: 빌드 + 커밋**

Run: `npx next build`  Expected: PASS.
```bash
git add src/components/SearchBar.tsx src/components/SegmentedControl.tsx src/components/IconButton.tsx
git commit -m "feat(ds): 입력·액션 컴포넌트 추가 (SearchBar/SegmentedControl/IconButton)"
```

---

## Task 8: ListCell + DataTable (데이터 표시)

**Files:**
- Create: `src/components/ListCell.tsx`, `src/components/DataTable.tsx`

**Interfaces:**
- Produces: `ListCell` (`avatar?: ReactNode`, `title: ReactNode`, `subtitle?: ReactNode`, `trailing?: ReactNode`). `DataTable<T>` (`columns: { key: string; header: ReactNode; align?: "left" | "right"; render: (row: T) => ReactNode }[]`, `rows: T[]`, `rowKey: (row: T) => string`).

- [ ] **Step 1: `ListCell.tsx`**

```tsx
import { ReactNode } from "react";

interface ListCellProps {
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}

export function ListCell({ avatar, title, subtitle, trailing }: ListCellProps) {
  return (
    <div className="flex items-center gap-3.5 px-[18px] py-[15px]">
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className="min-w-0 flex-1">
        <div className="wds-body2 wds-w-semibold text-label-normal">{title}</div>
        {subtitle && <div className="mt-0.5 wds-label2 text-label-alternative">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
```

- [ ] **Step 2: `DataTable.tsx`**

```tsx
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-neutral bg-bg-elevated">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-line-neutral bg-fill-alternative">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "wds-caption1 wds-w-semibold px-5 py-3 text-label-alternative",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line-alternative last:border-0 hover:bg-fill-alternative">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "wds-body2 px-5 py-3.5 text-label-neutral",
                      c.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 + 커밋**

Run: `npx next build`  Expected: PASS. (`PointLogTable`/`RegistrantsTable` 을 이 위로 재구성할지는 별도 판단 — 스코프 밖이면 유지.)
```bash
git add src/components/ListCell.tsx src/components/DataTable.tsx
git commit -m "feat(ds): 데이터 표시 컴포넌트 추가 (ListCell/DataTable)"
```

---

## Task 9: Alert + Callout + Toast (피드백)

**Files:**
- Create: `src/components/Alert.tsx`, `src/components/Callout.tsx`, `src/components/Toast.tsx`

**Interfaces:**
- Produces: `Alert` (`variant?: "info" | "positive" | "cautionary" | "negative"`, `children`). `Callout` (`title?: string`, `children`). `Toast` — 시각 컴포넌트 `ToastBar` (`message: string`, `actionLabel?: string`, `onAction?: () => void`) + 최소 훅 `useToast()` → `{ toast, show }` (단일 토스트, 3초 자동 소멸). `ToastProvider` 불필요하게 만들지 말 것 — 단일 컴포넌트 + 로컬 상태로 시작.

- [ ] **Step 1: `Alert.tsx`**

```tsx
import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AlertVariant = "info" | "positive" | "cautionary" | "negative";

const styles: Record<AlertVariant, string> = {
  info: "bg-fill-alternative text-label-neutral",
  positive: "bg-success-soft text-accent-green",
  cautionary: "bg-warning-soft text-accent-orange",
  negative: "bg-danger-soft text-accent-red",
};

export function Alert({ variant = "info", children }: { variant?: AlertVariant; children: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl px-3.5 py-3 wds-body2 wds-w-medium", styles[variant])}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `Callout.tsx`**

```tsx
import { ReactNode } from "react";

interface CalloutProps {
  title?: string;
  children: ReactNode;
}

export function Callout({ title, children }: CalloutProps) {
  return (
    <div className="rounded-xl bg-fill-alternative px-4 py-3.5">
      {title && <p className="wds-label1 wds-w-bold text-label-normal">{title}</p>}
      <p className="mt-1 wds-body2 text-label-alternative">{children}</p>
    </div>
  );
}
```

- [ ] **Step 3: `Toast.tsx` (시각 컴포넌트 + 최소 훅)**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";

export function ToastBar({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-4 rounded-xl bg-[rgb(27,28,30)] px-4 py-3 shadow-heavy">
      <span className="wds-body2 wds-w-medium text-[rgb(247,247,248)]">{message}</span>
      {actionLabel && (
        <button type="button" onClick={onAction} className="wds-label1 wds-w-semibold text-[rgb(51,133,255)]">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ponytail: 단일 토스트, 3초 자동 소멸. 큐/스택은 YAGNI — 필요 시 확장.
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast == null) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, show };
}
```

주의: `shadow-heavy` 유틸이 없으면 `Task 1` 의 `@theme inline` 에 `--shadow-heavy: var(--wds-shadow-heavy);` 를 추가하거나, 여기서는 인라인 대신 `shadow-[0_6px_12px_rgba(0,0,0,0.24)]` 사용. 구현 시 확인.

- [ ] **Step 4: 빌드 + 커밋**

Run: `npx next build`  Expected: PASS.
```bash
git add src/components/Alert.tsx src/components/Callout.tsx src/components/Toast.tsx
git commit -m "feat(ds): 피드백 컴포넌트 추가 (Alert/Callout/Toast)"
```

---

## Task 10: 전체 검증 스윕

- [ ] **Step 1: 최종 빌드 + 테스트**

Run: `npx next build && npx vitest run`
Expected: 둘 다 PASS.

- [ ] **Step 2: 라이트/다크 전 화면 육안 스윕**

preview 로 각 admin 섹션(events/members/notices/points/surveys/budget/inquiries/applications)과 member 화면을 라이트/다크로 훑어 팔레트 회귀(대비 부족, 잘못된 색) 확인. 발견 시 해당 컴포넌트 또는 `.dark` alpha 튜닝. `preview_screenshot` 로 대표 라이트/다크 2장 최종 확보.

- [ ] **Step 3: 최종 커밋 (튜닝 있었으면)**

```bash
git add -A
git commit -m "fix(ds): 다크모드 대비 및 팔레트 회귀 튜닝"
```

---

## Self-Review 결과 (작성자 확인 완료)

- **Spec 커버리지:** 토큰 3층(Task 1) · 다크 매핑(Task 1 `.dark`) · 타이포 램프(Task 1) · Button/Badge API+호출부 이전(Task 2·3) · Field/표면 업그레이드(Task 4) · 신규 12종(Task 5–9) · 카탈로그 페이지 없음(비목표 준수) — 모두 태스크로 매핑됨.
- **Placeholder:** 없음. `Select.tsx`(Task 4 Step 3)는 파일 실제 구조 의존이라 "동일 토큰으로 클래스 치환"으로 지시(코드 전량 대신 규칙) — 커스텀 셀렉트라 불가피, 토큰 목록은 명시.
- **타입 일관성:** Badge `color` 팔레트, Button `variant/color/size`, StatCard `variant`("neutral"|"accent"|"primary") 태스크 간 일치. StatCard 는 `emphasis` 제거 → 호출부 이전(Task 4 Step 6) 포함.
- **주의:** Tailwind v4 `@theme inline` 의 `.dark` 전파는 Task 1 Step 4 preview 에서 반드시 실측(문서와 다를 수 있는 v4 동작). shadow-heavy 유틸 부재 케이스 Task 9 에 명시.
