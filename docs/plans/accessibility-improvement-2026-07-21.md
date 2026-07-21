# 접근성(a11y) 개선 기획 · 구현 계획서

- 작성일: 2026-07-21
- 대상: gdg-dju (Next.js 16 App Router / React 19 / Tailwind v4)
- 목표: WCAG 2.1 AA 기준 주요 결함 해소 — 특히 **키보드 단독 사용자**와 **스크린리더 사용자**가 모든 핵심 플로우(로그인·지원·출석·게시판·프로필·설문)를 완수할 수 있게 한다.
- 역할: 본 문서는 기획+지시서. 구현은 Codex에 위임(파일 경로·변경 전후·검증 기준 포함).

---

## 1. 배경 / 진단 방법

전역 primitive(`Button`/`Modal`/`Input`/`Select`/`Textarea`/`DatePicker`)와 공용 셸·네비·토글을 코드에서 직접 검토했다. 좋은 baseline도 확인됐다:

- `reduced-motion` / `reduced-transparency` / `prefers-contrast` 전역 대응 (`globals.css:75,84`)
- `<html lang="ko">`, `<main>` 랜드마크 존재 (`layout.tsx:46`, `ResponsiveShell.tsx:94`)
- 아이콘 전용 버튼 대부분 `aria-label` 있음 (`NotificationBell.tsx:54`, `ResponsiveShell.tsx:39,77`, `DatePicker` 월 이동)
- `Button` 은 `focus-visible` 아웃라인 보유 (`Button.tsx:34`)

하지만 아래 구조적 결함이 남아 있다. 특히 **커스텀 위젯(Select/DatePicker)의 키보드 접근 불가**와 **폼 에러의 스크린리더 미전달**은 실제 사용 차단 수준이다.

---

## 2. 실태 진단 (결함 목록)

| # | 심각도 | 결함 | 위치 | WCAG |
|---|--------|------|------|------|
| F1 | **높음** | 커스텀 `Select` 옵션이 마우스 `onClick` 만 지원 — 방향키/Enter/Esc/타이핑 선택 불가, 리스트박스에 포커스 이동 없음 | `components/Select.tsx:191–286` | 2.1.1, 4.1.2 |
| F2 | **높음** | 폼 에러가 `<p>` 로만 표시되고 컨트롤과 미연결(`aria-invalid`/`aria-describedby` 없음) → 스크린리더가 오류를 읽지 않음. 전 폼 공통 | `Input.tsx:31`, `Textarea.tsx:41`, `Select.tsx:288`, `DatePicker.tsx:243` | 3.3.1, 3.3.3, 4.1.3 |
| F3 | 중간 | Skip-to-content 링크 없음 → 키보드/SR 사용자가 매 페이지 사이드바 전체를 Tab 통과해야 함. `<main>` 에 id도 없음 | `ResponsiveShell.tsx:94`, `layout.tsx` | 2.4.1 |
| F4 | 중간 | `DatePicker` 캘린더: 방향키 로빙 없음, `role="dialog"`/그리드 시맨틱 없음, 날짜 버튼 접근명이 "15"뿐(월·년 컨텍스트 없음) | `components/DatePicker.tsx:177–228` | 2.1.1, 4.1.2 |
| F5 | 중간 | `ThemeToggle` 세그먼트 컨트롤: 활성 상태가 배경색으로만 표현, `aria-pressed`/라디오 그룹 시맨틱 없음 → 현재 테마 안 읽힘 | `ThemeToggle.tsx:16–29` | 4.1.2 |
| F6 | 중간 | `Modal`(`<dialog>`)에 접근명 없음 → SR이 "dialog"로만 안내. 포커스 트랩/Esc는 네이티브라 OK | `components/Modal.tsx:36` | 4.1.2, 2.4.6 |
| F7 | 낮음 | 드롭다운(`Select`/`NotificationBell`) 열 때 메뉴로 포커스 이동·방향키 로빙 없음. 네이티브 버튼이라 Tab 접근은 가능 | `Select.tsx`, `NotificationBell.tsx:79` | 2.1.1 |
| F8 | 낮음 | 사이드바 활성 항목에 `aria-current="page"` 없음(색으로만 구분). `CommunityTabs` 는 이미 적용됨(일관성 결여) | `SidebarNav.tsx:99`, `AdminSidebarNav.tsx` | 1.4.1, 4.1.2 |
| F9 | 낮음 | 링크/일부 인터랙션에 포커스 표시 baseline 없음 — 버튼만 `focus-visible` 처리. 전역 `:focus-visible` 폴백 부재 | `globals.css`, `SidebarNav.tsx:102` | 2.4.7 |
| F10 | 낮음 | 낙관적 갱신(알림 unread 카운트, 저장 상태)이 `aria-live` 없이 조용히 바뀜 | `NotificationBell.tsx:73`, `ProfileAvatar.tsx:61` | 4.1.3 |
| F11 | 예방 | ESLint 및 `eslint-plugin-jsx-a11y` 미설정(lint 스크립트·config 부재) → 회귀 방지 자동 가드 없음 | 저장소 루트 | — |

