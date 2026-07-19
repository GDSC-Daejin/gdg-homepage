# 포지션별 면접 질문 은행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포지션별 면접 질문을 관리(추가/수정/삭제)하고, 지원자 상세에서 해당 포지션 + 공통 질문을 읽기전용으로 조회한다.

**Architecture:** 기존 공지(notice)·뱃지(badge) 기능과 동일한 패턴 — Supabase 테이블 + RLS(admin only), `requireAdmin`+`isDemoMode` 가드를 둔 서버 액션, 클라이언트 매니저 UI. 공통 질문은 `position IS NULL`로 표현한다.

**Tech Stack:** Next.js (App Router), TypeScript strict, Supabase (Postgres + RLS), zod, vitest, Tailwind.

## Global Constraints

- 모든 mutation 액션: 첫 줄 `await requireAdmin()`, 그다음 `if (await isDemoMode()) return {};`
- Supabase 에러는 `toKoreanError(error)`로 변환해 `{ error }` 반환
- 포지션 값은 정확히 `'frontend' | 'backend' | 'designer' | 'beginner'` 4개, 공통은 `null`
- 정렬은 `created_at` 오름차순 (수동 재정렬 없음)
- 마이그레이션 파일 번호: `0028` (현재 최신이 `0027`)
- 스펙: `docs/superpowers/specs/2026-07-19-interview-questions-design.md`

---

### Task 1: 스키마 · 타입 · 검증 테스트

zod 스키마와 TS 타입을 추가하고, 스키마 동작을 테스트로 고정한다.

**Files:**
- Modify: `src/lib/schemas.ts` (noticeSchema 아래에 추가)
- Modify: `src/lib/types.ts` (Position/Notice 근처에 추가)
- Test: `tests/schemas.test.ts`

**Interfaces:**
- Produces:
  - `interviewQuestionSchema` — `z.object({ position: enum|null, body: string(min 1) })`
  - `InterviewQuestion` 타입 — `{ id: string; position: Position | null; body: string; created_by: string | null; created_at: string; updated_at: string }`

- [ ] **Step 1: 스키마 테스트 작성 (실패 확인용)**

`tests/schemas.test.ts` 상단 import 목록에 `interviewQuestionSchema`를 추가하고, 파일 끝에 다음 describe 블록을 추가한다.

