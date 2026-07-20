# 구현계획서 — 인앱 알림 센터 (프론트엔드/UI 트랙)

> 대상 실행자: Codex. 승인된 설계 `docs/superpowers/specs/2026-07-19-notification-center-design.md`를 따른다.
> **이 트랙은 소비자 UI만 담당.** DB 마이그레이션(`0025_notifications.sql`)·RPC 수정·`notifications` 테이블 생성·`src/lib/types.ts`의 `Notification` 타입 추가는 **백엔드 트랙(다른 에이전트)** 소관이다. 여기서는 그 산출물(테이블·타입)이 **이미 존재한다고 가정**하고 참조만 한다.

---

## 0. 사전 사실 (읽고 확인한 코드)

- **`MemberShell`은 서버 컴포넌트다** (`src/app/(member)/MemberShell.tsx` 1행에 `"use client"` 없음). → 서버에서 직접 Supabase 조회 가능. 좋다.
- `MemberShell`은 두 곳에서 렌더된다:
  - `src/app/(member)/layout.tsx:15` — 대부분의 member 라우트
  - `src/app/page.tsx:22` — 홈(`/`)
  두 곳 모두 서버 컴포넌트이고 `profile: Profile`을 이미 갖고 있다. **`MemberShell` 안에서 한 번만 조회하면 모든 member 페이지가 커버된다.**
- **"헤더 벨"의 실제 위치는 상단 헤더가 아니라 사이드바 푸터다.** 현재 `MemberShell.tsx:48-66`에 `disabled`된 placeholder 벨 버튼(`aria-label="알림"`, ponytail 주석)이 프로필/로그아웃 버튼과 한 줄(`div.flex.items-center.gap-2`)에 놓여 있다. **이 placeholder를 `<NotificationBell/>`로 교체**한다. (spec의 "헤더"는 이 셸 상단 영역을 가리키는 관용 표현으로 해석. 레이아웃을 옮기지 말 것 — 데이터 계약·기능 보존 원칙.)
- `sidebar` prop 내용은 `ResponsiveShell`(클라이언트 컴포넌트)의 `<aside>` 안에 렌더된다. 서버 컴포넌트인 `NotificationBell` 서버 래퍼가 클라이언트 트리 안에 children으로 들어가는 구조 — Next.js App Router에서 정상 동작(서버 컴포넌트가 클라이언트 컴포넌트의 자식으로 전달됨).
- **`useDismiss`(`src/lib/useDismiss.ts`)는 바깥 클릭 + Escape로 닫히는 팝오버 훅.** `{ ref, open, setOpen }` 반환. `Select.tsx:88`에서 이미 이 패턴으로 드롭다운을 만든다 → 그대로 재사용.
- **⚠️ `src/lib/format.ts`에 상대시간(“3분 전”) 헬퍼가 없다.** `formatKst`(절대), `formatKstDate`, `monthKst`만 있음. spec의 드롭다운 항목은 "상대시간" 요구. → **§F에서 `format.ts`에 `formatRelativeKst` 소형 헬퍼를 추가**한다(재발명 금지 원칙에 따라 기존 파일에 최소 추가).
- `ActionResult = { error?: string; warning?: string }` (`src/lib/types.ts:82`).
- write 액션 규약(`src/actions/notice.ts`): `"use server"` → auth(`requireAdmin`/`requireProfile`) → `if (await isDemoMode()) return {}` → `createClient()` → 쿼리 → `if (error) return { error: toKoreanError(error) }` → `revalidatePath(...)` → `return {}`.
- demo 모드 규약: **member 페이지는 대부분 demo 분기를 안 한다**(실 Supabase의 데모 세션 데이터를 그대로 읽음). 하지만 `admin/page.tsx:9,49`처럼 seeded 데이터가 없는 곳은 `isDemoMode()`로 분기해 `DEMO_*` 상수를 쓴다. `notifications`는 데모 시드가 없으므로 **벨 데이터 조회는 `isDemoMode()`로 분기**한다.
- 스타일 토큰(`src/app/globals.css`): `--shadow-card`, `.material`(블러 배경), `.select-menu`(트리거 상단 원점 scale+fade 등장 애니메이션 클래스), `--duration-fast/base`, `--ease-out-quart`, `z-50`. `Badge` 컴포넌트(`src/components/Badge.tsx`) tone=`danger`/`primary`, `solid` 지원.

---

