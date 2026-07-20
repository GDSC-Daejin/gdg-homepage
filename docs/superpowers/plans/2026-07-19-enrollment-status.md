# 재학 여부 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원과 지원자의 재학 여부를 재학·휴학·졸업으로 저장하고, 사용자·관리자 화면에서 입력·수정·표시한다.

**Architecture:** `profiles`와 익명 공개 지원서인 `applications`에 같은 문자열 상태를 독립적으로 저장한다. Zod 스키마가 서버 입력을 검증하고, 사용자 프로필은 기존 직접 업데이트 권한으로, 관리자는 기존 `admin_update_profile` RPC로 값을 저장한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Zod, Supabase SQL, Vitest

## Global Constraints

- 상태값은 `enrolled`, `leave_of_absence`, `graduated` 세 개만 허용한다.
- 기존 `profiles`와 `applications` 행의 기본값은 `enrolled`이다.
- 공개 지원서는 익명 행이므로 지원서와 회원 프로필을 자동 연결하지 않는다.
- 새 의존성이나 새 추상화는 추가하지 않는다.
- `packages/api`와 `docs/backend/openapi.json`은 수정하지 않는다.

---

## File Structure

- `supabase/migrations/0028_enrollment_status.sql`: 두 테이블의 컬럼·제약·권한과 관리자 RPC 시그니처를 변경한다.
- `src/lib/types.ts`: 상태 유니온과 한글 레이블, `Profile`·`Application` 필드를 제공한다.
- `src/lib/schemas.ts`: 사용자 프로필과 공개 지원서의 상태 입력을 검증한다.
- `src/actions/profile.ts`, `src/actions/application.ts`, `src/actions/member.ts`: 검증된 값을 각 저장 경로로 전달한다.
- `src/app/(member)/onboarding/OnboardingForm.tsx`, `src/app/(member)/profile/ProfileForm.tsx`, `src/app/apply/ApplyForm.tsx`: 사용자 입력을 받는다.
- `src/app/admin/members/*`: 목록 표시와 두 관리자 프로필 수정 화면을 연결한다.
- `src/lib/demoData.ts`: `Profile`과 `Application` 데모 데이터를 새 필수 필드에 맞춘다.
- `tests/enrollment-status-migration.test.ts`, `tests/schemas.test.ts`: 마이그레이션과 서버 검증을 회귀 테스트한다.

### Task 1: 데이터베이스 계약

**Files:**
- Create: `tests/enrollment-status-migration.test.ts`
- Create: `supabase/migrations/0028_enrollment_status.sql`

**Interfaces:**
- Produces: `profiles.enrollment_status text not null`, `applications.enrollment_status text not null`
- Produces: `admin_update_profile(uuid, text, text, text, text, text, text, text[])`

- [ ] **Step 1: 마이그레이션 계약의 실패 테스트를 작성한다.**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("재학 여부 마이그레이션", () => {
  it("회원과 지원서에 같은 재학 여부 제약을 추가한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0028_enrollment_status.sql",
      "utf8",
    );

    expect(migration).toContain("add column enrollment_status text not null default 'enrolled'");
    expect(migration).toContain("check (enrollment_status in ('enrolled', 'leave_of_absence', 'graduated'))");
    expect(migration).toContain("grant update (enrollment_status) on public.profiles to authenticated");
    expect(migration).toContain("p_enrollment_status text");
    expect(migration).toContain("enrollment_status = p_enrollment_status");
  });
});
```

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm test tests/enrollment-status-migration.test.ts`

Expected: `ENOENT` because `0028_enrollment_status.sql` does not exist.

- [ ] **Step 3: 최소 마이그레이션을 작성한다.**

```sql
alter table public.profiles
  add column enrollment_status text not null default 'enrolled'
  check (enrollment_status in ('enrolled', 'leave_of_absence', 'graduated'));

alter table public.applications
  add column enrollment_status text not null default 'enrolled'
  check (enrollment_status in ('enrolled', 'leave_of_absence', 'graduated'));

grant update (enrollment_status) on public.profiles to authenticated;

drop function if exists public.admin_update_profile(uuid, text, text, text, text, text, text[]);

create or replace function public.admin_update_profile(
  p_user uuid,
  p_name text,
  p_nickname text,
  p_student_no text,
  p_major text,
  p_phone text,
  p_enrollment_status text,
  p_interests text[]
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_enrollment_status not in ('enrolled', 'leave_of_absence', 'graduated') then
    raise exception 'INVALID_INPUT';
  end if;
  update profiles set
    name = p_name,
    nickname = p_nickname,
    student_no = p_student_no,
    major = p_major,
    phone = p_phone,
    enrollment_status = p_enrollment_status,
    interests = p_interests
  where id = p_user;
end $$;

grant execute on function public.admin_update_profile(uuid, text, text, text, text, text, text, text[])
to authenticated;
```