```ts
describe("interviewQuestionSchema", () => {
  it("빈 body는 reject한다", () => {
    const result = interviewQuestionSchema.safeParse({ position: "frontend", body: "" });
    expect(result.success).toBe(false);
  });

  it("position null(공통)을 허용한다", () => {
    const result = interviewQuestionSchema.safeParse({ position: null, body: "자기소개 해주세요" });
    expect(result.success).toBe(true);
  });

  it("정상 포지션 입력을 통과시킨다", () => {
    const result = interviewQuestionSchema.safeParse({ position: "backend", body: "트랜잭션이란?" });
    expect(result.success).toBe(true);
  });

  it("잘못된 position은 reject한다", () => {
    const result = interviewQuestionSchema.safeParse({ position: "pm", body: "질문" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — `interviewQuestionSchema` is not exported / undefined

- [ ] **Step 3: 스키마 추가**

`src/lib/schemas.ts`의 `noticeSchema` 정의 바로 아래에 추가:

```ts
export const interviewQuestionSchema = z.object({
  position: z.enum(["frontend", "backend", "designer", "beginner"]).nullable(),
  body: z.string().min(1, "질문을 입력해주세요"),
});
```

- [ ] **Step 4: 타입 추가**

`src/lib/types.ts`에 추가 (`Position` 타입은 이미 존재):

```ts
export interface InterviewQuestion {
  id: string;
  position: Position | null;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS (모든 interviewQuestionSchema 케이스 포함)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/schemas.ts src/lib/types.ts tests/schemas.test.ts
git commit -m "feat: 면접 질문 스키마·타입 추가"
```

---

### Task 2: DB 마이그레이션 (interview_questions 테이블 + RLS)

**Files:**
- Create: `supabase/migrations/0028_interview_questions.sql`

**Interfaces:**
- Produces: `public.interview_questions` 테이블 (admin RLS). 컬럼: `id, position, body, created_by, created_at, updated_at`.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0028_interview_questions.sql`:

```sql
-- 포지션별 면접 질문 은행. position IS NULL = 공통 질문.
-- admin만 CRUD (기존 notices: admin all 정책과 동일 패턴)

create table public.interview_questions (
  id          uuid primary key default gen_random_uuid(),
  position    text,
  body        text not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint interview_questions_position_check
    check (position is null or position in ('frontend', 'backend', 'designer', 'beginner'))
);

alter table public.interview_questions enable row level security;

create policy "interview_questions: admin all"
  on public.interview_questions for all
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: 로컬 DB에 적용 (가능한 경우)**

Run: `npx supabase db reset` (로컬 supabase 실행 중일 때) 또는 원격 프로젝트라면 `npx supabase db push`
Expected: 마이그레이션이 에러 없이 적용됨. 로컬 supabase가 없으면 SQL 문법만 검토하고 다음 단계로 진행.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0028_interview_questions.sql
git commit -m "feat: interview_questions 테이블 + RLS 마이그레이션"
```

---

### Task 3: 서버 액션 (create / update / delete)

**Files:**
- Create: `src/actions/interview-question.ts`

**Interfaces:**
- Consumes: `interviewQuestionSchema` (Task 1), `InterviewQuestion`/`Position`/`ActionResult` 타입
- Produces:
  - `createInterviewQuestion(position: Position | null, body: string): Promise<ActionResult>`
  - `updateInterviewQuestion(id: string, body: string): Promise<ActionResult>`
  - `deleteInterviewQuestion(id: string): Promise<ActionResult>`

- [ ] **Step 1: 액션 파일 작성**

`src/actions/interview-question.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { interviewQuestionSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, Position } from "@/lib/types";

export async function createInterviewQuestion(
  position: Position | null,
  body: string,
): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = interviewQuestionSchema.safeParse({ position, body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("interview_questions").insert({
    position: parsed.data.position,
    body: parsed.data.body,
    created_by: profile.id,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interview-questions");
  return {};
}

export async function updateInterviewQuestion(
  id: string,
  body: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (!body.trim()) return { error: "질문을 입력해주세요" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_questions")
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interview-questions");
  return {};
}

export async function deleteInterviewQuestion(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_questions")
    .delete()
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interview-questions");
  return {};
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS (에러 없음). `requireAdmin`이 `profile.id`를 제공하는지 `src/lib/auth.ts`로 확인 — notice/points 액션과 동일 사용법.

- [ ] **Step 3: 커밋**

```bash
git add src/actions/interview-question.ts
git commit -m "feat: 면접 질문 CRUD 서버 액션"
```

---

### Task 4: 조회 헬퍼 + demo 데이터

**Files:**
- Create: `src/lib/interview-questions.ts`
- Modify: `src/lib/demoData.ts` (export 추가)

**Interfaces:**
- Consumes: `InterviewQuestion`/`Position` 타입, `DEMO_INTERVIEW_QUESTIONS`
- Produces:
  - `getInterviewQuestionsFor(position: Position | null): Promise<InterviewQuestion[]>` — 해당 포지션 + 공통
  - `getAllInterviewQuestions(): Promise<InterviewQuestion[]>` — 전체
  - `DEMO_INTERVIEW_QUESTIONS: InterviewQuestion[]`

- [ ] **Step 1: demo 데이터 추가**

`src/lib/demoData.ts` 파일 끝에 추가 (기존 `DEMO_*` export 스타일에 맞춤). `import type { InterviewQuestion } from "@/lib/types";`가 파일 상단 import에 없으면 추가한다.

```ts
export const DEMO_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { id: "iq-common-1", position: null, body: "자기소개와 함께 이 동아리에 지원한 이유를 말씀해주세요.", created_by: null, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" },
  { id: "iq-common-2", position: null, body: "협업 중 갈등을 겪었던 경험과 해결 방법을 말씀해주세요.", created_by: null, created_at: "2026-07-01T00:01:00.000Z", updated_at: "2026-07-01T00:01:00.000Z" },
  { id: "iq-fe-1", position: "frontend", body: "리액트에서 상태 관리를 어떻게 해봤는지 설명해주세요.", created_by: null, created_at: "2026-07-01T00:02:00.000Z", updated_at: "2026-07-01T00:02:00.000Z" },
  { id: "iq-be-1", position: "backend", body: "REST API를 설계할 때 고려하는 점은 무엇인가요?", created_by: null, created_at: "2026-07-01T00:03:00.000Z", updated_at: "2026-07-01T00:03:00.000Z" },
  { id: "iq-ds-1", position: "designer", body: "가장 애착이 가는 디자인 작업물과 그 이유를 소개해주세요.", created_by: null, created_at: "2026-07-01T00:04:00.000Z", updated_at: "2026-07-01T00:04:00.000Z" },
  { id: "iq-bg-1", position: "beginner", body: "개발을 시작하게 된 계기와 앞으로 배우고 싶은 것을 말씀해주세요.", created_by: null, created_at: "2026-07-01T00:05:00.000Z", updated_at: "2026-07-01T00:05:00.000Z" },
];
```

- [ ] **Step 2: 조회 헬퍼 작성**

`src/lib/interview-questions.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_INTERVIEW_QUESTIONS } from "@/lib/demoData";
import type { InterviewQuestion, Position } from "@/lib/types";

