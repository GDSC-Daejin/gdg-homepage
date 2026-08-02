# 관리자 장소 화면 정보구조 개선

- 날짜: 2026-07-23
- 대상: `/admin/places`
- 범위: 레이아웃·정보구조 (기능/스키마 변경 없음)

## 문제

현재 `/admin/places` 화면에서 관찰된 문제.

1. **추가 폼이 화면을 지배한다.** 장소명 → 주소 → 힌트 → 버튼이 세로 5단으로 쌓여 카드 하나가 화면 절반을 차지한다. 장소는 "가끔 추가, 자주 조회"하는 데이터인데 목록이 아래로 밀린다. 같은 성격의 `BadgeManager`는 추가 폼을 한 줄로 압축한다.
2. **"좌표 없는 장소 일괄 변환" 버튼이 붕 떠 있다.** 카드 밖에 라벨 없이 홀로 있어 무엇에 영향을 주는지 알 수 없고, 변환 대상이 0개여도 항상 노출된다.
3. **배지가 상태를 뭉갠다.** 실제 상태는 3가지(핀 있음 / 주소는 있는데 좌표 없음 / 주소 없음)인데 배지는 2종이다. `backfillPlaceCoords`는 `.neq("address", "")` 조건이라 주소 없는 장소는 애초에 변환 대상이 아닌데, 같은 주황 "핀 없음" 배지로 보여 "변환해도 안 없어지는 경고"가 된다.
4. **삭제만 브라우저 `confirm()`을 쓴다.** 이 화면에서 유일하게 OS 기본 UI가 튀어나온다. `Modal`은 이미 `BadgeManager`에서 쓰이고 있다.

## 설계

전부 `src/app/admin/places/PlaceManager.tsx` 한 파일 안에서 해결한다. 서버 액션·스키마·공통 컴포넌트는 건드리지 않고, 새 컴포넌트도 만들지 않는다.

### 1. 추가 폼 한 줄 압축

`BadgeManager`와 동일한 구조를 쓴다.

- 폼 컨테이너: `flex flex-col gap-3 sm:flex-row sm:items-end`
- `장소명` 필드: `sm:w-56` 래퍼
- `주소 (도로명)` 필드: `flex-1` 래퍼
- `[추가]` 버튼: 같은 행 끝
- 카드 제목 `장소 추가`: `text-xs font-medium text-gray-700` (BadgeManager 톤)
- 좌표 변환 힌트 문구는 폼 **아래**에 `text-xs text-gray-400`으로 유지

세로 5단 → 2단으로 줄어 목록이 첫 화면에 올라온다.

### 2. 목록 헤더 줄

추가 카드와 목록 사이에 홀로 뜬 버튼을 제거하고, 목록 바로 위 헤더 줄로 옮긴다.

```
등록된 장소 3곳 · 핀 없음 1곳        [핀 일괄 변환]  좌표 변환 완료 — 성공 1 · 실패 0
```

- `pendingCount` = 주소가 있고 `lat`/`lng`가 없는 장소 수 (= `backfillPlaceCoords`의 대상 집합과 동일)
- `[핀 일괄 변환]` 버튼은 `pendingCount > 0`일 때만 렌더한다. 할 일이 없으면 사라진다
- `· 핀 없음 N곳` 조각도 `pendingCount > 0`일 때만 붙인다
- `backfillMsg`는 버튼 옆에 유지한다
- `places.length === 0`이면 헤더 줄 전체를 렌더하지 않는다 (`EmptyState`만)

### 3. 배지 3상태, 정상은 무배지

`PinBadge({ located })`를 상태 기반으로 교체한다.

| 상태 | 조건 | 표시 |
|---|---|---|
| 핀 있음 | `lat != null && lng != null` | **배지 없음** |
| 변환 대상 | 주소 있음 + 좌표 없음 | 주황 `핀 없음` (기존 `bg-warning-soft text-warning` 유지) |
| 주소 없음 | 주소 없음 | 회색 `주소 없음` (`bg-gray-100 text-gray-500`) |

"주황 = 조치 필요"라는 규칙이 서고, 헤더의 `핀 없음 N곳` 숫자와 주황 배지 개수가 정확히 일치한다.

### 4. 삭제 확인 모달

`confirm()`을 `Modal`로 교체한다.

- 상태: `deleting: Place | null` 하나 추가. 모달은 목록 **밖에 1개만** 렌더한다 (행마다 만들지 않는다)
- 제목: `'{name}' 장소를 삭제할까요?`
- 본문: `삭제하면 되돌릴 수 없어요. 이 장소를 쓰던 이벤트의 장소 정보가 비워질 수 있어요.`
  - `0026_places.sql:12`의 `place_id uuid references public.places(id) on delete set null` 동작을 그대로 설명한 것이다
- 버튼: `[취소]`(ghost) / `[삭제]`(danger)
- 삭제 성공 시 `setDeleting(null)`

## 범위 밖 (의도적 제외)

- 서버 액션 시그니처 변경, `geocodeAddress` 수정
- `createPlace`(지오코딩 실패 시 조용히 저장)와 `updatePlace`(실패 시 에러) 의 동작 불일치 — 실제 버그지만 별건
- 삭제 모달에 "이 장소를 쓰는 이벤트 N개" 표시 — 서버 쿼리가 필요하며 별건
- 지도 미리보기로 핀 위치 검증
- 장소 검색·필터 (현재 규모에서 YAGNI)

## 검증

`tests/admin-places-layout.test.ts`를 새로 추가한다. `tests/admin-groups-layout.test.ts`와 같은 소스 텍스트 단언 방식이다.

```bash
npx vitest run tests/admin-places-layout.test.ts
npm run build
```
