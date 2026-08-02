# 모지숲 회의록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노션 "모지숲 회의록" DB에서 `사이트 공개=✅`인 회의를 사이트 DB로 동기화하고, Member가 노션 없이 요약을 read-only로 볼 수 있게 한다.

**Architecture:** 노션 = source of truth(서기·Notion AI 녹음·안건 이월 템플릿). 사이트는 Staff가 누르는 "노션에서 동기화" 서버 액션으로 공개 회의를 `meetings` 미러 테이블에 upsert하고, Member 페이지는 그 테이블을 **직접 쿼리**해 보여준다(공지 페이지와 동일한 컨벤션 — 별도 MeetingStore 없음). Notion API 접근은 동기화 한 곳에만 모인다.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), TypeScript strict, Supabase(RLS), `@notionhq/client` ^5.23, vitest.

## Global Constraints

- 마이그레이션은 **파일 작성까지만.** DB 적용(`supabase db push`)은 사람이 수행 — 실행자는 적용하지 말 것. (기존 플랜 컨벤션)
- 서버 액션: `"use server"` + `requireAdmin()`/`requireProfile()` + `if (await isDemoMode()) return {…}` + `toKoreanError` + `revalidatePath` (기존 `src/actions/place.ts` 패턴 준수).
- 에러 메시지·UI 카피는 **한글**, 반말체 톤 유지("~해요").
- Notion 비밀키(`NOTION_API_KEY`)는 서버 전용. `src/lib/notion.ts`는 클라이언트 컴포넌트에서 import 금지.
- 용어(CONTEXT.md): Staff = organizer ∪ team_member = `ADMIN_ROLES` = `/admin` 접근자. Member 열람 = 로그인 프로필 이상.

---

## 사전 세팅 (사람이 수행, 코드 아님)

구현 착수 전 노션 쪽 준비. Task 3 검증에 필요.

1. 노션에 **"모지숲 회의록"** 데이터베이스 생성. 속성:
   - `제목` (title)
   - `일시` (date)
   - `방식` (select: `온라인` / `오프라인`)
   - `사이트 공개` (checkbox)
   - `공개 요약` (rich text / text)
   - `지난 회의` (relation → 자기 자신) — 브리핑용, 사이트는 안 읽음
2. 새 회의 템플릿에 ①정기 안건 틀 ②이월 안건 자리 ③지난 회의 relation을 넣어둔다(사이트 코드와 무관, 운영 편의).
3. 노션 integration에 이 DB 공유(기존 `NOTION_API_KEY` integration 재사용).
4. DB의 `database_id`를 확보해 env `NOTION_MEETINGS_DATABASE_ID`에 설정(Task 2에서 `.env.example`에 키 추가).

---

## Task 1: `meetings` 미러 테이블 마이그레이션 + `Meeting` 타입

**Files:**
- Create: `supabase/migrations/0029_meetings.sql`
- Modify: `src/lib/types.ts` (파일 끝에 추가)

**Interfaces:**
- Produces: `Meeting` 인터페이스 — `{ id: string; notion_page_id: string; title: string; meeting_date: string | null; mode: "online" | "offline"; summary: string; notion_url: string; synced_at: string; created_at: string }`. Task 3·5가 소비.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0029_meetings.sql`:

```sql
-- 모지숲 회의록: 노션 공개 회의의 read-only 미러
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text not null unique,
  title text not null,
  meeting_date date,
  mode text not null default 'online' check (mode in ('online','offline')),
  summary text not null default '',
  notion_url text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.meetings enable row level security;
-- 미러에는 공개 회의만 들어오므로 로그인 사용자면 읽기 허용
create policy "meetings: read" on public.meetings for select
  using (auth.uid() is not null);
-- 동기화(쓰기)는 Staff만
create policy "meetings: admin all" on public.meetings for all
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: `Meeting` 타입 추가**

`src/lib/types.ts` 맨 끝에 추가:

```ts
export interface Meeting {
  id: string;
  notion_page_id: string;
  title: string;
  meeting_date: string | null;
  mode: "online" | "offline";
  summary: string;
  notion_url: string;
  synced_at: string;
  created_at: string;
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (아직 `Meeting` 미사용이어도 통과).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0029_meetings.sql src/lib/types.ts
git commit -m "feat: meetings 미러 테이블 마이그레이션 + Meeting 타입"
```

> DB 적용(`supabase db push`)은 사람이 수행. 실행자는 파일만 커밋.

---

## Task 2: 노션 회의록 fetch + 파싱

**Files:**
- Modify: `src/lib/notion.ts` (`plainText` export + 회의록 함수 추가)
- Modify: `.env.example` (`NOTION_MEETINGS_DATABASE_ID` 추가)
- Test: `tests/notion-meetings.test.ts`

