# 구현 지시서 (Codex용): 멤버 사이드바 통합 11 → 8

## 배경 · 목표

목요일 동아리원 온보딩 전에 멤버 메뉴를 정리한다. **단, 되돌릴 일 없는 "확실한 통합"만** 한다(온보딩 후 또 바꾸면 더 혼란스러우므로). 데이터·스키마·URL은 **그대로 두고**, 표면(사이드바)과 이동 동선만 바꾼다.

**두 가지만 한다:**
1. 회의록 + 자유게시판 + 질문답변 → **"커뮤니티"** 한 항목으로 (탭으로 전환)
2. 출석이력 → **프로필** 안으로 흡수

최종 멤버 사이드바(11 → 8): **홈 · 이벤트 · 공지 · 커뮤니티 · 설문 · 문의 · 자료실 · 프로필**

## 범위 밖 (이번에 절대 하지 말 것)
- 공지·설문·문의를 홈으로 흡수 ❌ (개시 후 별도 작업, 설문은 자주 쓰여 메뉴에 유지)
- 홈(`HomeDashboard`) 리디자인 ❌
- `/admin` 사이드바 ❌ (이미 별도로 처리됨)
- DB 마이그레이션·스키마·RLS·타입 변경 ❌
- 게시판/회의록/출석 **데이터 조회 로직 변경** ❌ (기존 쿼리 그대로 재사용)
- 새 라우트 신설 ❌ (기존 `/board` `/qna` `/meetings` `/profile` `/attend` 유지)

## 필수 준수
- **AGENTS.md**: 이 저장소는 네가 아는 Next.js가 아니다(16.2.10). 코드 전에 `node_modules/next/dist/docs/`에서 App Router 링크/활성경로 규약 확인.
- **최소 diff**. 기존 스타일·컴포넌트(`PageHeader`·`Card`·`Badge` 등) 그대로.
- 커밋은 **명시 경로만** 스테이징(같은 워킹트리에 다른 세션 작업이 있을 수 있음). Co-Authored-By 트레일러는 넣지 말 것.
- 새 의존성 금지.

---

## 작업 1 — 커뮤니티 통합

### 1-1. 커뮤니티 탭바 컴포넌트 신설
`src/components/board/CommunityTabs.tsx` (client). 3개 탭을 링크로 렌더, 현재 경로에 따라 활성 표시:

| 라벨 | href |
|---|---|
| 자유게시판 | `/board` |
| 질문답변 | `/qna` |
| 회의록 | `/meetings` |

- `usePathname()`로 활성 판정(`pathname.startsWith(href)`).
- 스타일은 기존 탭/세그먼트 UI가 있으면 재사용, 없으면 `AdminSidebarNav`의 활성 색(`bg-primary-soft text-primary`) 톤에 맞춘 가로 탭바로.

### 1-2. 세 페이지 상단에 탭바 삽입
- `src/app/(member)/board/page.tsx`, `qna/page.tsx`: `PostListPage` **위**에 `<CommunityTabs />`. (두 파일은 `PostListPage`를 그대로 두고 탭바만 감싼다. `PostListPage` 자체는 건드리지 말 것 — admin 등 다른 곳에서 쓰는지 확인 후 공용이면 특히 수정 금지)
- `src/app/(member)/meetings/page.tsx`: `PageHeader` 위 또는 아래에 `<CommunityTabs />` 삽입. 나머지 로직·쿼리 그대로.
- 주의: `PostListPage`가 내부에서 `PageHeader`로 제목을 그리므로, 탭바가 제목과 중복돼 보이지 않게 배치(탭바를 최상단, 그 아래 기존 내용). 시각적으로 "커뮤니티 > [탭]" 위계가 되게.

### 1-3. 멤버 사이드바 수정 — `src/app/(member)/SidebarNav.tsx`
`baseGroups`의 "활동" 그룹에서 **회의록·자유게시판·질문답변 3개를 제거**하고 **커뮤니티 1개**로 대체:

