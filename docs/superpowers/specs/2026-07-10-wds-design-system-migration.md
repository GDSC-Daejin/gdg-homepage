# WDS 토큰 마이그레이션 + 공통 컴포넌트 라이브러리

**작성일:** 2026-07-10
**대상:** GDG DJU 어드민 (`src/`, Next 16 App Router · React 19 · Tailwind v4)
**레퍼런스:** Wanted Design System 카탈로그 (`공통 컴포넌트 라이브러리.dc.html`), WDS 토큰 (`_ds/wanted-design-system-.../tokens/`)

## 목표

프로젝트의 애드혹 컴포넌트를 Wanted Design System(WDS) 토큰 위에 올린 일관된 공통 컴포넌트
라이브러리로 재구축한다. WDS를 **단일 진실 원천**으로 삼되, 다크모드는 유지하고(WDS는 라이트
전용이므로 다크 토큰을 직접 설계), 레퍼런스 카탈로그의 6개 카테고리 ~18종 컴포넌트를 실제
React 컴포넌트로 제공한다.

## 확정된 결정

1. **토큰 전략:** WDS `--wds-*` 로 전면 마이그레이션 (기존 `--color-primary` / 자체 팔레트 폐기).
2. **다크모드:** 유지. WDS는 라이트 전용이라 `.dark` 오버라이드 토큰을 직접 설계한다.
3. **컴포넌트 API:** WDS 모델로 재설계하고 **호출부(52개 파일)까지 전부 새 API로 이전**한다.
4. **카탈로그/쇼케이스 페이지:** 만들지 않는다 (실제 화면에서 쓰이는 컴포넌트만).

## 비목표 (Non-goals)

- `/admin/design` 같은 살아있는 쇼케이스/스토리북 페이지 — 만들지 않음.
- 레퍼런스의 `.dc.html`/`x-import`/WDS 번들 자체를 프로젝트로 포팅 — 하지 않음 (시각·구조 스펙으로만 사용).
- 폰트 교체 — 이미 설치된 Pretendard Variable 유지 (WDS의 Pretendard JP 대체).

---

## 아키텍처 — 토큰 3층 구조

`globals.css` 한 파일 재작성으로 전체 앱이 WDS 팔레트를 채택한다. 현재 124개 파일이 전부
Tailwind 유틸 클래스(`bg-primary`, `text-gray-900`, `border-gray-200`, `shadow-card`)로
토큰을 소비하므로, 테마 레이어만 갈아끼우면 소비 파일 대부분은 무수정으로 색이 바뀐다.

```
:root          →  --wds-* 원본값 (light)              ← aliases.css 그대로 이식
.dark          →  --wds-* 오버라이드 (직접 설계)        ← 아래 다크 매핑 표
@theme inline  →  --color-* : var(--wds-*)             ← 기존 유틸 재사용 + 신규 시맨틱 유틸
```

`@theme inline` 을 쓰는 이유: 유틸이 빌드 상수가 아니라 `var(--wds-*)` 를 emit 하므로
`.dark` 의 `--wds-*` 오버라이드가 런타임에 자동 전파된다.

### Tailwind `@theme inline` 매핑

기존 유틸 이름을 WDS 값으로 remap (소비 파일 무수정):

| 기존 유틸 | 매핑 대상 |
|---|---|
| `--color-primary` | `var(--wds-primary)` |
| `--color-primary-hover` | `var(--wds-primary-strong)` |
| `--color-primary-soft` | `var(--wds-primary-bg)` |
| `--color-gray-900` | `var(--wds-label-normal)` |
| `--color-gray-700` | `var(--wds-label-neutral)` |
| `--color-gray-500` | `var(--wds-label-alternative)` |
| `--color-gray-400` | `var(--wds-label-assistive)` |
| `--color-gray-200` | `var(--wds-line-neutral)` 계열 |
| `--color-gray-100` | `var(--wds-fill-normal)` 계열 표면 |
| `--color-gray-50` | `var(--wds-bg-alt)` |
| `--color-success/warning/danger` | `var(--wds-status-positive/cautionary/negative)` |
| `--shadow-card` | `var(--wds-shadow-card)` |

신규 시맨틱 유틸 (새/업그레이드 컴포넌트가 직접 사용):
`--color-label-normal|neutral|alternative|assistive|disable`,
`--color-fill-normal|strong|alternative`,
`--color-line-normal|neutral|alternative`,
`--color-bg|bg-alt|bg-elevated`,
`--color-accent-red|orange|green|cyan|blue|violet|purple|pink`,
그리고 `--radius-*`, `--wds-space-*` 는 필요 범위만.