/** 지원자 상세용: 해당 포지션 질문 + 공통(position IS NULL) 질문 */
export async function getInterviewQuestionsFor(
  position: Position | null,
): Promise<InterviewQuestion[]> {
  if (await isDemoMode()) {
    return DEMO_INTERVIEW_QUESTIONS.filter(
      (q) => q.position === null || q.position === position,
    );
  }

  const supabase = await createClient();
  const base = supabase
    .from("interview_questions")
    .select("*")
    .order("created_at", { ascending: true });
  const { data } = position
    ? await base.or(`position.eq.${position},position.is.null`)
    : await base.is("position", null);

  return (data as InterviewQuestion[] | null) ?? [];
}

/** 관리 페이지용: 전체 질문 */
export async function getAllInterviewQuestions(): Promise<InterviewQuestion[]> {
  if (await isDemoMode()) return DEMO_INTERVIEW_QUESTIONS;

  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_questions")
    .select("*")
    .order("created_at", { ascending: true });

  return (data as InterviewQuestion[] | null) ?? [];
}
```

주: `position`은 고정 enum 값이라 `.or()` 문자열 주입 위험 없음.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/lib/interview-questions.ts src/lib/demoData.ts
git commit -m "feat: 면접 질문 조회 헬퍼 + demo 데이터"
```

---

### Task 5: 관리 페이지 + 매니저 UI + 사이드바 nav

**Files:**
- Create: `src/app/admin/interview-questions/page.tsx`
- Create: `src/app/admin/interview-questions/InterviewQuestionManager.tsx`
- Modify: `src/app/admin/AdminSidebarNav.tsx` (모집 그룹에 nav 항목 + 아이콘)

**Interfaces:**
- Consumes: `getAllInterviewQuestions` (Task 4), `createInterviewQuestion`/`updateInterviewQuestion`/`deleteInterviewQuestion` (Task 3), `InterviewQuestion`/`Position`/`POSITION_LABELS`

- [ ] **Step 1: 사이드바 nav 추가**

`src/app/admin/AdminSidebarNav.tsx`의 `icons` 객체에 항목 추가:

```ts
  interview: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3.5 9h5M9.5 15h3",
```

그리고 `groups`의 "모집" 그룹 `items` 배열에서 `설정` 앞에 추가:

```ts
      { href: "/admin/applications", label: "지원서", icon: "applications" },
      { href: "/admin/interview-questions", label: "면접 질문", icon: "interview" },
      { href: "/admin/settings", label: "설정", icon: "settings" },
```

- [ ] **Step 2: 매니저 클라이언트 컴포넌트 작성**