- [ ] **Step 4: 테스트 통과를 확인한다.**

Run: `pnpm test tests/enrollment-status-migration.test.ts`

Expected: `1 passed`.

- [ ] **Step 5: 커밋한다.**

```bash
git add tests/enrollment-status-migration.test.ts supabase/migrations/0028_enrollment_status.sql
git commit -m "재학 여부 데이터 계약 추가"
```

### Task 2: 서버 타입·검증·저장 경로

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/actions/profile.ts`
- Modify: `src/actions/application.ts`
- Modify: `src/actions/member.ts`
- Modify: `src/lib/demoData.ts`
- Modify: `tests/schemas.test.ts`

**Interfaces:**
- Produces: `type EnrollmentStatus = "enrolled" | "leave_of_absence" | "graduated"`
- Produces: `ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string>`
- Consumes: form field `enrollment_status`

- [ ] **Step 1: 재학 여부 검증의 실패 테스트를 추가한다.**

```ts
it("재학 여부가 없거나 허용값이 아니면 reject한다", () => {
  const valid = {
    name: "홍길동",
    nickname: "Gildong",
    student_no: "202012345",
    major: "컴퓨터공학과",
    phone: "010-1234-5678",
    interests: [],
    position: "frontend",
    enrollment_status: "enrolled",
  };

  expect(profileSchema.safeParse({ ...valid, enrollment_status: undefined }).success).toBe(false);
  expect(profileSchema.safeParse({ ...valid, enrollment_status: "graduate" }).success).toBe(false);
});

it("공개 지원서는 재학 여부를 요구한다", () => {
  const valid = {
    applicant_name: "홍길동",
    student_no: "20241001",
    major: "컴퓨터공학과",
    phone: "010-1234-5678",
    email: "hong@dju.ac.kr",
    season: "2026-2",
    answers: { intro: "a", motivation: "b", interest: "c" },
    position: "frontend",
    enrollment_status: "leave_of_absence",
  };

  expect(applicationSchema.safeParse(valid).success).toBe(false);
  expect(applicationSchema.safeParse({ ...valid, enrollment_status: "graduate" }).success).toBe(false);
});
```

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm test tests/schemas.test.ts`

Expected: 새 프로필 테스트는 `true`를 받았다는 이유로, 새 지원서 테스트는 `false`를 받았다는 이유로 실패한다.

- [ ] **Step 3: 타입과 스키마를 추가한다.**

```ts
export type EnrollmentStatus = "enrolled" | "leave_of_absence" | "graduated";
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  enrolled: "재학",
  leave_of_absence: "휴학",
  graduated: "졸업",
};
```

`Profile`과 `Application`에 `enrollment_status: EnrollmentStatus`를 추가하고, 두 Zod 스키마에 아래 필드를 추가한다.

```ts
enrollment_status: z.enum(["enrolled", "leave_of_absence", "graduated"], {
  message: "재학 여부를 선택해주세요",
}),
```

- [ ] **Step 4: 기존 저장 경로에 검증된 값을 전달한다.**

`updateProfile`의 `profileSchema.safeParse` 입력에 아래 한 줄을 추가한다.

```ts
enrollment_status: formData.get("enrollment_status"),
```

`submitApplication`의 `applicationSchema.safeParse` 입력과 `applications.insert` 객체에 각각 아래 값을 추가한다.

```ts
enrollment_status: String(formData.get("enrollment_status") ?? ""),
```

```ts
enrollment_status: parsed.data.enrollment_status,
```

`updateMemberProfile`의 `Pick<Profile, ...>`에 `"enrollment_status"`를 넣고 RPC 인자에 아래 줄을 추가한다.

```ts
p_enrollment_status: profile.enrollment_status,
```

모든 `DEMO_MEMBERS`와 `DEMO_APPLICATIONS` 행에는 `enrollment_status: "enrolled"`를 넣는다.

- [ ] **Step 5: 테스트 통과를 확인한다.**

Run: `pnpm test tests/schemas.test.ts`

Expected: 모든 `profileSchema` 및 `applicationSchema` 테스트가 통과한다.

- [ ] **Step 6: 커밋한다.**

```bash
git add src/lib/types.ts src/lib/schemas.ts src/actions/profile.ts src/actions/application.ts src/actions/member.ts src/lib/demoData.ts tests/schemas.test.ts
git commit -m "재학 여부 입력 검증 추가"
```

### Task 3: 사용자·관리자 화면 연결

