# Codex 지시서 — 관리자 장소 화면 정보구조 개선

설계 근거: `docs/superpowers/specs/2026-07-23-admin-places-layout-design.md`

## 목표

`/admin/places` 화면의 정보구조를 고쳐서, 목록이 첫 화면에 보이고 "핀 없음" 경고가 실제 조치 가능한 항목만 가리키게 만든다. 완료 시 관찰 가능한 상태: 추가 폼이 한 줄로 줄고, 일괄 변환 버튼은 변환 대상이 있을 때만 목록 헤더에 나타나며, 핀이 정상인 장소에는 배지가 붙지 않고, 삭제 확인이 브라우저 `confirm()` 대신 앱 모달로 뜬다.

**기능·데이터 변경은 없다. 순수 프레젠테이션 변경이다.**

## 대상 파일 + 현재 상태 (실측)

### `src/app/admin/places/PlaceManager.tsx` — 유일한 수정 대상

- `12-24`: `PinBadge({ located })` — `located ? "핀 있음"(bg-success-soft/text-success) : "핀 없음"(bg-warning-soft/text-warning)` 2상태 배지.
- `26-32`: `PlaceManager` 상태 — `error`, `editingId`, `pending`(useTransition), `backfillMsg`, `addFormRef`.
- `34-48`: `handleBackfill()` — `backfillPlaceCoords()` 호출 후 `backfillMsg` 세팅 + `router.refresh()`.
- `50-61`: `run(action, onDone)` — 공통 서버액션 러너.
- `65-87`: 추가 카드. 제목 `<p className="text-sm font-semibold text-gray-900">장소 추가</p>`, 폼이 `flex flex-col gap-3`로 **세로 스택**. `Input name="name"`(label 장소명, required) → `Input name="address"`(label `주소 (도로명)`) → 힌트 `<p className="text-xs text-gray-400">` → `<div><Button type="submit" variant="primary">추가</Button></div>`.
- `89-102`: 카드 밖에 홀로 뜬 `<div className="flex items-center gap-3">` 안에 `[좌표 없는 장소 일괄 변환]` 버튼(secondary/sm) + `backfillMsg` span. **조건 없이 항상 렌더된다.**
- `104-108`: 에러 배너.
- `110-114`: `places.length === 0` → `EmptyState`.
- `116-185`: 목록. `editingId === place.id`면 수정 폼 카드, 아니면 표시 카드(`148-182`). 표시 카드 안에 `PinBadge located={place.lat != null && place.lng != null}`(152), 우측에 `[수정]`(secondary/sm)·`[삭제]`(ghost/sm) 버튼. **삭제는 `confirm(\`'${place.name}' 장소를 삭제할까요?\`)`(173) 사용.**

### 참고할 기존 패턴 (읽기만, 수정 금지)

- `src/app/admin/points/BadgeManager.tsx:166-191` — 한 줄 추가 폼: 카드 제목 `<p className="mb-2 text-xs font-medium text-gray-700">`, 폼 `className="flex flex-col gap-3 sm:flex-row sm:items-end"`, 필드별 폭 래퍼(`sm:w-20`/`sm:w-48`/`flex-1`), 버튼이 같은 행 끝.
- `src/app/admin/points/BadgeManager.tsx:96-132` — 삭제 확인 `Modal` 마크업: 제목 `<h2 className="text-base font-semibold text-gray-900">`(대략), 설명 `<p className="mt-1 text-sm text-gray-500">`, 에러 `<p className="mt-2 text-xs text-danger">`, 버튼 줄 `<div className="mt-5 flex justify-end gap-2">` 안에 `ghost` 취소 + `danger` 삭제.
- `src/app/admin/points/BadgeManager.tsx:199-202` — 목록 헤더 줄: `<p className="text-xs font-medium text-gray-700">등록된 뱃지 <span className="text-gray-400">{badges.length}종</span></p>`.
- `src/components/Modal.tsx` — `Modal({ open, onClose, className?, ariaLabel?, children })`. 네이티브 `<dialog>` 기반, ESC·백드롭 클릭 닫기는 자동. 기본 폭 `max-w-sm`.
- `src/components/Button.tsx:12-18` — variant는 `primary | secondary | ghost | danger | danger-outline`, size는 `sm | md`.

### 배경 사실 (동작 근거)

- `src/actions/place.ts:96-108` — `backfillPlaceCoords()`는 `.is("lat", null).neq("address", "")` 로 대상을 고른다. **주소가 빈 장소는 변환 대상이 아니다.** 화면의 `pendingCount`는 이 집합과 정확히 같아야 한다.
- `supabase/migrations/0026_places.sql:12` — `add column place_id uuid references public.places(id) on delete set null`. 장소를 삭제하면 그 장소를 쓰던 이벤트의 `place_id`가 NULL이 된다. 삭제 모달 문구의 근거.
- `src/lib/types.ts` 의 `Place` 타입에 `lat`/`lng`/`address` 가 있다 (현재 코드가 `place.lat`, `place.address` 를 그대로 쓴다).