**Interfaces:**
- Consumes: 기존 `plainText(prop)` (같은 파일), `@notionhq/client`의 `Client`, `isFullDatabase`, `isFullPage`.
- Produces:
  - `ParsedMeeting` = `{ notion_page_id: string; title: string; meeting_date: string | null; mode: "online" | "offline"; summary: string; notion_url: string }`
  - `parseMeetingPage(page): ParsedMeeting` (순수 함수)
  - `fetchPublishedMeetings(): Promise<{ meetings: ParsedMeeting[]; error?: string }>`
  - Task 3이 `fetchPublishedMeetings` 소비.

- [ ] **Step 1: 파서 실패 테스트 작성**

`tests/notion-meetings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseMeetingPage } from "@/lib/notion";
import type { PageObjectResponse } from "@notionhq/client";

function fixture(): PageObjectResponse {
  return {
    id: "page-123",
    url: "https://notion.so/page-123",
    properties: {
      제목: { type: "title", title: [{ plain_text: "7월 3주차 모지숲" }] },
      일시: { type: "date", date: { start: "2026-07-19" } },
      방식: { type: "select", select: { name: "오프라인" } },
      "공개 요약": {
        type: "rich_text",
        rich_text: [{ plain_text: "예산 승인, 데브페스트 일정 확정." }],
      },
    },
  } as unknown as PageObjectResponse;
}

describe("parseMeetingPage", () => {
  it("노션 페이지를 ParsedMeeting으로 매핑한다", () => {
    const m = parseMeetingPage(fixture());
    expect(m).toEqual({
      notion_page_id: "page-123",
      title: "7월 3주차 모지숲",
      meeting_date: "2026-07-19",
      mode: "offline",
      summary: "예산 승인, 데브페스트 일정 확정.",
      notion_url: "https://notion.so/page-123",
    });
  });

  it("방식이 오프라인이 아니면 online으로 폴백한다", () => {
    const page = fixture();
    (page.properties["방식"] as { select: { name: string } }).select.name = "온라인";
    expect(parseMeetingPage(page).mode).toBe("online");
  });

  it("일시가 비면 meeting_date는 null이다", () => {
    const page = fixture();
    (page.properties["일시"] as { date: unknown }).date = null;
    expect(parseMeetingPage(page).meeting_date).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/notion-meetings.test.ts`
Expected: FAIL — `parseMeetingPage` is not exported / not a function.

- [ ] **Step 3: `plainText` export + 파서·fetch 구현**

`src/lib/notion.ts` 수정. (a) 기존 `function plainText` 선언을 `export function plainText`로 변경. (b) import 라인에 타입 추가:

```ts
import { Client, isFullDatabase, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import type { Material } from "@/lib/types";
```

파일 하단(`fetchMaterials` 아래)에 추가:

```ts
const MEETING_PROPERTY = {
  title: "제목",
  date: "일시",
  mode: "방식",
  summary: "공개 요약",
} as const;

export interface ParsedMeeting {
  notion_page_id: string;
  title: string;
  meeting_date: string | null;
  mode: "online" | "offline";
  summary: string;
  notion_url: string;
}

export function parseMeetingPage(page: PageObjectResponse): ParsedMeeting {
  const mode = plainText(page.properties[MEETING_PROPERTY.mode]);
  return {
    notion_page_id: page.id,
    title: plainText(page.properties[MEETING_PROPERTY.title]),
    meeting_date: plainText(page.properties[MEETING_PROPERTY.date]) || null,
    mode: mode === "오프라인" ? "offline" : "online",
    summary: plainText(page.properties[MEETING_PROPERTY.summary]),
    notion_url: page.url,
  };
}

export async function fetchPublishedMeetings(): Promise<{
  meetings: ParsedMeeting[];
  error?: string;
}> {
  const token = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_MEETINGS_DATABASE_ID;

  if (!token || !databaseId) {
    return { meetings: [], error: "노션 회의록 연동이 설정되지 않았어요" };
  }

  try {
    const notion = new Client({ auth: token });
    const database = await notion.databases.retrieve({ database_id: databaseId });
    if (!isFullDatabase(database)) {
      return { meetings: [], error: "노션 회의록을 불러오지 못했어요" };
    }
    const dataSourceId = database.data_sources[0]?.id;
    if (!dataSourceId) {
      return { meetings: [], error: "노션 회의록을 불러오지 못했어요" };
    }

    const results = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 20;

    while (hasMore && pageCount < MAX_PAGES) {
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
        filter: { property: "사이트 공개", checkbox: { equals: true } },
      });
      results.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
      pageCount += 1;
    }

    return { meetings: results.filter(isFullPage).map(parseMeetingPage) };
  } catch {
    return { meetings: [], error: "노션 회의록을 불러오지 못했어요" };
  }
}
```

- [ ] **Step 4: `.env.example`에 키 추가**