**Files:**
- Modify: `src/app/(member)/onboarding/OnboardingForm.tsx`
- Modify: `src/app/(member)/profile/ProfileForm.tsx`
- Modify: `src/app/apply/ApplyForm.tsx`
- Modify: `src/app/admin/members/page.tsx`
- Modify: `src/app/admin/members/MemberRow.tsx`
- Modify: `src/app/admin/members/[id]/page.tsx`
- Modify: `src/app/admin/members/[id]/MemberProfileForm.tsx`

**Interfaces:**
- Consumes: `EnrollmentStatus`, `ENROLLMENT_STATUS_LABELS`, `Profile.enrollment_status`
- Consumes: server action field `enrollment_status`

- [ ] **Step 1: 공통 선택지의 실패 조건을 정한다.**

브라우저에서 각 폼을 열었을 때 `재학 여부`가 선택되지 않으면 기본 HTML 필수 입력 검사가 제출을 막아야 한다. 이 저장소에는 폼 렌더링을 검증하는 React 테스트 환경이 없으므로, 이 UI 연결은 서버 스키마 테스트(Task 2)와 TypeScript 검사로 검증한다.

- [ ] **Step 2: 온보딩·프로필·지원서에 같은 필수 `<Select>`를 추가한다.**

각 폼에 아래 선택지를 추가한다. 내 프로필은 `defaultValue={profile.enrollment_status}`를 사용하고, 온보딩·지원서는 빈 기본값을 사용한다.

```tsx
<Select name="enrollment_status" label="재학 여부" defaultValue="" required>
  <option value="" disabled>
    선택
  </option>
  <option value="enrolled">재학</option>
  <option value="leave_of_absence">휴학</option>
  <option value="graduated">졸업</option>
</Select>
```

- [ ] **Step 3: 회원 관리 테이블과 수정 폼을 연결한다.**

`src/app/admin/members/page.tsx`의 테이블 머리글에서 `전공` 뒤에 `재학 여부`를 추가한다.

```tsx
<th className="px-4 py-3 font-medium">재학 여부</th>
```

`MemberRow`에서 `ENROLLMENT_STATUS_LABELS`를 import하고, `전공` 셀 뒤에 아래 셀을 추가한다.

```tsx
<td className="px-4 py-3 text-gray-700">
  {ENROLLMENT_STATUS_LABELS[member.enrollment_status]}
</td>
```

`MemberRow`의 프로필 수정 상태와 `updateMemberProfile` 호출에 `enrollmentStatus`와 `enrollment_status: enrollmentStatus`를 추가하고, 모달 입력에는 아래 선택지를 넣는다.

```tsx
<Select
  label="재학 여부"
  value={enrollmentStatus}
  onChange={(e) => setEnrollmentStatus(e.target.value as EnrollmentStatus)}
  disabled={profilePending}
>
  <option value="enrolled">재학</option>
  <option value="leave_of_absence">휴학</option>
  <option value="graduated">졸업</option>
</Select>
```

`MemberProfileForm`에 `enrollmentStatus: EnrollmentStatus` prop·state·동일 선택지를 추가하고, 상세 페이지에서 `member.enrollment_status`를 전달한다.

- [ ] **Step 4: 타입 검사를 실행해 UI 연결을 검증한다.**

Run: `pnpm exec tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 5: 수동 흐름을 확인한다.**

Run: `pnpm dev`

Expected:

1. `/onboarding`에서 재학 여부를 선택하지 않으면 제출되지 않고, 선택하면 저장된다.
2. `/profile`에서 값이 표시되고 변경 후 새로고침해도 유지된다.
3. `/apply` 제출 시 선택값이 저장된다.
4. `/admin/members` 테이블에 한글 상태가 보이고, 행 모달과 상세 페이지에서 수정 후 반영된다.

- [ ] **Step 6: 커밋한다.**

```bash
git add src/app/'(member)'/onboarding/OnboardingForm.tsx src/app/'(member)'/profile/ProfileForm.tsx src/app/apply/ApplyForm.tsx src/app/admin/members/page.tsx src/app/admin/members/MemberRow.tsx src/app/admin/members/'[id]'/page.tsx src/app/admin/members/'[id]'/MemberProfileForm.tsx
git commit -m "재학 여부 입력 화면 연결"
```

### Task 4: 전체 회귀 검증

**Files:**
- Modify: 변경 없음

**Interfaces:**
- Consumes: Tasks 1–3의 마이그레이션, 스키마, 화면

- [ ] **Step 1: 전체 테스트를 실행한다.**

Run: `pnpm test`

Expected: exit code 0.

- [ ] **Step 2: 최종 타입·공백 검사를 실행한다.**

Run: `pnpm exec tsc --noEmit && git diff --check`

Expected: exit code 0.

- [ ] **Step 3: 변경 범위를 확인한다.**

Run: `git status --short && git diff --stat HEAD`

Expected: 재학 여부 기능 파일만 새로 수정되며, 사용자의 기존 변경은 건드리지 않는다.
