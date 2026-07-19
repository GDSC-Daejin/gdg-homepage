# 포인트 상점 (Points Store) 설계

## 배경 / 목적

현재 포인트 시스템(`point_logs`)은 **적립 전용**이다. 출석 트리거(+10)와 어드민 수동 지급으로 쌓이기만 하고 소모처가 없다. 회원이 쌓은 포인트를 실물/디지털 보상으로 교환할 수 있는 **소모처(상점)** 를 만들어 포인트에 목적을 부여한다.

기존 조직 회계 시스템(`budget_entries`, income/expense)과 연동해, 회원이 실물 보상을 받으면 조직이 실제 지출한 금액이 예산에 자동 반영되도록 한다.

## 핵심 결정 (확정)

1. **교환 방식**: 신청 → 어드민 승인·전달 1단계. 별도 승인/전달 분리 없음. 어드민이 전달 완료 처리하면 종료.
2. **포인트 회계**: 단일 원장 방식(A). 신청 순간 `point_logs`에 음수 레코드 삽입 = 즉시 차감(hold). 거절/취소 시 보상 양수 레코드(환불). 잔액은 기존과 동일하게 `SUM(point_logs.amount)`.
3. **예산 연동**: 상품별 원가(`cost_krw`) 보유. 전달 완료(fulfill) 시 `budget_entries`에 expense 레코드 자동 생성(category=`포인트 상점`).
4. **재고**: 상품별 재고 수량 관리 + 회원당 구매 횟수 제한.
5. **회원 취소**: `pending` 상태에서만 회원 본인 취소 허용(환불).

## 데이터 모델

### `store_items` — 상점 상품
```
id            uuid pk
name          text not null
description   text not null default ''
image_url     text                      -- nullable
price_points  int  not null check (> 0) -- 포인트 가격
cost_krw      int  not null default 0 check (>= 0) -- 실물 원가 = expense 금액
stock         int  not null default 0 check (>= 0) -- 남은 재고
per_user_limit int                      -- 회원당 최대 구매 횟수. null=무제한
is_active     bool not null default true
created_at    timestamptz not null default now()
```

### `point_redemptions` — 교환 신청/주문
```
id             uuid pk
user_id        uuid not null → profiles(id) on delete cascade
item_id        uuid not null → store_items(id) on delete restrict
item_name      text not null              -- 신청 시점 상품명 스냅샷
price_points   int  not null              -- 신청 시점 가격 스냅샷
cost_krw       int  not null              -- 신청 시점 원가 스냅샷
status         text not null default 'pending'
                 check (status in ('pending','fulfilled','rejected','canceled'))
point_log_id   uuid → point_logs(id)      -- 차감 레코드 링크
budget_entry_id uuid → budget_entries(id) -- 완료 시 생성된 expense 링크. nullable
note           text not null default ''   -- 어드민 처리 메모(거절 사유 등)
handled_by     uuid → profiles(id)
created_at     timestamptz not null default now()
handled_at     timestamptz
```

**스냅샷 이유**: 상품 가격/원가/이름이 나중에 바뀌어도 과거 주문의 정합성(차감 포인트, 생성된 expense)이 유지되어야 한다. 상품 삭제는 `on delete restrict`로 막고, 대신 `is_active=false`로 숨긴다.

### RLS
- `store_items`: SELECT는 로그인 사용자(활성 상품), 쓰기는 admin only. (기존 `badges` 정책 패턴)
- `point_redemptions`: 본인 것 or admin SELECT. 쓰기는 RPC로만(직접 INSERT/UPDATE 차단). (기존 `point_logs` 패턴)

## 상태 전이 (RPC · SECURITY DEFINER · 트랜잭션)

기존 `admin_grant_points` / `admin_award_badge` 스타일을 그대로 따른다. 모든 상태 변경은 원자적 RPC로만.

### `request_redemption(p_item uuid)` — 회원
1. 상품 잠금 조회(`for update`). `is_active` & `stock > 0` 확인.
2. 잔액 확인: `SUM(point_logs.amount) >= price_points`.
3. 회원당 한도 확인: 해당 유저의 non-`rejected`/non-`canceled` redemption 수 < `per_user_limit`.
4. `point_logs`에 **음수** 레코드 삽입(`amount = -price_points`, reason=`상점: {item_name}`) → id 확보.
5. `store_items.stock -= 1`.
6. `point_redemptions`(status=`pending`, 스냅샷, point_log_id) 삽입.
- 실패 조건은 한국어 에러로 반환(품절, 포인트 부족, 구매 한도 초과).

