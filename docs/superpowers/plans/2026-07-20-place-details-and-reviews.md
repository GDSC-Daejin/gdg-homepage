# 장소 상세·리뷰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원 이벤트 상세에서 장소의 관리자 입력 정보와 멤버 리뷰를 보여주고, 관리자가 기존 장소 화면에서 정보·리뷰 삭제 요청을 관리한다.

**Architecture:** `places`는 전화번호·운영시간 등 관리자가 편집하는 상세 필드를 가진다. 새 `place_reviews`는 장소·작성자별 한 건을 DB 제약과 RLS로 보장하고, 서버 액션이 작성·수정·삭제 요청·관리자 처리를 담당한다. 회원 이벤트 상세는 연결된 place와 리뷰를 읽어 표시하고, `/admin/places`는 같은 데이터를 요약·관리한다.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19, Supabase Postgres/RLS, Zod 4, Vitest, Tailwind CSS v4.

## Global Constraints

- 네이버 장소 자동 수집, 사진 업로드, 외부 이동·딥링크는 구현하지 않는다.
- 장소 기본 정보 쓰기는 관리자만, 리뷰 작성·수정은 로그인한 멤버와 관리자 모두 가능하다.
- 리뷰는 장소·작성자별 한 건이며 별점은 1~5점, 후기는 1~500자다.
- 멤버는 리뷰를 직접 삭제하지 않고 삭제 요청만 남긴다. 실제 삭제·반려는 관리자만 한다.
- `place_id` 없는 과거 이벤트는 기존 장소 텍스트와 지도만 유지한다.
- 새 라이브러리를 추가하지 않고 기존 `Card`, `Badge`, `Button`, `Input`, `Textarea`, `Select`를 사용한다.
- UI 문구는 한국어, TypeScript strict와 관련 Vitest를 통과해야 한다.

---

### Task 1: 장소 상세·리뷰 스키마와 공유 타입

**Files:**
- Create: `supabase/migrations/0034_place_details_reviews.sql`
- Modify: `src/lib/types.ts`
- Create: `tests/place-reviews-migration.test.ts`

**Interfaces:**
- Produces `Place`의 `phone`, `hours`, `website`, `amenities`, `description` 선택 필드.
- Produces `PlaceReview { id, place_id, user_id, rating, body, delete_requested_at, created_at, updated_at }` and `PlaceReviewWithAuthor`.

- [ ] **Step 1: 실패하는 마이그레이션·타입 테스트 작성**

```ts
// tests/place-reviews-migration.test.ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("장소 상세·리뷰 마이그레이션", () => {
  it("장소 상세와 장소별 멤버 1건 리뷰 권한을 정의한다", async () => {
    const sql = await readFile("supabase/migrations/0034_place_details_reviews.sql", "utf8");
    const types = await readFile("src/lib/types.ts", "utf8");

    expect(sql).toContain("add column phone text not null default ''");
    expect(sql).toContain("create table public.place_reviews");
    expect(sql).toContain("unique (place_id, user_id)");
    expect(sql).toContain("check (rating between 1 and 5)");
    expect(sql).toContain('"place_reviews: own insert"');
    expect(sql).toContain('"place_reviews: own update"');
    expect(sql).toContain('"place_reviews: admin update"');
    expect(sql).toContain('"place_reviews: admin delete"');
    expect(types).toContain("export interface PlaceReview");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test tests/place-reviews-migration.test.ts`

Expected: FAIL — migration file does not exist.

- [ ] **Step 3: 마이그레이션과 타입 최소 구현**

```sql
-- supabase/migrations/0034_place_details_reviews.sql
alter table public.places
  add column phone text not null default '',
  add column hours text not null default '',
  add column website text not null default '',
  add column amenities text not null default '',
  add column description text not null default '';

create table public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 500),
  delete_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create index place_reviews_place_created_idx
  on public.place_reviews (place_id, created_at desc);
create index place_reviews_delete_requested_idx
  on public.place_reviews (delete_requested_at)
  where delete_requested_at is not null;

alter table public.place_reviews enable row level security;
create policy "place_reviews: member read" on public.place_reviews
  for select using (auth.uid() is not null);
create policy "place_reviews: own insert" on public.place_reviews
  for insert with check (user_id = auth.uid());
create policy "place_reviews: own update" on public.place_reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "place_reviews: admin update" on public.place_reviews
  for update using (public.is_admin()) with check (public.is_admin());
create policy "place_reviews: admin delete" on public.place_reviews
  for delete using (public.is_admin());
```

```ts
// src/lib/types.ts — Place 뒤에 추가
export interface PlaceReview {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  body: string;
  delete_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PlaceReviewWithAuthor = PlaceReview & {
  profile: Pick<Profile, "name"> | null;
};
```

