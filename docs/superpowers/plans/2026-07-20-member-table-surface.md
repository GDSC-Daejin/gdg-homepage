# Member Table Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the admin member filters and member table into distinct visual surfaces.

**Architecture:** Keep the existing server page, `MemberFilters`, and `MemberRow` contracts. Add only page-local Tailwind wrappers: one compact filter card and one table card with a small table heading.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Preserve the `q`, `role`, and `status` URL filters, member row dialog, links, and eight existing columns.
- Reuse existing `rounded-xl`, gray tokens, and `shadow-card`; add no dependencies or components.
- Keep horizontal table scrolling on narrow viewports.

---

### Task 1: Separate the member-management surfaces

**Files:**
- Create: `tests/admin-members-table-surface.test.ts`
- Modify: `src/app/admin/members/page.tsx`

**Interfaces:**
- `MemberFilters` continues receiving `q`, `role`, and `status`.
- `MemberRow` continues receiving `member` and `organizerTaken`.

- [x] **Step 1: Write the failing visual-contract test**

```ts
expect(page).toContain('rounded-xl border border-gray-200 bg-white p-4 shadow-card sm:p-6');
expect(page).toContain('>회원 목록</h2>');
expect(page).toContain('overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card');
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/admin-members-table-surface.test.ts`

Expected: FAIL because the filter and table cards do not exist.

- [x] **Step 3: Add the two page-local surface wrappers**

Wrap `MemberFilters` in the existing card token set. Replace the bare table overflow wrapper with a separate card containing a `회원 목록` heading and the same overflow wrapper/table body.

- [x] **Step 4: Run verification**

Run: `pnpm test tests/admin-members-table-surface.test.ts && pnpm test && pnpm exec tsc --noEmit && git diff --check`

Expected: all commands exit 0.

### Task 2: Add academic status and phone visibility

**Files:**
- Create: `supabase/migrations/0034_member_academic_status.sql`
- Modify: `src/lib/types.ts`, `src/lib/demoData.ts`, `src/actions/member.ts`
- Modify: `src/app/admin/members/page.tsx`, `src/app/admin/members/MemberFilters.tsx`, `src/app/admin/members/MemberRow.tsx`, `src/app/admin/members/[id]/MemberRoleStatusForm.tsx`
- Modify: `tests/admin-members-table-surface.test.ts`

**Interfaces:**
- `Profile.academic_status` is one of `enrolled`, `leave`, `graduated`, or `completed`.
- `setMemberAcademicStatus(userId, status)` is callable only by an administrator.

- [x] **Step 1: Write the failing contract test**

Assert that the list includes `전화번호` and `재학여부`, filters by `academic_status`, and the migration restricts values to the four requested statuses.

- [x] **Step 2: Implement the database, type, filter, display, and admin update path**

Use an `academic_status` profile column with default `enrolled`; preserve all current role/status controls and add an independent `재학여부` filter.

- [x] **Step 3: Run focused tests, TypeScript, and diff checks**

Run: `pnpm test tests/admin-members-table-surface.test.ts && pnpm exec tsc --noEmit && git diff --check`
