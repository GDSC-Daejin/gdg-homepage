# 포인트 상점 (Points Store) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원이 적립한 포인트를 실물/디지털 보상으로 교환하는 상점(신청→어드민 전달완료 1단계)을 만들고, 전달완료 시 상품 원가를 조직 예산(`budget_entries`)에 expense로 자동 반영한다.

**Architecture:** 단일 원장 방식 — 신청 순간 `point_logs`에 음수 레코드로 즉시 차감(hold), 거절/취소 시 양수 환불. 모든 상태 변경은 `security definer` RPC(트랜잭션·`for update` 잠금)로만 수행하고, 서버 액션은 기존 `points.ts`/`budget.ts` 골격(`requireAdmin`/로그인 → `isDemoMode` → Zod → RPC → `toKoreanError` → `revalidatePath`)을 그대로 따른다. 화면은 서버 컴포넌트 + `isDemoMode()` 분기.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Supabase(RLS/RPC, plpgsql) · Zod · Tailwind v4 · vitest

**참조 스펙:** [docs/superpowers/specs/2026-07-19-points-store-design.md](../specs/2026-07-19-points-store-design.md)

## Global Constraints

- `AGENTS.md`: Next.js 16 — 새 API 사용 전 `node_modules/next/dist/docs/` 확인.
- **마이그레이션 번호는 `0033`** (spec은 `0032`라 적었으나 `0032_admin_group_members.sql`이 이미 존재 → 다음 번호 `0033_points_store.sql`).
- 잔액은 기존과 동일하게 `SUM(point_logs.amount)`. 새 잔액 컬럼을 만들지 않는다.
- 상품 삭제는 `on delete restrict` + `is_active=false` 소프트 숨김. 주문에는 이름/가격/원가 **스냅샷** 저장.
- 쓰기는 RPC로만. 직접 INSERT/UPDATE는 RLS로 차단. RPC는 `revoke ... from public, anon; grant ... to authenticated` 패턴(0004 참조).
- `log_audit`는 호출하지 않는다 (감사 로깅은 `0031_disable_audit_logging.sql`로 비활성).
- 데모 모드: 페이지 로더는 `isDemoMode()` 분기로 데모 배열 반환, 서버 액션은 데모 시 `{}` no-op.
- 한국어 UI 카피. 기존 컴포넌트(`Card`, `StatCard`, `Input`, `Badge`, 폼 컴포넌트) 재사용, 신규 의존성 금지.
- 비-목표(YAGNI): 쿠폰 코드 풀, 승인/전달 2단계, 배송주소/결제, 카테고리/위시리스트/리뷰 — 만들지 않는다.

---

## Task 1: 마이그레이션 — 테이블 + RLS + 4개 RPC

**Files:**
- Create: `supabase/migrations/0033_points_store.sql`

**Produces:** 테이블 `store_items`, `point_redemptions`; RPC `request_redemption(uuid)`, `fulfill_redemption(uuid)`, `reject_redemption(uuid, text)`, `cancel_redemption(uuid)`.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 0033_points_store.sql : 포인트 상점 (상품 + 교환주문 + RPC)

create table public.store_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  price_points int not null check (price_points > 0),
  cost_krw int not null default 0 check (cost_krw >= 0),
  stock int not null default 0 check (stock >= 0),
  per_user_limit int,
  is_active bool not null default true,
  created_at timestamptz not null default now()
);

create table public.point_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.store_items(id) on delete restrict,
  item_name text not null,
  price_points int not null,
  cost_krw int not null,
  status text not null default 'pending'
    check (status in ('pending','fulfilled','rejected','canceled')),
  point_log_id uuid references public.point_logs(id),
  budget_entry_id uuid references public.budget_entries(id),
  note text not null default '',
  handled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

alter table public.store_items enable row level security;
alter table public.point_redemptions enable row level security;

-- store_items: 로그인 사용자는 활성 상품 조회, 어드민은 전체 + 쓰기
create policy "store_items: read active" on public.store_items
  for select using (is_active or public.is_admin());