## 정확한 변경

전부 `src/app/admin/places/PlaceManager.tsx` 안에서 한다.

### 변경 1 — 배지를 3상태로 (현재 `12-24`)

`PinBadge` 를 아래로 교체한다. `located`/`핀 있음`/`bg-success-soft` 는 파일에서 완전히 사라져야 한다.

```tsx
function needsPin(place: Place) {
  return !!place.address && (place.lat == null || place.lng == null);
}

function PlaceStatusBadge({ place }: { place: Place }) {
  if (place.lat != null && place.lng != null) return null;
  const pending = needsPin(place);
  return (
    <span
      className={
        pending
          ? "inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning"
          : "inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
      }
    >
      {pending ? "핀 없음" : "주소 없음"}
    </span>
  );
}
```

호출부(현재 `152`)는 `<PlaceStatusBadge place={place} />` 로 바꾼다.

주의: 클래스 문자열은 `bg-gray-100 text-gray-500` 두 토큰이 **한 문자열 안에 인접**해야 한다 (테스트가 `"bg-gray-100 text-gray-500"` 를 문자열로 찾는다). 위 예시처럼 `bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500` 로 흩어 쓰면 실패한다 — `bg-gray-100 text-gray-500 px-2 py-0.5 text-xs font-medium` 순서로 적어라.

### 변경 2 — 추가 폼 한 줄 압축 (현재 `65-87`)

- 카드 제목: `<p className="text-sm font-semibold text-gray-900">장소 추가</p>` → `<p className="mb-2 text-xs font-medium text-gray-700">장소 추가</p>`
- 폼 `className`: `"flex flex-col gap-3"` → `"flex flex-col gap-3 sm:flex-row sm:items-end"`
- `Input name="name"` 을 `<div className="sm:w-56">` 로 감싼다
- `Input name="address"` 를 `<div className="flex-1">` 로 감싼다
- `[추가]` 버튼을 감싼 `<div>` 를 제거하고 `<Button>` 을 폼 직속 자식으로 두어 같은 행에 오게 한다 (`variant="primary" disabled={pending}` 유지)
- 힌트 `<p className="text-xs text-gray-400">주소를 넣으면 저장 시 좌표로 변환돼 지도에 핀이 찍혀요.</p>` 는 **폼 밖, 카드 안**으로 옮긴다 (`className="mt-2 text-xs text-gray-400"`)

`addFormRef` 와 `action={(fd) => run(() => createPlace(fd), () => addFormRef.current?.reset())}` 는 그대로 유지한다.

### 변경 3 — 떠 있는 버튼 → 목록 헤더 줄 (현재 `89-102` 제거, 목록 위에 신설)

`89-102` 블록을 통째로 삭제한다.

컴포넌트 본문에 카운트를 계산한다:

```tsx
const pendingCount = places.filter(needsPin).length;
```

`places.length === 0` 이 아닌 분기(현재 `115-185`) 안에서, 목록 `<div className="flex flex-col gap-2">` **위에** 헤더 줄을 넣는다:

```tsx
<div className="flex flex-wrap items-center gap-3">
  <p className="text-xs font-medium text-gray-700">
    등록된 장소 <span className="text-gray-400">{places.length}곳</span>
    {pendingCount > 0 && (
      <span className="text-warning"> · 핀 없음 {pendingCount}곳</span>
    )}
  </p>
  {pendingCount > 0 && (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={handleBackfill}
    >
      핀 일괄 변환
    </Button>
  )}
  {backfillMsg && <span className="text-xs text-gray-500">{backfillMsg}</span>}
</div>
```

`places.length === 0` 이면 이 헤더 줄은 렌더되지 않는다 (`EmptyState` 분기 그대로).

`handleBackfill` 함수 본문은 **수정하지 않는다**. 버튼 라벨만 `좌표 없는 장소 일괄 변환` → `핀 일괄 변환` 으로 바뀐다.

### 변경 4 — 삭제 확인을 Modal 로 (현재 `168-179` 삭제 버튼 + 새 모달)

- `import { Modal } from "@/components/Modal";` 추가
- 상태 추가: `const [deleting, setDeleting] = useState<Place | null>(null);`
- 삭제 버튼 `onClick` 을 `() => setDeleting(place)` 로 교체한다. `confirm(` 은 파일에서 완전히 사라져야 한다.
- 컴포넌트 최상위 `<div className="flex flex-col gap-4">` 의 **마지막 자식**으로 모달 1개만 렌더한다 (행마다 만들지 마라):

