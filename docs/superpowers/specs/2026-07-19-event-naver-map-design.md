# 이벤트 상세 네이버 지도 표시 — 설계

- 작성일: 2026-07-19
- 대상 화면: 회원용 이벤트 상세 `/events/[id]` ([src/app/(member)/events/[id]/page.tsx](../../../src/app/(member)/events/[id]/page.tsx))

## 배경 / 문제

이벤트 상세에는 장소명·주소가 텍스트로 나오지만 지도가 뜨지 않는다. 장소 풀(`places`) + `NaverMap` 컴포넌트는 이미 구현돼 있으나, 지도는 **연결된 place에 저장된 `lat/lng`가 있을 때만** 렌더된다. 실제로는:

- 마이그레이션 `0026_places.sql`이 기존 이벤트의 `(location, address)`를 place로 백필했지만 **지오코딩은 하지 않아** 백필된 place의 `lat/lng`가 전부 `null`이다.
- place가 아예 연결되지 않은(과거 자유입력) 이벤트는 좌표를 얻을 경로가 없다.

목표: **주소만 있으면 어떤 이벤트든 상세에서 네이버 지도에 핀이 뜨게** 한다.

## 결정

1. **좌표 해석 = Hybrid**: 저장 좌표 우선, 없으면 주소를 브라우저에서 즉석 지오코딩.
2. **기존 풀 = 1회성 일괄 지오코딩**: 관리자 버튼으로 좌표 없는 place를 한 번에 채운다.

## 설계

### 1. 좌표 해석 (Hybrid)

이벤트 상세에서 지도 좌표를 다음 우선순위로 얻는다.

1. `event.place.lat/lng`가 있으면 그대로 사용 (지오코딩 호출 없음).
2. 없으면 브라우저에서 `event.address`(비면 `event.location`)를 maps.js `geocoder` 서브모듈로 변환해 핀을 찍는다.
3. 좌표도 주소도 없으면 지도를 렌더하지 않는다. 기존 주소 텍스트·네이버 링크·복사 버튼은 유지한다.

이 화면(`place` 좌표 없음 + 주소 있음)은 2번 폴백으로 표시된다.

### 2. `NaverMap` 컴포넌트 확장

현재 `{ lat, lng }`만 받는 [src/components/NaverMap.tsx](../../../src/components/NaverMap.tsx)를 다음 입력으로 확장한다.

```ts
type MapSource =
  | { coords: { lat: number; lng: number }; address?: string }
  | { coords?: null; address: string };

function NaverMap(props: { coords?: { lat: number; lng: number } | null; address?: string; zoom?: number })
```

동작:
- 스크립트 URL에 `&submodules=geocoder` 추가.
- `coords`가 있으면 바로 `Marker` 렌더.
- 없고 `address`가 있으면 `naver.maps.Service.geocode({ query: address })` 결과의 `addresses[0].x/y`로 핀.
- `NEXT_PUBLIC_NCP_MAP_KEY_ID` 미설정이면 `null` 반환(현행 유지).

분기 선택 로직은 순수 함수 `resolveMapSource(coords, address)`로 분리해 테스트한다.

### 3. 이벤트 상세 연동

상세 쿼리는 이미 `select("*, place:places(lat, lng)")`. `NaverMap`에 `place` 좌표와 `e.address || e.location`을 넘긴다. 렌더 위치는 `EventLocation`(주소·링크) 바로 아래로 유지.

```tsx
<NaverMap
  coords={e.place?.lat != null && e.place?.lng != null ? { lat: e.place.lat, lng: e.place.lng } : null}
  address={e.address || e.location}
/>
```

렌더 조건: `coords`가 있거나 `(e.address || e.location)`가 비어있지 않을 때만 컴포넌트를 마운트.

### 4. 기존 풀 1회성 일괄 지오코딩

[src/app/admin/places](../../../src/app/admin/places) 에 **"좌표 없는 장소 일괄 변환"** 버튼을 추가한다.

- 새 서버 액션 `backfillPlaceCoords()` ([src/actions/place.ts](../../../src/actions/place.ts)):
  - `lat is null AND address <> ''`인 place들을 조회.
  - 각 주소를 서버 `geocodeAddress`로 변환해 `lat/lng` 업데이트(순차, 소규모 전제).
  - 변환 성공/실패 개수를 `ActionResult`(또는 반환값)로 돌려 관리자에게 요약 표시.
- 클릭 한 번으로 기존 풀이 정리되어 "핀 있음/없음" 배지가 정확해지고, 이후 상세에서 폴백 지오코딩 호출이 사라진다.
- 스크립트 대신 버튼: CLI/env 세팅 불필요, 나중에 주소만 넣고 저장한 place가 생겨도 다시 눌러 정리 가능.

### 5. UX 디테일

- 지도 높이 `h-56`, `zoom` 16, 마커 1개.
- 기존 "지도"(네이버 지도 링크)·"복사"는 길찾기/앱 열기 용도로 유지.
- 폴백 지오코딩 실패 시 에러를 노출하지 않고 지도만 숨긴다.

### 6. 테스트

- 기존 `parseGeocode` 유닛 테스트 유지.
- `resolveMapSource(coords, address)` 순수 함수 유닛 테스트 1개: 저장 좌표 우선 / 주소 폴백 / 둘 다 없음(null) 세 분기.

## 범위 밖 (YAGNI)

- 여러 마커·클러스터링, 길찾기 임베드, 지도 커스텀 스타일.
- 폴백 지오코딩 결과를 place에 되쓰는 자동 저장(일괄 변환 버튼으로 충분).
- 네이버 외 지도 제공자 추상화.