```ts
{
  title: "활동",
  items: [
    { href: "/events", label: "이벤트", icon: "events" },
    { href: "/notices", label: "공지", icon: "notices" },
    { href: "/board", label: "커뮤니티", icon: "board" }, // 게시판+QnA+회의록
    { href: "/surveys", label: "설문", icon: "surveys" },
    { href: "/inquiries", label: "문의", icon: "inquiries" },
  ],
},
```

- **커뮤니티 항목의 활성 판정**은 `/board` `/qna` `/meetings` 세 경로 모두에서 켜져야 한다. 현재 활성 로직은 `pathname.startsWith(item.href)` 단일 매칭이므로, `NavItem`에 선택적 `matchPrefixes?: string[]` 필드를 추가하고 커뮤니티에 `matchPrefixes: ["/board", "/qna", "/meetings"]`를 주거나, 커뮤니티만 특별 처리. 활성 판정만 바꾸고 다른 항목 동작은 그대로.
- `icons`의 `meetings`·`qna` 정의는 다른 곳에서 안 쓰면 남겨둬도 되고 지워도 됨(불필요 정리는 선택).

---

## 작업 2 — 출석이력 → 프로필 흡수

### 2-1. 프로필에 출석 이력 섹션 추가 — `src/app/(member)/profile/page.tsx`
- 프로필은 이미 `attendances`를 조회 중(현재 `event_id`만 select). 이걸 **출석 이력 표시용으로 확장**: `attend/page.tsx`와 동일한 쿼리(`checked_at, event:events(id, title, type, starts_at)`, `order checked_at desc`)로 바꾸고, 기존에 그 데이터를 쓰던 부분(출석 횟수 카운트 등)이 있으면 깨지지 않게 함께 반영.
- `attend/page.tsx`의 출석 이력 렌더링(타입 뱃지 + 제목 + 일시 + "출석 완료")을 프로필 하단 섹션으로 이식. 컴포넌트로 빼도 좋음(`AttendanceHistory.tsx`), 아니면 프로필 내 섹션으로.
- 섹션 제목은 "출석 이력". 빈 상태는 기존 `EmptyState` 문구 재사용.

### 2-2. `/attend` 라우트 리다이렉트 — `src/app/(member)/attend/page.tsx`
- 북마크·기존 링크 보호를 위해 페이지를 삭제하지 말고 **`/profile`로 redirect**하는 얇은 서버 컴포넌트로 교체:
  ```ts
  import { redirect } from "next/navigation";
  export default function AttendPage() { redirect("/profile"); }
  ```

### 2-3. 멤버 사이드바 — `src/app/(member)/SidebarNav.tsx`
"계정" 그룹에서 **출석이력 항목 제거**, 프로필만 남김:
```ts
{ title: "계정", items: [{ href: "/profile", label: "프로필", icon: "profile" }] },
```

---

## 검증 (완료 기준)
- `pnpm build` 통과(프리렌더 오류 0), `pnpm test` 통과.
- 수동 클릭 경로:
  - 사이드바 항목이 정확히 8개(홈·이벤트·공지·커뮤니티·설문·문의·자료실·프로필). (admin이면 하단 "어드민" 별도 유지)
  - 커뮤니티 클릭 → `/board`, 탭으로 질문답변·회의록 이동, **어느 탭에 있어도 사이드바 "커뮤니티"가 활성**.
  - 프로필에서 출석 이력이 보임. `/attend` 직접 입력 시 `/profile`로 이동.
- 데이터가 이전과 동일하게 나오는지(게시글·회의록·출석 기록 수) 눈으로 확인.

## 하지 말 것 (재확인)
- `PostListPage` 내부 로직 수정 금지(공용 컴포넌트).
- 공지/설문/문의/홈 건드리지 말 것.
- 스키마·RLS·타입·쿼리 컬럼 의미 변경 금지(출석 쿼리는 select 컬럼 추가만).