```tsx
<Modal open={!!deleting} onClose={() => setDeleting(null)} ariaLabel="장소 삭제 확인">
  <h2 className="text-base font-semibold text-gray-900">
    &lsquo;{deleting?.name}&rsquo; 장소를 삭제할까요?
  </h2>
  <p className="mt-1 text-sm text-gray-500">
    삭제하면 되돌릴 수 없어요. 이 장소를 쓰던 이벤트의 장소 정보가 비워질 수 있어요.
  </p>
  <div className="mt-5 flex justify-end gap-2">
    <Button type="button" variant="ghost" disabled={pending} onClick={() => setDeleting(null)}>
      취소
    </Button>
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        const target = deleting;
        if (!target) return;
        run(() => deletePlace(target.id), () => setDeleting(null));
      }}
    >
      삭제
    </Button>
  </div>
</Modal>
```

주의: `run()` 은 에러 시 `error` 상태만 세팅하고 `onDone` 을 부르지 않으므로, 실패하면 모달이 열린 채 남는다. 이 동작이 의도한 것이다 — 별도 처리 하지 마라. 에러 배너는 기존 위치(현재 `104-108`)에 그대로 둔다.

## 완료 정의 (DoD 체크리스트)

- [ ] `tests/admin-places-layout.test.ts` 4개 테스트가 모두 통과한다
- [ ] `PlaceManager.tsx` 에 `핀 있음`, `bg-success-soft`, `confirm(` 문자열이 남아 있지 않다
- [ ] 추가 폼이 `sm:` 브레이크포인트 이상에서 한 줄로 배치된다 (`sm:flex-row sm:items-end`)
- [ ] `pendingCount === 0` 일 때 `[핀 일괄 변환]` 버튼과 `· 핀 없음 N곳` 조각이 렌더되지 않는다
- [ ] `places.length === 0` 일 때 목록 헤더 줄이 렌더되지 않고 `EmptyState` 만 나온다
- [ ] `lat`/`lng` 가 모두 있는 장소에는 배지가 렌더되지 않는다
- [ ] 삭제 모달이 목록 밖에 **1개만** 존재한다 (`places.map` 안에 `Modal` 이 없다)
- [ ] `npm run build` 가 성공한다
- [ ] `src/app/admin/places/PlaceManager.tsx` 외의 파일이 수정되지 않았다 (`git status` 로 확인)

## 검증 커맨드 (green 될 때까지 반복)

```bash
npx vitest run tests/admin-places-layout.test.ts
npx tsc --noEmit
npm run build
```

`tests/admin-places-layout.test.ts` 는 **이미 작성되어 있고 지금 4개 모두 red 다.** 이 테스트를 통과시키는 것이 과제다. **테스트 파일을 수정하지 마라.** 단언이 틀렸다고 판단되면 고치지 말고 보고하라.

## 건드리지 말 것 (스코프 펜스)

- `src/actions/place.ts` — 서버 액션 시그니처·로직 전부
- `src/lib/geocode.ts`
- `src/components/**` — `Modal`/`Button`/`Input`/`Card`/`EmptyState` 는 **사용만** 하고 수정하지 않는다
- `src/app/admin/places/page.tsx`
- `supabase/**`
- `tests/admin-places-layout.test.ts` — 읽기만
- 수정 폼(현재 `118-146` 의 `editingId` 분기) 은 그대로 둔다. 한 줄 압축은 **추가 폼에만** 적용한다

지시서 밖 리팩터 금지. DoD 항목만 한다.

## 알려진 지뢰 (추적 금지)

- 이 레포는 표준 Next.js가 아니다 — 먼저 `AGENTS.md` 를 읽고, 필요 시 `node_modules/next/dist/docs/` 를 확인하라.
- `tests/accessibility-primitives.test.ts` — eslint 미설치로 **상시 실패**한다. 회귀가 아니다. 고치려 하지 마라. `npm test` 대신 위의 `npx vitest run tests/admin-places-layout.test.ts` 로 좁혀서 돌려라.
- turbopack dev 의 `adapterFn` 반복 에러는 dev 캐시 이슈다. 코드 문제로 착각하지 마라.
- `Modal` 은 네이티브 `<dialog>` + `createPortal` 이라 SSR 중엔 `null` 을 반환한다. 정상이다.
- Tailwind v4 (`@tailwindcss/postcss`). 임의 값 클래스를 새로 만들지 말고 기존 토큰(`warning`, `warning-soft`, `gray-*`, `danger`)만 써라.