### `fulfill_redemption(p_redemption uuid)` — 어드민
1. `pending` 확인.
2. `cost_krw > 0`이면 `budget_entries`에 expense insert(entry_date=today, type=`expense`, category=`포인트 상점`, amount=cost_krw, memo=`{item_name} / {회원명}`, created_by=admin) → budget_entry_id 확보.
3. redemption: status=`fulfilled`, handled_by, handled_at, budget_entry_id.
- 포인트는 신청 시 이미 차감됨 → 여기선 원장 변경 없음.

### `reject_redemption(p_redemption uuid, p_note text)` — 어드민
1. `pending` 확인.
2. `point_logs`에 **양수** 환불 레코드 삽입(`amount = +price_points`, reason=`상점 환불: {item_name}`).
3. `store_items.stock += 1`.
4. redemption: status=`rejected`, note, handled_by, handled_at.

### `cancel_redemption(p_redemption uuid)` — 회원 본인
- `reject_redemption`과 동일한 환불·재고복원, status=`canceled`. `user_id = auth.uid()` & `pending`만.

## 서버 액션 (`src/actions/store.ts`)

`points.ts`/`budget.ts` 패턴 그대로: `requireAdmin`/로그인 확인 → `isDemoMode` 시 `{}` → Zod 검증 → RPC 호출 → `toKoreanError` → `revalidatePath`.

- 회원: `requestRedemption(itemId)`, `cancelRedemption(id)`
- 어드민: `createStoreItem(formData)`, `updateStoreItem(...)`, `deleteStoreItem(id)`, `fulfillRedemption(id)`, `rejectRedemption(id, note)`

Zod: `storeItemSchema`(name/price_points/cost_krw/stock/per_user_limit/image_url) → `src/lib/schemas.ts`.

## 화면

### 회원
- **`/(member)/store`** — 상품 그리드(카드: 이미지, 이름, 설명, 가격 포인트, 재고, 신청 버튼). 잔액 부족/품절/한도 초과 시 버튼 비활성 + 사유. 신청은 확인 후 실행.
- **`/(member)/store/orders`** (또는 store 하단 탭) — 내 신청 내역 + 상태 배지. `pending`이면 취소 버튼.
- **프로필 수정**: `누적 포인트` 라벨 → **`사용 가능 포인트`** 로 변경. 값은 이미 음수 포함 `SUM`이라 로직 변경 없음, 라벨만. (`src/app/(member)/profile/page.tsx:85`)
- 사이드바 `SidebarNav.tsx` "활동" 섹션에 `/store` 추가.

### 어드민
- **`/admin/store`** — 상품 CRUD 폼(기존 `BudgetEntryForm`/`GrantPointsForm` 스타일) + 상품 목록(재고/활성 토글) + 신청 목록 테이블(대기/완료/거절 필터, 전달완료·거절 버튼). 거절 시 사유 입력.
- 어드민 사이드바 `AdminSidebarNav.tsx` "운영" 섹션에 `/admin/store` 추가(포인트/예산 옆).

## 데모 모드

`demoData.ts`에 `DEMO_STORE_ITEMS`, `DEMO_REDEMPTIONS` 추가. 페이지 로더는 기존 페이지들처럼 `isDemoMode()` 분기로 데모 배열 반환. 서버 액션은 데모 시 `{}` no-op.

## 재사용 / 비-목표

**재사용**: 잔액=`SUM(point_logs.amount)`(기존 그대로), `budget_entries` 스키마·category 관례, RPC/RLS 패턴(`admin_grant_points`), 서버 액션 골격, `StatCard`/폼 컴포넌트.

**하지 않을 것(YAGNI)**:
- 자동 지급/쿠폰 코드 풀 — 신청·전달 수동이므로 불필요.
- 승인/전달 2단계 — 1단계로 확정.
- 배송 주소/결제 연동 — 오프라인 전달.
- 상품 카테고리/태그, 위시리스트, 리뷰 — 요청 범위 밖.

## 마이그레이션

`supabase/migrations/0032_points_store.sql` — 위 두 테이블 + RLS + 4개 RPC + grant/revoke. `admin_grant_points`와 동일한 execute 권한 패턴.

## 검증 기준

- 신청 즉시 잔액이 `price_points`만큼 감소한다.
- 잔액 부족/품절/한도 초과 시 신청이 거부되고 원장·재고가 변하지 않는다.
- 거절·취소 시 잔액과 재고가 원복된다.
- 전달 완료 시 `budget_entries`에 `cost_krw` 금액 expense가 1건 생성되고 재차 완료해도 중복 생성되지 않는다(`pending` 가드).
- 동시 신청으로 재고가 음수가 되지 않는다(`for update` 잠금).
