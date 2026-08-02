# Member Management and Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** C안의 회원 관리 화면을 적용하고, 사용자가 자신의 프로필 사진을 안전하게 저장·교체할 수 있게 한다.

**Architecture:** `profiles.avatar_path`에는 비공개 Supabase Storage 객체 경로만 저장한다. 브라우저는 RLS가 적용된 `avatars` 버킷에 본인 경로로 업로드하고, 공용 Avatar 컴포넌트가 짧은 만료의 signed URL을 발급해 현재 사용자와 관리자 목록에 표시한다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Storage, Vitest, Tailwind CSS.

## Global Constraints

- 기존 검색·필터 URL, 역할·상태 수정, 행 클릭 상세 편집, 접근성 라벨과 테스트 셀렉터를 바꾸지 않는다.
- 사진은 PNG/JPEG/WebP, 최대 5MB이며 `avatars/<auth.uid()>/avatar` 한 경로만 허용한다.
- 버킷은 비공개이며, 소유자와 관리 역할만 객체를 읽는다.
- 새 의존성·이미지 라이브러리를 추가하지 않는다.

---

### Task 1: Avatar contract and Storage migration

**Files:**
- Create: `tests/avatar.test.ts`
- Create: `src/lib/avatar.ts`
- Create: `supabase/migrations/0028_profile_avatars.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces `AVATAR_ACCEPTED_TYPES`, `AVATAR_MAX_BYTES`, and `validateAvatarFile(file)`.
- Adds `Profile.avatar_path: string | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { AVATAR_MAX_BYTES, validateAvatarFile } from "@/lib/avatar";

it("PNG/JPEG/WebP 5MB 이하만 프로필 사진으로 허용한다", () => {
  expect(validateAvatarFile({ type: "image/webp", size: AVATAR_MAX_BYTES })).toBeUndefined();
  expect(validateAvatarFile({ type: "image/gif", size: 1 })).toBe("PNG, JPEG, WebP 이미지만 올릴 수 있어요");
  expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toBe("프로필 사진은 5MB 이하만 올릴 수 있어요");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/avatar.test.ts`

Expected: FAIL because `@/lib/avatar` does not exist.

- [ ] **Step 3: Write minimal implementation and migration**

```ts
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export function validateAvatarFile(file: Pick<File, "type" | "size">) {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type as (typeof AVATAR_ACCEPTED_TYPES)[number])) return "PNG, JPEG, WebP 이미지만 올릴 수 있어요";
  if (file.size > AVATAR_MAX_BYTES) return "프로필 사진은 5MB 이하만 올릴 수 있어요";
}
```

`0028_profile_avatars.sql` adds nullable `avatar_path`, creates a private `avatars` bucket with a 5MB MIME allowlist, grants profile-column updates, and permits Storage read for owner/admin plus insert/update only when the first object path segment is `auth.uid()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/avatar.test.ts`

Expected: PASS.

### Task 2: Self-service avatar upload and display

**Files:**
- Create: `src/components/Avatar.tsx`
- Create: `src/app/(member)/profile/ProfileAvatar.tsx`
- Modify: `src/actions/profile.ts`
- Modify: `src/app/(member)/profile/ProfileForm.tsx`
- Modify: `src/app/(member)/MemberShell.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- `setProfileAvatar(path: string): Promise<ActionResult>` accepts only `avatarPath(currentUser.id)`.
- `Avatar` takes `name`, `avatarPath`, and a caller-controlled `className` fallback shell.

- [ ] **Step 1: Add the failing action-path test**

```ts
import { avatarPath } from "@/lib/avatar";

it("사용자별로 하나의 고정 avatar 경로를 만든다", () => {
  expect(avatarPath("user-1")).toBe("user-1/avatar");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/avatar.test.ts`

Expected: FAIL because `avatarPath` is not exported.

- [ ] **Step 3: Implement the smallest upload flow**

`ProfileAvatar` validates the selected File, uploads to `avatarPath(profile.id)` with `upsert: true`, calls `setProfileAvatar`, and reports upload errors inline. `Avatar` fetches a signed URL through the existing browser Supabase client and shows the name initial until it resolves. Replace initials in the two sidebars and profile form with the shared component.

- [ ] **Step 4: Run tests to verify it passes**

Run: `pnpm test tests/avatar.test.ts tests/schemas.test.ts`

Expected: PASS.

### Task 3: Apply C member-directory design

**Files:**
- Modify: `src/app/admin/members/page.tsx`
- Modify: `src/app/admin/members/MemberFilters.tsx`
- Modify: `src/app/admin/members/MemberRow.tsx`

**Interfaces:**
- `MemberFilters` retains the `q`, `role`, `status` query contract.
- `MemberRow` retains its dialog, member action calls, and role/status semantics.

- [ ] **Step 1: Preserve and verify the existing member route contract**

Run: `pnpm test`

Expected: existing suite passes before style-only changes.

- [ ] **Step 2: Implement C’s visual rules**

Remove only the two enclosing Cards from the non-empty members view. Use one light rule between the header, filters, and table; give rows slightly more vertical space; use the shared Avatar next to each name; keep the existing eight columns and horizontal overflow behavior.

- [ ] **Step 3: Verify changed behavior and types**

Run: `pnpm test && pnpm exec tsc --noEmit`

Expected: PASS with no TypeScript errors.

### Task 4: Review

**Files:**
- Review: `git diff --check`

- [ ] **Step 1: Check the diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Manually verify**

Check `/profile` with no avatar and with each accepted file type; reject GIF and files over 5MB; check replacement; check the signed image in both sidebars and `/admin/members`; check member filters, row link, row dialog, keyboard focus, and a narrow table viewport.