> 색 대비(1.4.3)는 별도 정밀 측정 대상. 본 계획 범위 밖(디자인 토큰 검토 필요)으로 두고, 팔레트 대비는 후속 이슈로 분리한다.

---

## 3. 개선 기획

### 원칙
1. **플랫폼 네이티브 우선**: 커스텀 위젯을 새로 접근성 무장하기보다, 가능하면 네이티브로 대체하거나 네이티브 패턴(APG)을 최소 구현. 코드가 줄고 회귀가 준다.
2. **primitive 한 곳 수정 = 전 화면 반영**: 에러 연결·포커스 baseline은 공용 컴포넌트/전역 CSS에서 한 번만 고친다(개별 폼 수정 금지).
3. **기능·데이터 계약 불변**: 마크업/속성만 추가. 폼 `name`·서버액션 시그니처·시각 디자인은 유지(리디자인 워크플로 원칙 준수).

### 우선순위 (임팩트 × 노력)
- **P0 (사용 차단 해소)**: F2(폼 에러 연결), F1(Select 키보드)
- **P1 (탐색·인지)**: F3(skip link), F5(ThemeToggle), F6(Modal 접근명), F8(aria-current)
- **P2 (완성도)**: F4(DatePicker), F7(드롭다운 로빙), F9(포커스 baseline), F10(live region)
- **P3 (예방)**: F11(jsx-a11y lint 게이트)

---

## 4. 구현 계획서 (Codex 실행용)

각 항목은 **파일 · 변경 · 검증**을 담는다. 시각 결과·`name`·서버 계약은 바꾸지 않는다.

### Phase 0 — P0: 사용 차단 해소

#### 4.1 폼 에러 프로그래매틱 연결 (F2)
공용 필드 컴포넌트에서 에러를 컨트롤과 연결한다.

- **`components/Input.tsx`**
  - `useId` 로 `errorId` 생성. `<input>` 에 `aria-invalid={error ? true : undefined}`, `aria-describedby={error ? errorId : undefined}` 추가.
  - 에러 `<p>` 에 `id={errorId}` 와 `role="alert"` 부여.
- **`components/Textarea.tsx`**: 위와 동일 패턴.
- **`components/Select.tsx`**: 트리거 `<button>`(`:191`)에 `aria-invalid`·`aria-describedby`, 에러 `<p>`(`:288`)에 `id`+`role="alert"`.
- **`components/DatePicker.tsx`**: 트리거 `<button>`(`:149`)에 동일, 에러 `<p>`(`:243`)에 `id`+`role="alert"`.
- 검증: 각 폼(`apply/ApplyForm`, `profile/ProfileForm`, `inquiries/InquiryForm`, `board/PostForm`)에서 잘못된 값 제출 → VoiceOver/NVDA 가 오류 메시지를 읽고, 컨트롤이 invalid로 노출되는지 확인. axe-core 0 violations(3.3.1 관련).

#### 4.2 커스텀 Select 키보드 지원 (F1)
`components/Select.tsx` 에 APG combobox/listbox 키보드 상호작용 최소 구현.

- 트리거 `<button>`: `role` 유지, `aria-controls={listboxId}` 추가, `aria-activedescendant` 로 하이라이트 옵션 참조.
- 상태: `activeIndex`(하이라이트). 키 핸들러 트리거에 부착:
  - 닫힘 상태 `Enter`/`Space`/`ArrowDown` → 열고 현재값/첫 옵션 하이라이트.
  - 열림 상태 `ArrowDown`/`ArrowUp` → `activeIndex` 이동(disabled 건너뜀), `Home`/`End` 처음/끝, `Enter`/`Space` 선택, `Esc` 닫기+트리거 포커스 유지, 문자 타이핑 → 해당 라벨 접두 매칭(typeahead, 선택).
- `<li role="option">` 에 `id`(=activedescendant 대상), `aria-selected` 유지. 마우스 `onClick` 은 그대로 둔다(호환).
- `<ul role="listbox">` 에 `aria-labelledby`(라벨 있을 때) 연결.
- 검증: 마우스 없이 Tab→포커스, 방향키로 이동, Enter 선택, Esc 닫힘. `apply`·`profile`·`admin/*` 폼의 Select에서 회귀 없음. 기존 portal 로직(모달 내 위치 보정)은 건드리지 않는다.

### Phase 1 — P1: 탐색·인지

#### 4.3 Skip link + main 타깃 (F3)
- **`ResponsiveShell.tsx`**: `<main>`(`:94`)에 `id="main-content"`, `tabIndex={-1}` 추가.
- 셸 최상단(모바일 헤더 앞)에 skip 링크 삽입:
  ```tsx
  <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
    본문으로 건너뛰기
  </a>
  ```
  (`sr-only` 유틸은 이미 사용 중 — 4.5절 확인.)
- 검증: 페이지 로드 후 첫 Tab 에 "본문으로 건너뛰기" 표시, Enter 시 `<main>` 로 포커스 이동.