### 타이포 램프

WDS `typography.css` 의 `--*-size/line/spacing` 토큰 + `.wds-*` 유틸 클래스 + `.wds-w-*`
weight 클래스를 `globals.css` 에 이식. 컴포넌트는 `wds-title2 wds-w-bold` 형태로 사용.

### 다크모드 토큰 설계 (`.dark` 오버라이드)

WDS label/fill/line 은 "밝은 배경 위 alpha" 라 다크에서 그대로 쓰면 깨진다. 라이트의
alpha 계층 구조를 **어두운 표면 위 white-alpha** 로 뒤집어 미러링한다.

| 토큰 | Light | Dark |
|---|---|---|
| `--wds-bg` | `rgb(255,255,255)` | `rgb(23,24,26)` |
| `--wds-bg-alt` | `rgb(247,247,248)` | `rgb(27,28,30)` |
| `--wds-bg-elevated` | `rgb(255,255,255)` | `rgb(33,34,37)` |
| `--wds-label-normal` | `rgb(23,23,23)` | `rgb(247,247,248)` |
| `--wds-label-neutral` | `rgba(46,47,51,.88)` | `rgba(247,247,248,.88)` |
| `--wds-label-alternative` | `rgba(55,56,60,.61)` | `rgba(247,247,248,.61)` |
| `--wds-label-assistive` | `rgba(55,56,60,.28)` | `rgba(247,247,248,.34)` |
| `--wds-label-disable` | `rgba(55,56,60,.16)` | `rgba(247,247,248,.20)` |
| `--wds-fill-normal` | `rgba(112,115,124,.08)` | `rgba(255,255,255,.09)` |
| `--wds-fill-strong` | `rgba(112,115,124,.16)` | `rgba(255,255,255,.16)` |
| `--wds-fill-alternative` | `rgba(112,115,124,.05)` | `rgba(255,255,255,.05)` |
| `--wds-line-normal` | `rgba(112,115,124,.22)` | `rgba(255,255,255,.22)` |
| `--wds-line-neutral` | `rgba(112,115,124,.16)` | `rgba(255,255,255,.15)` |
| `--wds-line-alternative` | `rgba(112,115,124,.08)` | `rgba(255,255,255,.09)` |
| `--wds-primary` | `rgb(0,102,255)` | `rgb(51,133,255)` (inverse-primary) |
| `--wds-primary-bg` | `rgb(234,242,254)` | `rgba(51,133,255,.18)` |
| `--wds-status-*-bg` | 불투명 틴트 | 반투명 틴트 (`rgba(status, .16)`) |
| `--wds-shadow-card` | `…rgba(23,23,23,…)` | `…rgba(0,0,0,.4/.24)` |

status/accent 전경색(green/red/orange 등)은 다크에서도 채도 유지 → 원값 유지하거나
살짝 밝게. 세부 alpha 는 구현 중 다크 화면 육안 확인으로 튜닝(캘리브레이션 여지 남김).

---

## 컴포넌트 인벤토리

`src/components/` 에 위치. 소비는 Tailwind 유틸 + `cn()`(기존 단순 join 헬퍼) 유지.

### 재사용·업그레이드 (기존 → WDS)

- **Button** — API 재설계: `variant: "solid" | "outlined" | "text"`, `color: "primary" | "assistive" | "negative"`, `size: "large" | "medium" | "small" | "tiny"`, `round?: boolean`. 높이 48/40/34/28, radius 10(pill 시 999). 기존 `variant="primary|secondary|ghost|danger|danger-outline"` / `size sm|md` 호출부 전부 이전.
  - 이전 매핑 가이드: `primary→(solid,primary)`, `secondary→(outlined,primary)` 또는 `(text,primary)`(문맥 판단), `ghost→(text,assistive)`, `danger→(solid,negative)`, `danger-outline→(outlined,negative)`, `sm→small`, `md→medium`.
- **Badge → ContentBadge** — `color: primary|neutral|green|orange|red|violet|cyan` (accent 팔레트), `variant: "solid" | "outlined"`, `size?: "small" | "medium"`. 기존 `tone`/`solid` 호출부 이전.
- **Input / Select / DatePicker** — WDS Field 스타일: 높이 46, radius 11, `border --wds-line-normal`, focus `--wds-primary`, placeholder `--wds-label-assistive`. 라벨은 `caption1 semibold` `--wds-label-alternative`. error 는 `--wds-status-negative`.
- **Card** — 표면 `--wds-bg-elevated`, 보더 `--wds-line-neutral`, radius 16, `--wds-shadow-card`.
- **StatCard** — 아이콘+라벨+큰 수치. `variant: "neutral" | "accent" | "primary"` (primary 는 파란 배경 + 흰 텍스트). `font-variant-numeric: tabular-nums`.
- **PageHeader** — 제목 `title3 bold`, 설명 `body2 --wds-label-alternative`.
- **EmptyState** — 아이콘 원형 배지 `--wds-fill-normal`, 제목 `--wds-label-normal`, 설명 `--wds-label-alternative`.