## A. 데이터 페칭 (서버 사이드)

**위치**: `MemberShell.tsx`를 `async` 서버 컴포넌트로 만들고(현재 동기 함수 → `export async function MemberShell`), 내부에서 조회 후 결과를 클라이언트 `<NotificationBell>`에 props로 넘긴다.

**N = 10** (최근 10개면 드롭다운에 충분, spec "최근 알림 N개").

**실제 조회 (demo 아닐 때)** — `HomeDashboard.tsx:129-152`의 `supabase.from(...).select(...)` 패턴을 그대로 미러:

```ts
// MemberShell.tsx 상단
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTIFICATIONS } from "@/lib/demoData";
import type { Notification } from "@/lib/types";

// MemberShell 본문 (async)
let notifications: Notification[] = [];
let unreadCount = 0;

if (await isDemoMode()) {
  notifications = DEMO_NOTIFICATIONS;                       // 정적 예시 (§D)
  unreadCount = DEMO_NOTIFICATIONS.filter((n) => !n.read_at).length;
} else {
  const supabase = await createClient();
  const [{ data: rows }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", profile.id)
      .is("read_at", null),
  ]);
  notifications = (rows ?? []) as Notification[];
  unreadCount = count ?? 0;
}
```

- `recipient_id = profile.id` 필터는 RLS(`recipient_id = auth.uid()`)와 중복이지만 명시성·안전을 위해 유지(기존 코드도 `.eq("user_id", ...)`를 명시).
- 안 읽음 카운트는 **별도 `head:true` count 쿼리**로 정확히 구한다(최근 10개 밖에 안 읽음이 더 있을 수 있으므로 목록 길이로 세면 안 됨). spec "안 읽음 카운트 = `read_at is null` 개수".
- `read_at is null`은 supabase-js에서 `.is("read_at", null)`.

**Demo 모드**: 위 분기대로 `DEMO_NOTIFICATIONS`(§D)를 그대로 사용. write no-op은 §C에서 처리.

---

## B. `NotificationBell` 컴포넌트

### 서버/클라이언트 분리 — **권장: 조회는 `MemberShell`(서버)에서, 드롭다운은 클라이언트 `NotificationBell` 단일 파일**

근거:
- `MemberShell`이 이미 서버 컴포넌트이고 `profile.id`를 갖고 있으므로 **별도 서버 래퍼 컴포넌트는 불필요**하다(YAGNI). 조회는 셸 본문에서 하고 데이터를 props로 내린다.
- 드롭다운 열기/닫기·mark-read 상호작용은 상태·이벤트 핸들러·`useDismiss`가 필요 → **클라이언트 컴포넌트**여야 한다.

→ 신규 파일 **`src/app/(member)/NotificationBell.tsx`** (`"use client"`), props로 초기 데이터 수신.

### Props
```ts
interface NotificationBellProps {
  notifications: Notification[];  // 최근 10개, created_at desc
  unreadCount: number;
}
```

### 구조 / 상태
- 최상위 `<div ref={ref} className="relative">` — `useDismiss<HTMLDivElement>()`로 바깥클릭/Esc 닫기.
- **트리거 버튼**: 현재 placeholder 버튼(`MemberShell.tsx:48-66`)의 마크업·SVG(벨 아이콘)·크기(`h-8 w-8`)를 그대로 가져오되 `disabled` 제거, `onClick={() => setOpen(o => !o)}`, `aria-haspopup="menu"`, `aria-expanded={open}` 추가.
  - **안 읽음 배지**: `unreadCount > 0`일 때 벨 우상단에 절대배치 배지. `<span className="absolute -right-0.5 -top-0.5 ...">`. 숫자는 `unreadCount > 9 ? "9+" : unreadCount`. 색: `bg-danger text-white` (또는 `<Badge tone="danger" solid>`; 작은 원형은 커스텀 span이 더 적합). `aria-label`에 개수 포함(`` `알림 ${unreadCount}건 안 읽음` ``).