`Place`에는 아래 다섯 필드를 `created_at` 앞에 추가한다.

```ts
  phone: string;
  hours: string;
  website: string;
  amenities: string;
  description: string;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test tests/place-reviews-migration.test.ts`

Expected: PASS (1 test).

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0034_place_details_reviews.sql src/lib/types.ts tests/place-reviews-migration.test.ts
git commit -m "장소 상세와 리뷰 스키마 추가"
```

---

### Task 2: 리뷰 검증·서버 액션

**Files:**
- Modify: `src/lib/schemas.ts`
- Create: `src/actions/place-review.ts`
- Create: `tests/place-review-schema.test.ts`

**Interfaces:**
- Consumes `requireProfile`, `requireAdmin`, `createClient`, `isDemoMode`, `ActionResult`.
- Produces `upsertPlaceReview(placeId, formData)`, `requestPlaceReviewDeletion(reviewId)`, `resolvePlaceReviewDeletion(reviewId, remove)`.

- [ ] **Step 1: 실패하는 리뷰 입력 검증 테스트 작성**

```ts
// tests/place-review-schema.test.ts
import { describe, expect, it } from "vitest";
import { placeReviewSchema } from "@/lib/schemas";

describe("placeReviewSchema", () => {
  it("1~5점과 공백을 제거한 후기를 받는다", () => {
    expect(placeReviewSchema.parse({ rating: "5", body: "  좋았어요  " })).toEqual({
      rating: 5,
      body: "좋았어요",
    });
  });

  it("점수와 빈 후기를 거부한다", () => {
    expect(placeReviewSchema.safeParse({ rating: "0", body: "후기" }).success).toBe(false);
    expect(placeReviewSchema.safeParse({ rating: "3", body: "   " }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test tests/place-review-schema.test.ts`

Expected: FAIL — `placeReviewSchema` is not exported.

- [ ] **Step 3: 스키마와 액션 구현**

```ts
// src/lib/schemas.ts — 마지막에 추가
export const placeReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "별점을 선택해주세요").max(5),
  body: z.string().trim().min(1, "후기를 입력해주세요").max(500, "후기는 500자 이내로 입력해주세요"),
});
```

```ts
// src/actions/place-review.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { placeReviewSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const uuid = z.string().uuid();

function revalidatePlaceViews() {
  revalidatePath("/events/[id]", "page");
  revalidatePath("/admin/places");
}

export async function upsertPlaceReview(placeId: string, formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode()) return {};
  if (!uuid.safeParse(placeId).success) return { error: "요청이 올바르지 않습니다" };
  const parsed = placeReviewSchema.safeParse({
    rating: formData.get("rating"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("place_reviews").upsert(
    { place_id: placeId, user_id: profile.id, ...parsed.data, updated_at: new Date().toISOString() },
    { onConflict: "place_id,user_id" },
  );
  if (error) return { error: toKoreanError(error) };
  revalidatePlaceViews();
  return {};
}

export async function requestPlaceReviewDeletion(reviewId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode()) return {};
  if (!uuid.safeParse(reviewId).success) return { error: "요청이 올바르지 않습니다" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("place_reviews")
    .update({ delete_requested_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("user_id", profile.id);
  if (error) return { error: toKoreanError(error) };
  revalidatePlaceViews();
  return {};
}

export async function resolvePlaceReviewDeletion(reviewId: string, remove: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  if (!uuid.safeParse(reviewId).success) return { error: "요청이 올바르지 않습니다" };
  const supabase = await createClient();
  const { error } = remove
    ? await supabase.from("place_reviews").delete().eq("id", reviewId)
    : await supabase.from("place_reviews").update({ delete_requested_at: null }).eq("id", reviewId);
  if (error) return { error: toKoreanError(error) };
  revalidatePlaceViews();
  return {};
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test tests/place-review-schema.test.ts`

Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/schemas.ts src/actions/place-review.ts tests/place-review-schema.test.ts
git commit -m "장소 리뷰 작성과 삭제 요청 추가"
```

---

### Task 3: 관리자 장소 정보·리뷰 대시보드

**Files:**
- Modify: `src/actions/place.ts`
- Modify: `src/app/admin/places/page.tsx`
- Modify: `src/app/admin/places/PlaceManager.tsx`
- Create: `src/app/admin/places/PlaceReviewRequests.tsx`
- Create: `tests/admin-places-dashboard.test.ts`

**Interfaces:**
- Consumes `Place`, `PlaceReviewWithAuthor`, `resolvePlaceReviewDeletion`.
- Produces 관리자 장소 수정 폼의 다섯 상세 필드, 장소·리뷰·삭제 요청 요약, 삭제 요청 처리 UI.

- [ ] **Step 1: 실패하는 관리자 표면 테스트 작성**

```ts
// tests/admin-places-dashboard.test.ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("관리자 장소 대시보드", () => {
  it("장소 상세 입력과 리뷰 삭제 요청 처리를 제공한다", async () => {
    const manager = await readFile("src/app/admin/places/PlaceManager.tsx", "utf8");
    const requests = await readFile("src/app/admin/places/PlaceReviewRequests.tsx", "utf8");

    expect(manager).toContain('name="phone"');
    expect(manager).toContain('name="hours"');
    expect(manager).toContain("전체 리뷰");
    expect(requests).toContain("삭제 요청");
    expect(requests).toContain("삭제 승인");
    expect(requests).toContain("요청 반려");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test tests/admin-places-dashboard.test.ts`

Expected: FAIL — `PlaceReviewRequests.tsx` does not exist.

- [ ] **Step 3: 장소 액션이 상세 필드를 저장하도록 확장**

`readPlaceForm`의 반환값에 아래 값을 추가하고, `createPlace` insert·`updatePlace`의 `updates`에 그대로 사용한다.

```ts
    phone: String(formData.get("phone") ?? "").trim(),
    hours: String(formData.get("hours") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    amenities: String(formData.get("amenities") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
```

- [ ] **Step 4: 관리자 조회와 요약 데이터 추가**

`src/app/admin/places/page.tsx`에서 `places` 조회 뒤 `place_reviews`를 한 번 조회한다.

```ts
const { data: reviewRows } = await supabase
  .from("place_reviews")
  .select("id, place_id, user_id, rating, body, delete_requested_at, created_at, updated_at, profile:profiles(name)")
  .order("created_at", { ascending: false });
```

`PlaceManager`에는 `reviews`를 전달한다. `PlaceManager` 안에서 `reduce`로 `placeId`별 리뷰 수·별점 합계·삭제 요청 수를 계산해 상단에 `전체 장소`, `전체 리뷰`, `삭제 요청` 3개를 표시한다. 각 장소 행에는 `평균 N.N · 리뷰 N`과 삭제 요청 배지를 붙인다.

- [ ] **Step 5: 상세 입력과 삭제 요청 컴포넌트 구현**

`PlaceManager`의 추가/수정 폼에 아래 입력을 넣는다. 생성 폼과 수정 폼 모두 같은 필드를 가진다.

```tsx
<Input name="phone" label="전화번호" type="tel" />
<Input name="hours" label="운영시간" placeholder="예) 평일 09:00~18:00" />
<Input name="website" label="웹사이트" type="url" />
<Input name="amenities" label="편의시설" placeholder="예) 주차, 와이파이" />
<Textarea name="description" label="장소 소개" rows={3} />
```

`PlaceReviewRequests`는 `delete_requested_at !== null`인 리뷰만 받고, 리뷰 본문·작성자·장소명을 보여준다. 각 행의 버튼은 아래처럼 `resolvePlaceReviewDeletion`을 호출한 뒤 `router.refresh()`한다.

```tsx
<Button type="button" size="sm" variant="danger" onClick={() => run(true)}>
  삭제 승인
</Button>
<Button type="button" size="sm" variant="secondary" onClick={() => run(false)}>
  요청 반려
</Button>
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm test tests/admin-places-dashboard.test.ts`

Expected: PASS (1 test).

- [ ] **Step 7: 커밋**

```bash
git add src/actions/place.ts src/app/admin/places/page.tsx src/app/admin/places/PlaceManager.tsx src/app/admin/places/PlaceReviewRequests.tsx tests/admin-places-dashboard.test.ts
git commit -m "관리자 장소 상세와 리뷰 대시보드 추가"
```

---

### Task 4: 회원 이벤트 상세의 장소 정보와 리뷰

**Files:**
- Create: `src/components/PlaceDetails.tsx`
- Create: `src/components/PlaceReviewForm.tsx`
- Modify: `src/app/(member)/events/[id]/page.tsx`
- Create: `tests/place-details-surface.test.ts`

**Interfaces:**
- Consumes `Place`, `PlaceReviewWithAuthor`, 현재 `Profile`, `upsertPlaceReview`, `requestPlaceReviewDeletion`.
- Produces `PlaceDetails({ place, reviews, profile })`, 장소 상세·평균 별점·리뷰 목록·내 리뷰 입력 UI.

- [ ] **Step 1: 실패하는 회원 화면 표면 테스트 작성**

```ts
// tests/place-details-surface.test.ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 장소 상세", () => {
  it("연결된 장소의 상세와 리뷰 폼을 렌더한다", async () => {
    const page = await readFile("src/app/(member)/events/[id]/page.tsx", "utf8");
    const details = await readFile("src/components/PlaceDetails.tsx", "utf8");
    const form = await readFile("src/components/PlaceReviewForm.tsx", "utf8");

    expect(page).toContain("<PlaceDetails");
    expect(details).toContain("평균 별점");
    expect(details).toContain("리뷰");
    expect(form).toContain('name="rating"');
    expect(form).toContain('name="body"');
    expect(form).toContain("삭제 요청");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test tests/place-details-surface.test.ts`

Expected: FAIL — `PlaceDetails.tsx` does not exist.

- [ ] **Step 3: 장소 상세 서버 컴포넌트 구현**

`PlaceDetails`는 `Card` 안에서 장소명과 값이 있는 `phone`, `hours`, `website`, `amenities`, `description`만 표시한다. `website`는 `target="_blank" rel="noopener noreferrer"` 링크로 만든다. 리뷰 평균은 `reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length`로 계산해 `reviews.length === 0`이면 `아직 리뷰가 없어요`를 표시한다.

리뷰 목록은 `created_at` 최신순으로 `profile?.name ?? "알 수 없는 멤버"`, 별점, 본문, `formatKst(review.created_at)`를 보여준다. 현재 프로필의 리뷰에는 `PlaceReviewForm`에 기존 값을 넘기고, 삭제 요청 시 `삭제 요청됨` 상태를 보여준다.

- [ ] **Step 4: 리뷰 폼 클라이언트 컴포넌트 구현**

```tsx
<form action={(fd) => run(() => upsertPlaceReview(placeId, fd))} className="flex flex-col gap-3">
  <Select name="rating" label="별점" defaultValue={review ? String(review.rating) : ""} required>
    <option value="" disabled>별점을 선택해주세요</option>
    <option value="5">5점</option>
    <option value="4">4점</option>
    <option value="3">3점</option>
    <option value="2">2점</option>
    <option value="1">1점</option>
  </Select>
  <Textarea name="body" label="후기" defaultValue={review?.body} maxLength={500} rows={3} required />
  <Button type="submit" variant="primary" disabled={pending}>
    {review ? "리뷰 수정" : "리뷰 등록"}
  </Button>
</form>
```

기존 리뷰가 있고 삭제 요청 전이면 별도 `삭제 요청` 버튼을 노출한다. 클릭은 `requestPlaceReviewDeletion(review.id)`만 호출하고, 즉시 삭제하지 않는다.

- [ ] **Step 5: 이벤트 상세 쿼리와 렌더 연결**

`src/app/(member)/events/[id]/page.tsx`의 관계 조회를 `place:places(*)`로 넓히고 `Place` 타입으로 캐스팅한다. `e.place`가 있을 때만 지도 카드 바로 뒤에 아래를 렌더한다.

```tsx
<PlaceDetails place={e.place} reviews={reviews} profile={profile} />
```

리뷰 조회는 `e.place`가 있을 때만 실행한다.

```ts
let reviewRows: PlaceReviewWithAuthor[] = [];
if (e.place) {
  const { data } = await supabase
    .from("place_reviews")
    .select("id, place_id, user_id, rating, body, delete_requested_at, created_at, updated_at, profile:profiles(name)")
    .eq("place_id", e.place.id)
    .order("created_at", { ascending: false });
  reviewRows = (data ?? []) as PlaceReviewWithAuthor[];
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm test tests/place-details-surface.test.ts`

Expected: PASS (1 test).

- [ ] **Step 7: 커밋**

```bash
git add src/components/PlaceDetails.tsx src/components/PlaceReviewForm.tsx "src/app/(member)/events/[id]/page.tsx" tests/place-details-surface.test.ts
git commit -m "이벤트 장소 상세와 멤버 리뷰 표시"
```

---

### Task 5: 전체 검증

**Files:**
- Verify only: 변경된 migration, actions, components, tests.

- [ ] **Step 1: 새 테스트 묶음 실행**

Run: `pnpm test tests/place-reviews-migration.test.ts tests/place-review-schema.test.ts tests/admin-places-dashboard.test.ts tests/place-details-surface.test.ts`

Expected: all tests pass.

- [ ] **Step 2: 전체 테스트와 타입 검사 실행**

Run: `pnpm test && pnpm exec tsc --noEmit && git diff --check`

Expected: all tests pass, TypeScript exits 0, no whitespace errors.

- [ ] **Step 3: 수동 권한·화면 확인**

1. 관리자로 `/admin/places`에서 상세 정보 저장, 리뷰 요약과 삭제 요청 처리 확인.
2. 멤버로 연결된 이벤트 상세에서 별점·후기 생성과 수정 확인.
3. 멤버가 삭제 요청을 남기면 목록에는 남고, 관리자 승인 뒤 사라지는지 확인.
4. `place_id` 없는 이벤트에서 새 장소 상세 카드가 렌더되지 않는지 확인.