#### 4.4 ThemeToggle 상태 노출 (F5)
- `ThemeToggle.tsx`: 컨테이너 `role="group"` + `aria-label="테마"`, 각 `<button>` 에 `aria-pressed={theme === option.key}`.
- 검증: SR이 활성 테마 버튼을 "선택됨"으로 안내.

#### 4.5 Modal 접근명 (F6)
- `components/Modal.tsx`: `ModalProps` 에 `ariaLabel?: string` 추가, `<dialog>` 에 `aria-label={ariaLabel}` 적용. 호출부에서 제목이 있는 모달은 제목 요소 `id` 를 쓰도록 `aria-labelledby` 도 옵션 허용(둘 중 하나 필수 아님, 있으면 부여).
- 사용처(모달 여는 화면)에서 최소 `ariaLabel` 지정.
- 검증: 모달 열 때 SR이 의미 있는 이름 안내.

#### 4.6 사이드바 aria-current (F8)
- `SidebarNav.tsx`(`:99`)·`AdminSidebarNav.tsx`: 활성 `<Link>` 에 `aria-current={active ? "page" : undefined}`(이미 계산된 `active` 재사용).
- 검증: SR이 현재 페이지 링크를 "현재 페이지"로 안내.

### Phase 2 — P2: 완성도

#### 4.7 DatePicker (F4)
가능하면 **네이티브 우선 검토**: 시간 없는 순수 날짜 필드는 `<input type="date">` 로 대체 가능한지 사용처 확인. 대체가 시각/UX상 부적합하면 아래 최소 무장:
- 팝오버 `<div>` 에 `role="dialog"` + `aria-label="날짜 선택"`, 열 때 그리드로 포커스 이동.
- 날짜 `<button>` 접근명 보강: `aria-label={\`${viewY}년 ${viewM}월 ${d}일\`}`, 선택 항목 `aria-pressed`/`aria-current="date"`.
- (선택) 방향키 로빙: 좌우 ±1일, 상하 ±7일, 월 경계에서 `move()`. 노력 대비 크면 P3로 미룸.
- 검증: 키보드로 월 이동·날짜 선택 가능, SR이 전체 날짜 읽음.

#### 4.8 드롭다운 포커스 관리 (F7)
- `Select`·`NotificationBell`: 열 때 첫 항목으로 포커스(또는 activedescendant), `Esc` 로 트리거 복귀. NotificationBell 은 `role="menu"` 유지 시 방향키 이동 추가.
- 검증: 키보드만으로 알림 열람·이동·닫기.

#### 4.9 전역 포커스 baseline (F9)
- `globals.css`: 링크·인터랙티브 요소용 `:focus-visible` 폴백 1블록 추가(예: `a:focus-visible, [role="button"]:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }`). `focus:outline-none` 을 명시한 커스텀 컨트롤은 자체 ring 유지되므로 영향 없음.
- 검증: Tab 순회 시 모든 포커스 지점에 가시 표시.

#### 4.10 라이브 리전 (F10)
- `NotificationBell`: unread 카운트/목록 영역에 상태 변화 알림용 `aria-live="polite"` 컨테이너(예: "N건 안 읽음") 또는 배지에 `role="status"`.
- `ProfileAvatar`: "저장 중"/완료 상태에 `role="status"` `aria-live="polite"`.
- 검증: 상태 변경 시 SR이 조용한 알림으로 안내.

### Phase 3 — P3: 회귀 방지 (F11)
- `eslint` + `eslint-config-next` + `eslint-plugin-jsx-a11y` 설치, `eslint.config.mjs`(flat config) 추가, `package.json` 에 `"lint": "next lint"` 또는 `"lint": "eslint ."` 스크립트.
- 최소 규칙: jsx-a11y `recommended`. 기존 위반은 1차로 `warn` 강등 후 점진 상향.
- 검증: `npm run lint` 통과(또는 알려진 warn만 남김), CI(있으면)에 편입.

---

## 5. 검증 / 완료 기준

Codex는 아래를 **모두** 통과한 뒤에만 완료 보고한다:

1. `npm run build` 성공, `npm test`(vitest) 통과 — 기존 테스트 회귀 없음.
2. 대표 플로우 **키보드 단독** 완주: 로그인 → 지원(`/apply`) → 프로필 편집(Select·DatePicker·아바타) → 게시글 작성(`/board`) → 출석. 마우스 없이 전부 완료 가능.
3. axe-core(또는 Lighthouse a11y) 로 대표 페이지(`/`, `/apply`, `/board`, `/profile`) 측정 — Phase 0·1 항목 관련 violation 0.
4. 시각 스냅샷/디자인 무변경 확인(속성만 추가, 레이아웃·색 불변).
5. 폼 `name`·서버액션 시그니처 불변(데이터 계약 보존).

## 6. 범위 밖(후속 이슈로 분리)
- 색 대비(WCAG 1.4.3) 정밀 측정 및 팔레트 조정.
- 캘린더 방향키 로빙(4.7의 선택 항목, 필요 시 별도).
- 콘텐츠 저작 가이드(이미지 대체텍스트 정책, 링크 문구).