- **드롭다운 패널** (`open &&`): `Select.tsx`의 인라인 absolute 메뉴 + `.select-menu` 애니메이션 클래스를 참고.
  - 컨테이너: `className="select-menu absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white dark:bg-gray-100 p-1 shadow-card"` — 사이드바 푸터에서 위로 뜨는 경우가 있으니 `bottom-full mb-2` 등 방향은 구현 시 확인(사이드바 하단이라 **위로 열리는 게 맞음**: `bottom-full right-0 mb-2`). ⚠️ **flag**: 사이드바 푸터(`mt-auto`) 위치라 아래로 열면 뷰포트를 벗어난다 → 위로 열도록 `bottom-full`.
  - **헤더 행**: "알림" 제목 + `unreadCount > 0`일 때 "모두 읽음" 버튼(우측). 버튼 클릭 → `handleMarkAll()`.
  - **목록**: `notifications.map(...)` — 각 항목:
    - `<Link href={n.link ?? "#"}>` 또는 `n.link` 없으면 `<button>`. 클릭 시: (1) 낙관적으로 해당 항목 `read_at` 로컬 표시 + `unreadCount` 감소, (2) `markNotificationsRead([n.id])` 호출, (3) `link` 있으면 `router.push(n.link)` + `setOpen(false)`.
    - 표시: `title`(진하게), `body`(있으면 `text-gray-500 text-sm`, 1-2줄 `line-clamp`), 우측 하단 `formatRelativeKst(n.created_at)`(`text-xs text-gray-400`).
    - 안 읽음 표시: `!n.read_at`이면 좌측에 작은 점(`bg-primary`) 또는 행 배경 `bg-primary-soft/40`. 읽음이면 무강조.
    - 항목 컨테이너: `flex gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-100`.
  - **빈 상태** (`notifications.length === 0`): 중앙 정렬 안내. `<p className="px-3 py-8 text-center text-sm text-gray-400">받은 알림이 없어요</p>` (별도 `EmptyState` 컴포넌트는 이 좁은 폭엔 과함).

### 로컬 상태 & 재동기화
- `const [items, setItems] = useState(notifications)` + `const [unread, setUnread] = useState(unreadCount)` — props 변경 시 동기화 위해 `key`로 리마운트하거나 `useEffect`로 props→state 반영. **간단히**: props가 서버 리프레시로 바뀌므로, mark-read 후 `router.refresh()`(`next/navigation`)를 호출해 서버 데이터를 다시 받고, 로컬 낙관 상태는 refresh가 덮어쓰게 둔다.
  - 권장 흐름: 클릭 → 낙관적 `setItems`/`setUnread` → `await markNotificationsRead([id])` → `router.refresh()`. (revalidate와 이중이지만 `force-dynamic`이라 refresh가 확실.)
- `useDismiss`가 `open`/`setOpen` 관리.

### 배치 편집 (MemberShell.tsx)
`MemberShell.tsx:47-66`의 placeholder `<button>...</button>` 전체(주석 포함)를 아래로 교체:
```tsx
<NotificationBell notifications={notifications} unreadCount={unreadCount} />
```
프로필 div(`flex items-center gap-2`)와 로그아웃 `<form>` 사이의 **같은 위치**에 둔다(레이아웃 유지). import 추가: `import { NotificationBell } from "./NotificationBell";`.

---

## C. 읽음 처리 액션 — `src/actions/notification.ts` (신규)

`notice.ts` 규약을 그대로 따른다. **auth는 `requireProfile`**(멤버 액션, admin 아님).

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

export async function markNotificationsRead(ids: string[]): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode()) return {};          // demo write no-op (성공 형태)
  if (ids.length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("recipient_id", profile.id)           // RLS 이중 방어
    .is("read_at", null);                     // 이미 읽은 건 건드리지 않음(멱등)

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/", "layout");              // 셸(모든 member 페이지) 재검증
  return {};
}