create policy "store_items: admin all" on public.store_items
  for all using (public.is_admin()) with check (public.is_admin());

-- point_redemptions: 본인 or 어드민 조회. 쓰기는 RPC로만.
create policy "redemptions: own or admin" on public.point_redemptions
  for select using (user_id = auth.uid() or public.is_admin());

-- 회원: 교환 신청
create or replace function public.request_redemption(p_item uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_item store_items;
  v_balance int;
  v_used int;
  v_log_id uuid;
  v_redemption_id uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select * into v_item from store_items where id = p_item for update;
  if not found or not v_item.is_active then raise exception 'ITEM_UNAVAILABLE'; end if;
  if v_item.stock <= 0 then raise exception 'OUT_OF_STOCK'; end if;

  select coalesce(sum(amount), 0) into v_balance from point_logs where user_id = auth.uid();
  if v_balance < v_item.price_points then raise exception 'INSUFFICIENT_POINTS'; end if;

  if v_item.per_user_limit is not null then
    select count(*) into v_used from point_redemptions
      where user_id = auth.uid() and item_id = p_item
        and status not in ('rejected','canceled');
    if v_used >= v_item.per_user_limit then raise exception 'LIMIT_EXCEEDED'; end if;
  end if;

  insert into point_logs (user_id, amount, reason)
    values (auth.uid(), -v_item.price_points, '상점: ' || v_item.name)
    returning id into v_log_id;

  update store_items set stock = stock - 1 where id = p_item;

  insert into point_redemptions
    (user_id, item_id, item_name, price_points, cost_krw, status, point_log_id)
    values (auth.uid(), p_item, v_item.name, v_item.price_points, v_item.cost_krw, 'pending', v_log_id)
    returning id into v_redemption_id;

  return v_redemption_id;
end $$;

-- 어드민: 전달 완료
create or replace function public.fulfill_redemption(p_redemption uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_r point_redemptions;
  v_member_name text;
  v_budget_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_r from point_redemptions where id = p_redemption for update;
  if not found or v_r.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

  if v_r.cost_krw > 0 then
    select name into v_member_name from profiles where id = v_r.user_id;
    insert into budget_entries (entry_date, type, category, amount, memo, created_by)
      values (current_date, 'expense', '포인트 상점', v_r.cost_krw,
              v_r.item_name || ' / ' || coalesce(v_member_name, ''), auth.uid())
      returning id into v_budget_id;
  end if;

  update point_redemptions
    set status = 'fulfilled', handled_by = auth.uid(), handled_at = now(),
        budget_entry_id = v_budget_id
    where id = p_redemption;
end $$;

-- 어드민: 거절(환불 + 재고 복원)
create or replace function public.reject_redemption(p_redemption uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_r point_redemptions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_r from point_redemptions where id = p_redemption for update;
  if not found or v_r.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

  insert into point_logs (user_id, amount, reason)
    values (v_r.user_id, v_r.price_points, '상점 환불: ' || v_r.item_name);
  update store_items set stock = stock + 1 where id = v_r.item_id;
  update point_redemptions
    set status = 'rejected', note = p_note, handled_by = auth.uid(), handled_at = now()
    where id = p_redemption;
end $$;

-- 회원 본인: 취소(환불 + 재고 복원). pending & 본인만.
create or replace function public.cancel_redemption(p_redemption uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_r point_redemptions;
begin
  select * into v_r from point_redemptions where id = p_redemption for update;
  if not found or v_r.user_id <> auth.uid() or v_r.status <> 'pending' then
    raise exception 'NOT_CANCELABLE';
  end if;

  insert into point_logs (user_id, amount, reason)
    values (v_r.user_id, v_r.price_points, '상점 취소: ' || v_r.item_name);
  update store_items set stock = stock + 1 where id = v_r.item_id;
  update point_redemptions set status = 'canceled', handled_at = now()
    where id = p_redemption;
end $$;

-- EXECUTE 봉인 (Global Constraint)
revoke execute on function public.request_redemption(uuid) from public, anon;
revoke execute on function public.fulfill_redemption(uuid) from public, anon;
revoke execute on function public.reject_redemption(uuid, text) from public, anon;
revoke execute on function public.cancel_redemption(uuid) from public, anon;
grant execute on function
  public.request_redemption(uuid),
  public.fulfill_redemption(uuid),
  public.reject_redemption(uuid, text),
  public.cancel_redemption(uuid)
to authenticated;
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/0033_points_store.sql
git commit -m "feat: 포인트 상점 테이블·RLS·RPC 마이그레이션"
```

> 적용은 사람이 수행. 로컬 검증 가능하면 `supabase db reset` 후 `select public.request_redemption(...)` 스모크 확인.

---

## Task 2: 타입 정의

**Files:**
- Modify: `src/lib/types.ts` (`PointLog`/`Badge` 근처, 파일 하단)

**Consumes:** 없음. **Produces:** `StoreItem`, `RedemptionStatus`, `PointRedemption`.

- [ ] **Step 1: 타입 추가**

```typescript
export interface StoreItem {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price_points: number;
  cost_krw: number;
  stock: number;
  per_user_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export type RedemptionStatus = "pending" | "fulfilled" | "rejected" | "canceled";

export interface PointRedemption {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  price_points: number;
  cost_krw: number;
  status: RedemptionStatus;
  note: string;
  handled_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: 커밋** — `git commit -m "feat: 포인트 상점 타입 추가"`

---

## Task 3: Zod 스키마

**Files:**
- Modify: `src/lib/schemas.ts`
- Test: `tests/store-schema.test.ts`

**Consumes:** 없음. **Produces:** `storeItemSchema` (name, price_points, cost_krw, stock, per_user_limit, image_url).

- [ ] **Step 1: 실패 테스트 작성** — `tests/store-schema.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { storeItemSchema } from "@/lib/schemas";

describe("storeItemSchema", () => {
  it("정상 입력 통과", () => {
    const r = storeItemSchema.safeParse({
      name: "스티커", price_points: 100, cost_krw: 500,
      stock: 10, per_user_limit: 1, image_url: "",
    });
    expect(r.success).toBe(true);
  });
  it("price_points 0 이하 거부", () => {
    const r = storeItemSchema.safeParse({
      name: "x", price_points: 0, cost_krw: 0, stock: 0,
      per_user_limit: null, image_url: "",
    });
    expect(r.success).toBe(false);
  });
  it("이름 없으면 거부", () => {
    const r = storeItemSchema.safeParse({
      name: "", price_points: 100, cost_krw: 0, stock: 1,
      per_user_limit: null, image_url: "",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm vitest run tests/store-schema.test.ts` → FAIL (`storeItemSchema` 없음)

- [ ] **Step 3: 스키마 구현** — `src/lib/schemas.ts`에 추가 (기존 스키마 스타일 준수)

```typescript
export const storeItemSchema = z.object({
  name: z.string().trim().min(1, "상품명을 입력해주세요").max(60),
  description: z.string().trim().max(500).optional().default(""),
  price_points: z.coerce.number().int().positive("가격은 1 이상"),
  cost_krw: z.coerce.number().int().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  per_user_limit: z.coerce.number().int().positive().nullable().default(null),
  image_url: z.string().trim().url().or(z.literal("")).optional().default(""),
});
```

- [ ] **Step 4: 통과 확인** — `pnpm vitest run tests/store-schema.test.ts` → PASS

- [ ] **Step 5: 커밋** — `git add tests/store-schema.test.ts src/lib/schemas.ts && git commit -m "feat: 포인트 상점 상품 Zod 스키마 + 테스트"`

---

## Task 4: 서버 액션 `src/actions/store.ts`

**Files:**
- Create: `src/actions/store.ts`

**Consumes:** `storeItemSchema`(Task 3), RPC(Task 1), 기존 `requireAdmin`/`isDemoMode`/`toKoreanError`/`createClient`.
**Produces:** 회원 `requestRedemption(itemId)`, `cancelRedemption(id)`; 어드민 `createStoreItem(formData)`, `updateStoreItem(id, formData)`, `deleteStoreItem(id)`, `fulfillRedemption(id)`, `rejectRedemption(id, note)`.

- [ ] **Step 1: 액션 파일 작성** ( `points.ts` 골격 그대로. RPC 에러코드 → `toKoreanError`에 매핑 추가는 Step 2에서)

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { storeItemSchema } from "@/lib/schemas";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

// 회원 -------------------------------------------------
export async function requestRedemption(itemId: string): Promise<ActionResult> {
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_redemption", { p_item: itemId });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/store");
  revalidatePath("/store/orders");
  revalidatePath("/profile");
  return {};
}

export async function cancelRedemption(id: string): Promise<ActionResult> {
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_redemption", { p_redemption: id });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/store/orders");
  revalidatePath("/profile");
  return {};
}

// 어드민 -----------------------------------------------
export async function createStoreItem(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const parsed = storeItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("store_items").insert(parsed.data);
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/store");
  return {};
}

export async function updateStoreItem(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const parsed = storeItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("store_items").update(parsed.data).eq("id", id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/store");
  return {};
}

export async function deleteStoreItem(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  // 주문이 걸려 있으면 on delete restrict로 실패 → is_active=false 안내
  const { error } = await supabase.from("store_items").delete().eq("id", id);
  if (error) return { error: "주문 이력이 있는 상품은 삭제 대신 비활성화하세요" };
  revalidatePath("/admin/store");
  return {};
}

export async function fulfillRedemption(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("fulfill_redemption", { p_redemption: id });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/store");
  revalidatePath("/admin/budget");
  return {};
}

export async function rejectRedemption(id: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_redemption", { p_redemption: id, p_note: note });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/store");
  return {};
}
```

- [ ] **Step 2: `toKoreanError` 에러 메시지 매핑 추가** — `src/lib/errors.ts`에서 기존 매핑 표를 찾아 아래 키 추가(기존 관례대로):

```
ITEM_UNAVAILABLE   → "판매하지 않는 상품입니다"
OUT_OF_STOCK       → "품절된 상품입니다"
INSUFFICIENT_POINTS→ "포인트가 부족합니다"
LIMIT_EXCEEDED     → "구매 가능 횟수를 초과했습니다"
NOT_PENDING        → "이미 처리된 신청입니다"
NOT_CANCELABLE     → "취소할 수 없는 신청입니다"
```

- [ ] **Step 3: 타입체크** — `pnpm exec tsc --noEmit` (또는 `pnpm build`) 통과 확인

- [ ] **Step 4: 커밋** — `git add src/actions/store.ts src/lib/errors.ts && git commit -m "feat: 포인트 상점 서버 액션 + 한국어 에러 매핑"`

---

## Task 5: 데모 데이터

**Files:**
- Modify: `src/lib/demoData.ts`

**Produces:** `DEMO_STORE_ITEMS: StoreItem[]`, `DEMO_REDEMPTIONS: PointRedemption[]`.

- [ ] **Step 1: 데모 배열 추가** (기존 `DEMO_*` 배열 스타일·개수 관례에 맞춰 2~4개씩)

```typescript
import type { StoreItem, PointRedemption } from "@/lib/types";

export const DEMO_STORE_ITEMS: StoreItem[] = [
  { id: "demo-item-1", name: "GDG 스티커 팩", description: "홀로그램 스티커 5종",
    image_url: null, price_points: 50, cost_krw: 2000, stock: 20,
    per_user_limit: 2, is_active: true, created_at: "2026-07-01T00:00:00Z" },
  { id: "demo-item-2", name: "굿즈 티셔츠", description: "M/L 택1",
    image_url: null, price_points: 300, cost_krw: 12000, stock: 5,
    per_user_limit: 1, is_active: true, created_at: "2026-07-01T00:00:00Z" },
];

export const DEMO_REDEMPTIONS: PointRedemption[] = [
  { id: "demo-red-1", user_id: "demo-user", item_id: "demo-item-1",
    item_name: "GDG 스티커 팩", price_points: 50, cost_krw: 2000,
    status: "pending", note: "", handled_at: null, created_at: "2026-07-18T00:00:00Z" },
];
```

- [ ] **Step 2: 커밋** — `git commit -m "feat: 포인트 상점 데모 데이터"`

---

## Task 6: 회원 상점 페이지 `/(member)/store`

**Files:**
- Create: `src/app/(member)/store/page.tsx`
- Create: `src/app/(member)/store/RedeemButton.tsx` (client — 확인 후 `requestRedemption`)

**Consumes:** `requestRedemption`(Task 4), `DEMO_STORE_ITEMS`(Task 5), 잔액 = `SUM(point_logs.amount)`.

- [ ] **Step 1: 페이지 서버 컴포넌트 작성** — 잔액 + 활성 상품 그리드. `isDemoMode()`면 `DEMO_STORE_ITEMS` + 데모 잔액. 각 카드: 이미지(있으면)·이름·설명·`가격 P`·재고. 버튼 비활성 조건 계산: 잔액 부족 / 재고 0 → 사유 노출.

```tsx
// 데이터 로드 골격
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { DEMO_STORE_ITEMS } from "@/lib/demoData";
import type { StoreItem } from "@/lib/types";

async function load(): Promise<{ items: StoreItem[]; balance: number }> {
  if (await isDemoMode()) return { items: DEMO_STORE_ITEMS, balance: 120 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: items }, { data: logs }] = await Promise.all([
    supabase.from("store_items").select("*").eq("is_active", true).order("created_at"),
    supabase.from("point_logs").select("amount").eq("user_id", user!.id),
  ]);
  const balance = (logs ?? []).reduce((s, l) => s + l.amount, 0);
  return { items: (items ?? []) as StoreItem[], balance };
}
```

각 카드에서 `disabled = balance < item.price_points || item.stock <= 0`, 사유 텍스트 분기. 버튼은 `RedeemButton`(client).

- [ ] **Step 2: `RedeemButton` 작성** — `confirm` 후 `requestRedemption(itemId)` 호출, 결과 `error`면 표시. 기존 client 액션 버튼 패턴(예: `RegistrationPanel`/포인트 폼) 참조.

- [ ] **Step 3: 빌드 확인** — `pnpm build` 통과

- [ ] **Step 4: 커밋** — `git commit -m "feat: 회원 포인트 상점 페이지 + 신청 버튼"`

---

## Task 7: 내 신청 내역 `/(member)/store/orders` + 프로필 라벨 + 사이드바

**Files:**
- Create: `src/app/(member)/store/orders/page.tsx`
- Create: `src/app/(member)/store/orders/CancelButton.tsx` (client)
- Modify: `src/app/(member)/profile/page.tsx:85` (라벨만)
- Modify: `src/app/(member)/SidebarNav.tsx` ("활동" 섹션에 `/store`)

**Consumes:** `cancelRedemption`(Task 4), `DEMO_REDEMPTIONS`(Task 5).

- [ ] **Step 1: 주문 내역 페이지** — 본인 `point_redemptions` 최신순 + 상태 배지(pending/fulfilled/rejected/canceled). `isDemoMode()`면 `DEMO_REDEMPTIONS`. `pending` 행에만 `CancelButton`.

- [ ] **Step 2: `CancelButton`** — `confirm` 후 `cancelRedemption(id)`.

- [ ] **Step 3: 프로필 라벨 변경** — `src/app/(member)/profile/page.tsx:85`의 `누적 포인트` → `사용 가능 포인트`. **값·로직 변경 없음**(이미 음수 포함 `SUM`).

- [ ] **Step 4: 사이드바 링크** — `SidebarNav.tsx` "활동" 섹션에 `/store`("상점") 항목 추가. 기존 항목 스타일/아이콘 관례 준수.

- [ ] **Step 5: 빌드 확인 + 커밋** — `pnpm build` → `git commit -m "feat: 상점 주문 내역 + 프로필 라벨 + 사이드바 진입점"`

---

## Task 8: 어드민 상점 `/admin/store` + 사이드바

**Files:**
- Create: `src/app/admin/store/page.tsx`
- Create: `src/app/admin/store/StoreItemForm.tsx` (client — 생성/수정)
- Create: `src/app/admin/store/RedemptionActions.tsx` (client — 전달완료/거절)
- Modify: `src/app/admin/AdminSidebarNav.tsx` ("운영" 섹션, 포인트/예산 옆에 `/admin/store`)

**Consumes:** `createStoreItem`/`updateStoreItem`/`deleteStoreItem`/`fulfillRedemption`/`rejectRedemption`(Task 4), `DEMO_STORE_ITEMS`/`DEMO_REDEMPTIONS`(Task 5).

- [ ] **Step 1: 페이지 서버 컴포넌트** — 세 블록: ① 상품 생성 폼(`StoreItemForm`), ② 상품 목록(재고·활성 토글·수정·삭제), ③ 신청 목록 테이블(대기/완료/거절 필터, 회원명·상품·포인트·원가). `isDemoMode()` 분기. 데이터 로드는 어드민이므로 RLS로 전체 조회 가능(join `profiles` 회원명).

- [ ] **Step 2: `StoreItemForm`** — `GrantPointsForm`/`BudgetEntryForm` 스타일. 필드: name, description, price_points, cost_krw, stock, per_user_limit, image_url. submit → `createStoreItem`/`updateStoreItem`.

- [ ] **Step 3: `RedemptionActions`** — `pending` 행: [전달완료] → `fulfillRedemption(id)`, [거절] → 사유 입력 후 `rejectRedemption(id, note)`. 확인 후 실행.

- [ ] **Step 4: 어드민 사이드바 링크** — `AdminSidebarNav.tsx` "운영" 섹션에 `/admin/store`("상점") 추가.

- [ ] **Step 5: 빌드 확인 + 커밋** — `pnpm build` → `git commit -m "feat: 어드민 포인트 상점 관리 페이지 + 사이드바"`

---

## Task 9: 회귀 확인 + 마무리

- [ ] **Step 1: 전체 테스트** — `pnpm test` → 회귀 없음
- [ ] **Step 2: 빌드** — `pnpm build` → 타입 에러 0
- [ ] **Step 3: (가능 시) 로컬 스모크** — 데모 모드 ON으로 `/store`, `/store/orders`, `/admin/store` 렌더 확인
- [ ] **Step 4: 검증 기준 대조** (spec §검증 기준):
  - 신청 즉시 잔액 `price_points`만큼 감소
  - 잔액부족/품절/한도초과 시 신청 거부 + 원장·재고 불변
  - 거절·취소 시 잔액·재고 원복
  - 전달완료 시 `budget_entries` expense 1건, 재차 완료해도 `pending` 가드로 중복 없음
  - 동시 신청 시 `for update`로 재고 음수 방지

---

## Self-Review 메모

- **스펙 커버리지:** 데이터모델(T1) · RLS(T1) · 4 RPC(T1) · 서버액션(T4) · 회원화면(T6·T7) · 어드민화면(T8) · 데모모드(T5) · 프로필 라벨(T7) · 마이그레이션(T1) · 검증(T9) — 전부 태스크 존재.
- **번호 조정:** spec `0032` → 실제 `0033`(충돌 회피). Global Constraints에 명시.
- **감사 로깅 제외:** `0031_disable_audit_logging.sql` 반영, RPC에서 `log_audit` 미사용.
- **타입 일관성:** `PointRedemption.status`(T2) = RPC `check` 값 = 배지 렌더(T7/T8) 동일 4값.