`src/app/admin/interview-questions/InterviewQuestionManager.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createInterviewQuestion,
  updateInterviewQuestion,
  deleteInterviewQuestion,
} from "@/actions/interview-question";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { POSITION_LABELS } from "@/lib/types";
import type { InterviewQuestion, Position } from "@/lib/types";

type Tab = Position | "common";

const TABS: { key: Tab; label: string }[] = [
  { key: "frontend", label: POSITION_LABELS.frontend },
  { key: "backend", label: POSITION_LABELS.backend },
  { key: "designer", label: POSITION_LABELS.designer },
  { key: "beginner", label: POSITION_LABELS.beginner },
  { key: "common", label: "공통" },
];

function tabPosition(tab: Tab): Position | null {
  return tab === "common" ? null : tab;
}

function QuestionRow({
  q,
  disabled,
  onSaved,
  onDeleted,
}: {
  q: InterviewQuestion;
  disabled?: boolean;
  onSaved: (id: string, body: string) => Promise<{ error?: string } | undefined>;
  onDeleted: (id: string) => Promise<{ error?: string } | undefined>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(q.body);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(undefined);
    startTransition(async () => {
      const result = await onSaved(q.id, value);
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await onDeleted(q.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      {editing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="primary" disabled={pending || disabled} onClick={handleSave}>
              저장
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setValue(q.body);
                setEditing(false);
                setError(undefined);
              }}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{q.body}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={disabled}
              className="text-xs font-medium text-gray-500 hover:text-primary disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled || pending}
              className="text-xs font-medium text-gray-500 hover:text-danger disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}

export function InterviewQuestionManager({
  questions,
}: {
  questions: InterviewQuestion[];
}) {
  const [tab, setTab] = useState<Tab>("frontend");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const list = useMemo(() => {
    const pos = tabPosition(tab);
    return questions.filter((q) => q.position === pos);
  }, [questions, tab]);

  function handleCreate() {
    setError(undefined);
    if (!body.trim()) return setError("질문을 입력해주세요");
    startTransition(async () => {
      const result = await createInterviewQuestion(tabPosition(tab), body.trim());
      if (result?.error) return setError(result.error);
      setBody("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">면접 질문 관리</h2>
        <p className="text-sm text-gray-500">포지션별 면접 질문을 만들고 수정·삭제해요. 공통 질문은 모든 포지션 면접에 함께 표시돼요.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError(undefined);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <p className="mb-2 text-xs font-medium text-gray-700">
          새 질문 추가 · {TABS.find((t) => t.key === tab)?.label}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="예) 최근에 가장 몰입했던 프로젝트를 소개해주세요"
            />
          </div>
          <Button type="button" variant="primary" disabled={pending} onClick={handleCreate}>
            질문 추가
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </Card>

      {list.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">📝</span>}
          title="아직 질문이 없어요"
          description="위 입력창에서 이 포지션의 첫 질문을 만들어보세요."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-700">
            질문 <span className="text-gray-400">{list.length}개</span>
          </p>
          {list.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              disabled={pending}
              onSaved={updateInterviewQuestion}
              onDeleted={deleteInterviewQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

주: `Input`이 `value`/`onChange` prop을 받는지 `src/components/Input.tsx`에서 확인. 만약 제어 컴포넌트 prop을 지원하지 않으면 Input을 그대로 쓰되 네이티브 `<input>`처럼 `value`/`onChange`를 전달(대부분 통과). 지원 안 하면 이 Task의 Step 4 타입체크에서 잡히므로 그때 native `<input className="...">`로 교체.

- [ ] **Step 3: 관리 페이지(서버 컴포넌트) 작성**

`src/app/admin/interview-questions/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth";
import { getAllInterviewQuestions } from "@/lib/interview-questions";
import { InterviewQuestionManager } from "./InterviewQuestionManager";

export const dynamic = "force-dynamic";