export async function markAllRead(): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/", "layout");
  return {};
}
```

- **RLS**: spec의 UPDATE 정책(`recipient_id = auth.uid()`)이 이 두 액션을 허용한다. `.eq("recipient_id", profile.id)`는 명시적 안전장치.
- `.is("read_at", null)` 조건으로 멱등(재클릭·중복 호출 무해).
- `revalidatePath("/", "layout")` — 벨이 루트 레이아웃 셸에 있으므로 layout 스코프 재검증. (클라이언트는 추가로 `router.refresh()` 호출 — B 참조. 둘 중 하나만으로도 되지만 낙관적 UI + refresh 조합을 권장.)
- `toKoreanError`는 `@/lib/errors`에 존재(notice.ts:8에서 import). 확인만.

---

## D. 타입 & 데모

### 타입 — 재정의 금지
`Notification` 타입은 **백엔드 트랙이 `src/lib/types.ts`에 추가**한다. 이 트랙은 `import type { Notification } from "@/lib/types"`로 참조만 한다. 의존하는 필드(spec §데이터 모델과 일치):
- `id: string`
- `type: "registration_promoted" | "inquiry_answered" | "badge_awarded"`
- `title: string`
- `body: string | null`
- `link: string | null`
- `read_at: string | null`
- `created_at: string`

> ⚠️ **순서 의존성**: 이 트랙 코드가 컴파일되려면 `Notification` 타입이 먼저 존재해야 한다. 백엔드 트랙과 병행 시, 타입이 아직 없으면 `NotificationBell.tsx` 상단에 임시 로컬 타입을 두지 말고, **types.ts에 타입 추가가 선행됐는지 확인**하고 시작할 것. (백엔드 트랙 미완이면 이 한 줄 타입만 먼저 머지 요청.)

### 데모 알림 — `src/lib/demoData.ts`에 추가
파일 끝에 상수 추가(타입 3종 각 1개, 총 2~3개; 안 읽음 2개 포함해 배지·상호작용 시연). `created_at`은 파일 내 다른 데모 데이터의 2026년 타임라인과 일관되게, "최근" 느낌으로.

```ts
import type { /* 기존들 */, Notification } from "@/lib/types";