### 신규

- **SectionHeader** — 제목(`heading2 bold`) + 건수 배지(pill, `--wds-fill-alternative`) + 우측 보조 슬롯(액션/집계).
- **Divider** — `variant: "hairline" | "thick"`, `orientation?`. hairline=1px `--wds-line-neutral`, thick=8px `--wds-fill-alternative` pill.
- **TopBar** — 화면 제목 + 경로 + 우측 운영 컨텍스트 배지.
- **DataTable** — 제네릭 헤더/행. `columns` + `rows` props, 셀 우측정렬 숫자, 행 hover, 배지 슬롯. 래퍼는 `overflow-x:auto`. (앱 전용 `RegistrantsTable` 은 이 위에 재구성 여부는 구현 시 판단 — 스코프 밖이면 유지.)
- **ListCell** — 리딩 아바타(원형/이니셜) · 제목/보조텍스트 · 트레일링 값.
- **StatusBadge** — 색 점 + 라벨. `tone: "positive" | "cautionary" | "negative"`.
- **Tag** — 키워드 태그. `variant: "fill" | "outline"`, `onRemove?`.
- **Chip** — 선택형 필터. `active`, `onClick`.
- **Textarea** — 여러 줄 입력. Field 스타일 공유.
- **SearchBar** — 좌측 검색 아이콘 + 입력. `value`, `onChange`, `placeholder`.
- **SegmentedControl** — 상호배타 필터. `items: {key,label}[]`, `value`, `onChange`.
- **IconButton** — 아이콘 전용. `variant: "normal" | "outlined" | "background" | "danger"`, `size?`.
- **Alert** — 인라인 알림. `variant: "info" | "positive" | "cautionary" | "negative"`.
- **Callout** — 배경 틴트 안내 박스. `title?`, children.
- **Toast** — 어두운 메시지 바 + 선택적 `actionLabel`. 최소 표시 컴포넌트 + 간단한 트리거 훅/컨텍스트(`useToast`). 상태 관리 최소화 — 큐/스택은 YAGNI, 단일 토스트로 시작.

---

## 단계 (각 단계 독립 검증 가능)

### Phase 1 — 토큰 기반
`globals.css` 재작성: WDS `--wds-*` (`:root` + `.dark`), `@theme inline` 매핑, 타이포 램프
이식. 폰트 유지.
**검증:** `next build` 통과 + 대표 화면 3개(예: `/admin/budget`, `/admin/members`, `/admin/points`)가
WDS 팔레트로 렌더되고 라이트/다크 모두 깨지지 않음(preview 도구 육안 확인).

### Phase 2 — 핵심 프리미티브 + 호출부 이전
Button, Badge→ContentBadge, Input/Select/DatePicker, Card, StatCard, PageHeader, EmptyState
를 WDS API 로 재작성하고 52개 파일 호출부를 새 API 로 이전.
**검증:** `next build` + 타입체크 통과, 위 3개 화면에서 버튼/배지/폼 시각·동작 확인.

### Phase 3 — 신규 라이브러리 컴포넌트
SectionHeader, Divider, TopBar, DataTable, ListCell, StatusBadge, Tag, Chip, Textarea,
SearchBar, SegmentedControl, IconButton, Alert, Callout, Toast (12+종).
각 컴포넌트는 최소 1개 실제 화면에 연결(또는 기존 애드혹 마크업을 대체)해 사용처를 확보.
**검증:** 연결된 화면에서 렌더·상호작용 확인, `next build` 통과.

## 리스크 / 유의

- **다크 토큰은 레퍼런스에 스펙이 없음** → Phase 1에서 육안 튜닝 필요(캘리브레이션 여지).
- **호출부 대량 diff (Phase 2)** → Button/Badge 이전 매핑 가이드를 기계적으로 적용, 문맥상
  애매한 `secondary`(outlined vs text)는 화면별로 확인.
- **AGENTS.md 경고**: Next 16 은 학습 데이터와 다를 수 있음 → 코드 작성 전 `node_modules/next/dist/docs/` 관련 가이드 확인.