export default async function AdminInterviewQuestionsPage() {
  await requireAdmin();
  const questions = await getAllInterviewQuestions();
  return <InterviewQuestionManager questions={questions} />;
}
```

주: 다른 admin 페이지가 공통 레이아웃 래퍼(제목/컨테이너)를 쓰는지 `src/app/admin/points/page.tsx`를 열어 확인하고 동일한 래핑을 맞춘다.

- [ ] **Step 4: 타입체크 + 빌드**

Run: `npx tsc --noEmit`
Expected: PASS. `Input`/`Button`/`Card`/`EmptyState` prop 불일치가 있으면 여기서 수정.

- [ ] **Step 5: 브라우저 확인**

`/admin/interview-questions` 접속(demo 모드로 로그인). 확인:
- 탭 5개(프론트엔드/백엔드/디자이너/비기너/공통) 전환 시 리스트가 바뀐다
- demo 데이터가 탭별로 보인다 (공통 2개, 각 포지션 1개)
- (demo에서는 추가/수정/삭제가 no-op이라 반영 안 됨 — 정상)

- [ ] **Step 6: 커밋**

```bash
git add src/app/admin/interview-questions/ src/app/admin/AdminSidebarNav.tsx
git commit -m "feat: 면접 질문 관리 페이지 + 사이드바 nav"
```

---

### Task 6: 지원자 상세에 면접 질문 조회 섹션

**Files:**
- Modify: `src/app/admin/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `getInterviewQuestionsFor` (Task 4)

- [ ] **Step 1: 질문 조회 추가**

`src/app/admin/applications/[id]/page.tsx` 상단 import에 추가:

```ts
import { getInterviewQuestionsFor } from "@/lib/interview-questions";
```

`if (!app) notFound();` 아래(변수 `name`, `positionLabel` 등을 계산하는 곳 근처)에 추가:

```ts
const interviewQuestions = await getInterviewQuestionsFor(app.position);
```

- [ ] **Step 2: 읽기전용 섹션 렌더**

`return (<Card ...>` 내부, 답변/정보 `grid`를 닫는 `</div>` 다음(심사 패널 위 또는 grid 바로 아래)에 섹션 추가:

```tsx
<div className="flex flex-col gap-3">
  <p className="text-sm font-semibold text-gray-700">
    면접 질문
    <span className="ml-2 text-xs font-normal text-gray-400">
      {positionLabel} · 공통 포함
    </span>
  </p>
  {interviewQuestions.length === 0 ? (
    <p className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-400">
      등록된 면접 질문이 없어요. 면접 질문 메뉴에서 추가할 수 있어요.
    </p>
  ) : (
    <ol className="flex flex-col gap-2">
      {interviewQuestions.map((q, i) => (
        <li
          key={q.id}
          className="flex gap-2 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800"
        >
          <span className="font-semibold text-primary">Q{i + 1}</span>
          <span className="whitespace-pre-wrap">{q.body}</span>
        </li>
      ))}
    </ol>
  )}
</div>
```

주: 삽입 위치는 실제 JSX 구조를 열어 확인 — `지원 문항 답변`/`지원자 정보`를 감싼 `grid` 컨테이너 `</div>` 바로 다음, 최상위 `Card`의 직계 자식으로 넣어 전체 폭을 쓰게 한다.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 브라우저 확인**

demo 지원자 상세(`/admin/applications/<id>`) 접속. 확인:
- "면접 질문" 섹션이 답변 아래에 보인다
- 지원자 포지션 질문 + 공통 질문이 함께 나온다
- 포지션이 없는(미지정) 지원자는 공통 질문만 나온다

- [ ] **Step 5: 커밋**

```bash
git add "src/app/admin/applications/[id]/page.tsx"
git commit -m "feat: 지원자 상세에 면접 질문 조회 섹션"
```

---

## 최종 검증

- [ ] `npx vitest run` — 전체 테스트 PASS
- [ ] `npx tsc --noEmit` — 타입 에러 없음
- [ ] `npx next lint` (프로젝트에 lint 스크립트가 있으면) — 통과
- [ ] demo 모드에서 관리 페이지 탭 전환 + 지원자 상세 질문 표시 동작 확인
```
