# Notice Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원 공지 목록에서 본문을 같은 카드 안에 펼쳐 읽게 한다.

**Architecture:** 서버 페이지의 기존 조회를 유지하고, 각 링크 카드를 네이티브 `details`/`summary` 요소로 바꾼다. 브라우저 기본 토글 동작을 사용하므로 클라이언트 컴포넌트나 상태가 필요 없다.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- 공지 조회·발행 필터·정렬·빈 상태와 `/notices/[id]` 상세 경로는 유지한다.
- 새 의존성 및 클라이언트 상태를 추가하지 않는다.

---

### Task 1: 공지 목록 아코디언

**Files:**
- Modify: `src/app/(member)/notices/page.tsx`
- Modify: `docs/PRD/member/member-notices.md`
- Test: `tests/member-notices.test.ts`

**Interfaces:**
- Consumes: `Notice`의 `id`, `title`, `body`, `published_at`
- Produces: 각 공지의 독립적인 HTML `details` 토글

- [x] **Step 1: 실패하는 목록 마크업 테스트 작성**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 공지 목록", () => {
  it("상세 링크 대신 네이티브 아코디언으로 본문을 표시한다", async () => {
    const page = await readFile("src/app/(member)/notices/page.tsx", "utf8");

    expect(page).toContain("<details");
    expect(page).toContain("<summary");
    expect(page).toContain("{notice.body}");
    expect(page).not.toContain("href={`/notices/${notice.id}`}");
  });
});
```

- [x] **Step 2: 테스트가 현재 링크 목록에서 실패하는지 확인**

Run: `pnpm test tests/member-notices.test.ts`

Expected: `details` 마크업이 없다는 assertion failure

- [x] **Step 3: 최소 아코디언 마크업 구현**

`src/app/(member)/notices/page.tsx`에서 `Link`와 `Card` import를 제거하고, 각 공지의 링크 카드를 다음 구조로 교체한다.

```tsx
<details className="group rounded-xl border border-gray-200 bg-white shadow-card">
  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
    <span>
      <span className="block text-base font-semibold text-gray-900">{notice.title}</span>
      <span className="mt-1 block text-sm text-gray-500">
        {notice.published_at ? formatKst(notice.published_at) : ""}
      </span>
    </span>
    <span aria-hidden className="text-gray-500 transition-transform group-open:rotate-180">⌄</span>
  </summary>
  <p className="border-t border-gray-100 px-6 pb-6 pt-4 whitespace-pre-wrap text-sm text-gray-700">
    {notice.body}
  </p>
</details>
```

- [x] **Step 4: 제품 요구사항 문서의 목록 인터랙션을 갱신**

`docs/PRD/member/member-notices.md`의 카드 설명과 인터랙션을 목록 안의 열기·닫기로 바꾸고, 상세 이동 설명은 제거한다.

- [x] **Step 5: 테스트와 타입 검사를 실행**

Run: `pnpm test tests/member-notices.test.ts && pnpm exec tsc --noEmit`

Expected: 테스트 1개 통과 및 TypeScript 오류 없음