export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "demo-nt1",
    type: "registration_promoted",
    title: "‘8월 모각코’ 참가가 확정됐어요",
    body: "대기자에서 참가 확정으로 승급되었습니다.",
    link: "/events/demo-e1",
    read_at: null,
    created_at: "2026-07-18T02:00:00.000Z",
  },
  {
    id: "demo-nt2",
    type: "inquiry_answered",
    title: "문의에 답변이 등록됐어요",
    body: "‘포인트는 어떻게 적립되나요?’ 문의에 답변이 달렸어요.",
    link: "/inquiries",
    read_at: null,
    created_at: "2026-07-17T05:30:00.000Z",
  },
  {
    id: "demo-nt3",
    type: "badge_awarded",
    title: "‘발표왕’ 배지를 받았어요",
    body: "스터디 발표 3회 이상 달성으로 배지가 수여되었습니다.",
    link: "/profile",
    read_at: "2026-07-15T00:00:00.000Z",   // 읽음 예시
    created_at: "2026-07-15T00:00:00.000Z",
  },
];
```

- `link`는 기존 데모 엔티티(`demo-e1`, `/inquiries`, `/profile`)를 가리켜 클릭 시 자연스럽게 이동.
- demo write no-op이므로 데모에서 "모두 읽음"/항목 클릭은 서버 상태를 안 바꾼다 → 낙관적 로컬 상태로 UI만 반응(정상). `router.refresh()`는 다시 원래 `DEMO_NOTIFICATIONS`를 받아오므로, 데모에선 새로고침 시 되돌아온다(허용되는 데모 동작).

---

## E. 상대시간 헬퍼 (§A/B가 의존) — `src/lib/format.ts`에 소형 추가

`format.ts`에 상대시간 함수가 없으므로 최소 추가(기존 스타일·KST 관용 유지). 24h 이내는 "N분/시간 전", 그 이상은 기존 `formatKstDate` 재사용.

```ts
/** "방금 전 / N분 전 / N시간 전 / (그 이상) YYYY. M. D." — 알림 상대시간용 */
export function formatRelativeKst(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return formatKstDate(iso);
}
```
- ⚠️ **flag**: `Date.now()`는 서버 렌더 시점 기준 → 초기 HTML은 서버 시간, 이후 hydration에서 다시 계산될 수 있으나 값이 크게 안 튀므로 무해. 정밀 실시간 갱신은 스코프 밖(폴링/페이지 로드 read로 충분 — spec).

---

## F. 단계별 실행 순서 (체크 가능)

이 저장소는 **dev 서버로 프리뷰**한다(`.claude/launch.json` 또는 `npm run dev`). 각 단계 후 브라우저에서 육안 확인.

1. **(선행 확인) `Notification` 타입 존재 확인.** `grep "Notification" src/lib/types.ts`. 없으면 백엔드 트랙에 타입 선반영 요청(§D 필드). → 검증: 타입 import가 컴파일됨.
2. **`format.ts`에 `formatRelativeKst` 추가** (§E). → 검증: `npx tsc --noEmit` 통과.
3. **`demoData.ts`에 `DEMO_NOTIFICATIONS` 추가** (§D). → 검증: tsc 통과, `Notification[]` 타입 일치.
4. **`src/actions/notification.ts` 작성** (§C). → 검증: tsc 통과, `notice.ts`와 시그니처·반환형(`ActionResult`) 일치.
5. **`src/app/(member)/NotificationBell.tsx` 작성** (§B, `"use client"`). → 검증: tsc 통과.
6. **`MemberShell.tsx` 수정**: `async`화 + §A 조회 로직 + placeholder 버튼을 `<NotificationBell/>`로 교체 + import 추가 (§A/B). → 검증: tsc + 빌드 성공.
7. **dev 서버 기동 후 육안 검증** (실계정 또는 demo 쿠키 `demo_mode=1`):
   - a. **벨 렌더 + 안 읽음 배지**: 벨 아이콘 우상단에 안 읽음 수 배지 노출(demo면 2). → OK.
   - b. **드롭다운 열림**: 벨 클릭 → 위쪽으로 패널 등장(`.select-menu` 애니메이션), 항목 3개(제목/본문/상대시간), 안 읽음 강조. → OK.
   - c. **바깥 클릭/Esc 닫힘**: 패널 밖 클릭·Esc → 닫힘(`useDismiss`). → OK.
   - d. **항목 클릭 → 이동 + 읽음**: 항목 클릭 → `link`로 이동하고 배지 수 감소, 재방문 시 그 항목 무강조. → OK.
   - e. **모두 읽음**: "모두 읽음" 클릭 → 배지 사라짐(0), 버튼 숨김. → OK.
   - f. **빈 상태**: 알림 0개 계정에서 "받은 알림이 없어요" 노출. → OK.
   - g. **다크모드**: 테마 토글 시 패널 대비/배경 정상(`dark:bg-gray-100`, `shadow-card`). → OK.
   - h. **모바일**: 사이드바 드로어(햄버거)로 열었을 때 벨·드롭다운이 뷰포트 안에 들어옴. → OK.
8. **회귀 확인**: 기존 member 페이지(홈·공지·출석) 정상 렌더(`MemberShell` async화가 SSR을 깨지 않았는지). → 검증: 각 라우트 200 + 렌더.

---

## G. 파일 영향 요약 (이 트랙)

**신규**
- `src/app/(member)/NotificationBell.tsx` — 클라이언트 벨 + 드롭다운
- `src/actions/notification.ts` — `markNotificationsRead` / `markAllRead`

**수정**
- `src/app/(member)/MemberShell.tsx` — `async`화, 알림 조회(demo 분기), placeholder(48-66행) → `<NotificationBell/>`
- `src/lib/format.ts` — `formatRelativeKst` 추가
- `src/lib/demoData.ts` — `DEMO_NOTIFICATIONS` 추가

**의존(타 트랙 선행)**
- `src/lib/types.ts`의 `Notification` 타입, `notifications` 테이블 + RLS(SELECT/UPDATE own) — 백엔드 트랙.

---

## H. 리스크 / 블로커 (flag)

1. **`Notification` 타입 선행 의존**: 백엔드 트랙이 `types.ts`에 타입을 아직 안 넣었으면 이 트랙 컴파일 불가. → 시작 전 확인(§F-1). 최소한 타입 한 줄만 먼저 머지.
2. **벨 위치가 사이드바 푸터**: spec의 "헤더 벨"은 실제로 셸 사이드바 하단 placeholder(`MemberShell.tsx:48-66`)다. 아래로 열면 뷰포트 이탈 → **드롭다운은 위로(`bottom-full mb-2`) 연다.** 레이아웃 이동은 하지 않음(기능·구조 보존).
3. **`format.ts`에 상대시간 헬퍼 부재** → §E에서 신규 추가(재발명 아님, 기존 파일 최소 확장). `Date.now()` 서버/클라 시점 차는 무해.
4. **재동기화 방식**: mark-read 후 낙관적 로컬 상태 + `router.refresh()` 권장. `revalidatePath("/", "layout")`도 액션에 포함하되, 벨 데이터가 `force-dynamic` 셸에서 매 요청 재조회되므로 refresh가 확실한 갱신 경로.
5. **데모 write no-op**: demo에서 읽음 처리는 서버 상태 불변(spec 정책). 낙관적 UI로만 반응하고 새로고침 시 원복 — 정상 동작으로 간주.