`.env.example`의 `NOTION_DATABASE_ID` 줄 아래에 추가:

```
NOTION_MEETINGS_DATABASE_ID=
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/notion-meetings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋**

```bash
git add src/lib/notion.ts .env.example tests/notion-meetings.test.ts
git commit -m "feat: 노션 모지숲 회의록 fetch + 파서"
```

---

## Task 3: 동기화 서버 액션

**Files:**
- Create: `src/actions/meeting.ts`

**Interfaces:**
- Consumes: `fetchPublishedMeetings` (Task 2), `requireAdmin`(`@/lib/auth`), `isDemoMode`(`@/lib/demo`), `createClient`(`@/lib/supabase/server`), `toKoreanError`(`@/lib/errors`).
- Produces: `syncMeetingsFromNotion(): Promise<{ error?: string; synced?: number; removed?: number }>`. Task 4가 소비.

- [ ] **Step 1: 액션 구현**

`src/actions/meeting.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { fetchPublishedMeetings } from "@/lib/notion";

export async function syncMeetingsFromNotion(): Promise<{
  error?: string;
  synced?: number;
  removed?: number;
}> {
  await requireAdmin();
  if (await isDemoMode()) return { synced: 0, removed: 0 };

  const { meetings, error } = await fetchPublishedMeetings();
  if (error) return { error };

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (meetings.length > 0) {
    const rows = meetings.map((m) => ({ ...m, synced_at: now }));
    const { error: upsertError } = await supabase
      .from("meetings")
      .upsert(rows, { onConflict: "notion_page_id" });
    if (upsertError) return { error: toKoreanError(upsertError) };
  }

  // 노션에서 공개 해제된 회의는 미러에서 제거
  const { data: existing } = await supabase.from("meetings").select("notion_page_id");
  const keep = new Set(meetings.map((m) => m.notion_page_id));
  const toRemove = (existing ?? [])
    .map((r) => r.notion_page_id as string)
    .filter((id) => !keep.has(id));

  let removed = 0;
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("meetings")
      .delete()
      .in("notion_page_id", toRemove);
    if (deleteError) return { error: toKoreanError(deleteError) };
    removed = toRemove.length;
  }

  revalidatePath("/meetings");
  revalidatePath("/admin");
  return { synced: meetings.length, removed };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/actions/meeting.ts
git commit -m "feat: 노션→미러 회의록 동기화 액션"
```

---

## Task 4: `/admin` 동기화 버튼

**Files:**
- Create: `src/app/admin/SyncMeetingsButton.tsx`
- Modify: `src/app/admin/page.tsx` (버튼 렌더 — 파일 구조 확인 후 적절한 카드/섹션에 배치)

**Interfaces:**
- Consumes: `syncMeetingsFromNotion` (Task 3), `Button`(`@/components/Button`).
- Produces: `<SyncMeetingsButton />` (props 없음).

- [ ] **Step 1: 클라이언트 버튼 구현**

`src/app/admin/SyncMeetingsButton.tsx` (기존 `DeleteNoticeButton`의 `useTransition` + `Spinner` 패턴 참고):

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMeetingsFromNotion } from "@/actions/meeting";
import { Button } from "@/components/Button";

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

export function SyncMeetingsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [isError, setIsError] = useState(false);

  function handleSync() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await syncMeetingsFromNotion();
      if (result.error) {
        setIsError(true);
        setMessage(result.error);
        return;
      }
      setIsError(false);
      setMessage(`동기화 완료 · 반영 ${result.synced ?? 0}건, 제거 ${result.removed ?? 0}건`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleSync}
        disabled={pending}
        className="gap-1.5"
      >
        {pending && <Spinner />}
        노션에서 회의록 동기화
      </Button>
      {message && (
        <p
          className={`rounded-md px-2 py-1 text-xs ${
            isError ? "bg-danger-soft text-danger" : "bg-gray-50 text-gray-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
```

> `variant="secondary"`가 `Button`에 없으면 `src/components/Button.tsx`의 실제 variant 중 하나(예: `outline`/`ghost`)로 교체.

- [ ] **Step 2: `/admin` 페이지에 버튼 배치**

`src/app/admin/page.tsx`를 열어 기존 카드/위젯 구조를 확인하고, 운영 도구 성격에 맞는 카드(또는 새 `Card` 하나)에 `<SyncMeetingsButton />`를 렌더. import 추가:

```tsx
import { SyncMeetingsButton } from "./SyncMeetingsButton";
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/app/admin/SyncMeetingsButton.tsx src/app/admin/page.tsx
git commit -m "feat: 어드민 회의록 동기화 버튼"
```

---

## Task 5: Member 회의록 페이지 + 내비게이션

**Files:**
- Create: `src/app/(member)/meetings/page.tsx`
- Modify: `src/app/(member)/SidebarNav.tsx` (nav 항목 + 아이콘 추가)

**Interfaces:**
- Consumes: `requireProfile`(`@/lib/auth`), `createClient`(`@/lib/supabase/server`), `ADMIN_ROLES`·`Meeting`(`@/lib/types`), `PageHeader`·`EmptyState`·`Badge`(`@/components/*`).

- [ ] **Step 1: Member 페이지 구현** (공지 페이지 `src/app/(member)/notices/page.tsx` 컨벤션 미러)

`src/app/(member)/meetings/page.tsx`:

```tsx
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/types";
import type { Meeting } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

const MODE_LABEL: Record<Meeting["mode"], string> = {
  online: "온라인",
  offline: "오프라인",
};

export default async function MemberMeetingsPage() {
  const profile = await requireProfile();
  const isStaff = ADMIN_ROLES.includes(profile.role);

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false, nullsFirst: false });

  const list = (data ?? []) as Meeting[];

  return (
    <div>
      <PageHeader title="모지숲 회의록" description="주간 운영회의 요약을 확인해요" />
      {list.length === 0 ? (
        <EmptyState title="공개된 회의록이 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((meeting) => (
            <details
              key={meeting.id}
              className="group rounded-xl border border-gray-200 bg-white shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-900">
                      {meeting.title}
                    </span>
                    <Badge tone="neutral">{MODE_LABEL[meeting.mode]}</Badge>
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    {meeting.meeting_date ?? ""}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-gray-500 transition-transform group-open:rotate-180"
                >
                  ⌄
                </span>
              </summary>
              <div className="border-t border-gray-100 px-6 pb-6 pt-4">
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {meeting.summary || "요약이 아직 없어요."}
                </p>
                {isStaff && meeting.notion_url && (
                  <a
                    href={meeting.notion_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    노션 원문 열기 →
                  </a>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
```

> `Badge`의 `tone` prop 명·값은 `src/components/Badge.tsx` 확인 후 맞춤(코드베이스에 `tone="neutral"` 사용례 있음 — RecruitingWidget). `text-primary`가 없으면 링크 색은 기존 링크 클래스에 맞춤.

- [ ] **Step 2: 내비게이션 항목 추가**

`src/app/(member)/SidebarNav.tsx`의 `icons` 객체에 회의록 아이콘 추가:

```ts
  meetings: "M7 3h10a1 1 0 0 1 1 1v13l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z",
```

`baseGroups`의 "활동" 그룹 items 배열에서 `공지` 항목 바로 아래에 추가:

```ts
      { href: "/meetings", label: "회의록", icon: "meetings" },
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/(member)/meetings/page.tsx" "src/app/(member)/SidebarNav.tsx"
git commit -m "feat: Member 모지숲 회의록 열람 페이지 + 내비"
```

---

## 최종 검증 (전체 통합)

- [ ] **DB 적용(사람)**: `supabase db push`로 `0029_meetings.sql` 반영.
- [ ] **env 설정**: `NOTION_MEETINGS_DATABASE_ID` 실제 값 설정(로컬 `.env`, 배포 환경변수).
- [ ] **동기화 확인**: `/admin`에서 "노션에서 회의록 동기화" 클릭 → "동기화 완료 · 반영 N건" 메시지. 노션에서 `사이트 공개` 체크한 회의 수와 일치.
- [ ] **Member 열람**: 일반 Member 계정으로 `/meetings` → 요약 보임, 노션 링크 **안 보임**. Staff 계정 → 노션 링크 보임.
- [ ] **공개 해제**: 노션에서 한 회의 `사이트 공개` 해제 → 재동기화 → `/meetings`에서 사라짐, "제거 1건".
- [ ] **전체 테스트**: `npm run test` 통과.

---

## Self-Review 결과

- **Spec 커버리지**: 노션 DB 스키마(사전 세팅) · 미러 테이블(T1) · Notion fetch(T2) · 동기화 액션·버튼(T3·T4) · Member read-only 뷰·Staff 전용 링크(T5) 모두 태스크 존재. "안 하는 것"(작성·STT·이월 로직·라이브 임베드)은 태스크로 만들지 않음 — 의도적.
- **타입 일관성**: `ParsedMeeting`(T2) 필드 = `meetings` 컬럼(T1) = upsert row(T3). `syncMeetingsFromNotion` 반환형 T3 정의 = T4 소비 일치. `Meeting.mode` union = 페이지 `MODE_LABEL` 키 일치.
- **열린 항목**: 스펙의 "공개 요약 포맷"은 플레인 텍스트(`plainText`)로 확정. "공개 해제 처리"는 하드 삭제로 확정(T3). Button `variant`·Badge `tone` 실제 이름은 컴포넌트 확인 후 맞추라고 각 태스크에 명시.
