# 이벤트 상세 네이버 지도 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원용 이벤트 상세(`/events/[id]`)에서 장소를 네이버 지도 핀으로 표시한다 — 저장 좌표가 있으면 그걸로, 없으면 주소를 브라우저에서 지오코딩해서.

**Architecture:** 좌표 해석은 순수 함수 `resolveMapSource`(저장 좌표 우선 → 주소 폴백 → null)로 분리한다. `NaverMap` 컴포넌트가 이 결과에 따라 maps.js SDK로 마커를 찍고, 좌표가 없을 때만 `geocoder` 서브모듈로 주소를 즉석 변환한다. 기존 장소 풀의 빈 좌표는 관리자 버튼 하나로 서버에서 일괄 지오코딩해 채운다.

**Tech Stack:** Next.js App Router, TypeScript strict, 네이버 maps.js v3 (`ncpKeyId` + `submodules=geocoder`), 네이버 Geocoding REST (서버), Supabase, vitest.

## Global Constraints

- 지도 렌더는 `NEXT_PUBLIC_NCP_MAP_KEY_ID` 미설정 시 조용히 `null` 반환 (현행 유지).
- 서버 지오코딩은 기존 [src/lib/geocode.ts](../../../src/lib/geocode.ts)의 `geocodeAddress(address)` / `parseGeocode(data)`를 재사용한다. 새 지오코딩 클라이언트를 만들지 않는다.
- `events.location` / `events.address`는 place 스냅샷이다 — 이 계획에서 스키마·표시 로직을 바꾸지 않는다.
- maps.js 스크립트 태그 파라미터는 `ncpKeyId` (구 `ncpClientId` 아님).
- 클라이언트 지오코딩 결과 좌표: `res.v2.addresses[0].x` = 경도(lng), `.y` = 위도(lat).
- UI 문구는 한국어. TypeScript strict 통과 필수.
- 커밋 메시지에 `Co-Authored-By` 트레일러 금지 (커밋 훅이 거부함).

---

### Task 1: `resolveMapSource` 순수 함수

지도가 어떤 소스(저장 좌표 / 주소 / 없음)로 렌더될지 결정하는 순수 함수. `NaverMap`과 렌더 조건 양쪽에서 쓰이고, 유일하게 유닛 테스트하는 로직.

**Files:**
- Create: `src/lib/mapSource.ts`
- Test: `tests/mapSource.test.ts`

**Interfaces:**
- Consumes: `Coords` 타입 (`{ lat: number; lng: number }`) from [src/lib/geocode.ts](../../../src/lib/geocode.ts).
- Produces:
  - `type MapSource = { kind: "coords"; coords: Coords } | { kind: "address"; address: string } | null`
  - `resolveMapSource(coords: Coords | null | undefined, address: string | null | undefined): MapSource`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/mapSource.test.ts
import { describe, it, expect } from "vitest";
import { resolveMapSource } from "@/lib/mapSource";

describe("resolveMapSource", () => {
  it("저장 좌표가 있으면 좌표를 우선한다", () => {
    expect(resolveMapSource({ lat: 37.5, lng: 127.0 }, "어떤 주소")).toEqual({
      kind: "coords",
      coords: { lat: 37.5, lng: 127.0 },
    });
  });

  it("좌표가 없으면 주소로 폴백한다", () => {
    expect(resolveMapSource(null, "서울특별시 도봉구 마들로11길 75")).toEqual({
      kind: "address",
      address: "서울특별시 도봉구 마들로11길 75",
    });
  });

  it("좌표도 주소도 없으면 null", () => {
    expect(resolveMapSource(null, "")).toBeNull();
    expect(resolveMapSource(null, "   ")).toBeNull();
    expect(resolveMapSource(undefined, undefined)).toBeNull();
  });

  it("좌표 값이 NaN이면 좌표를 무시하고 주소로 폴백한다", () => {
    expect(resolveMapSource({ lat: NaN, lng: 127 }, "서울")).toEqual({
      kind: "address",
      address: "서울",
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/mapSource.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/mapSource"`

- [ ] **Step 3: 최소 구현 작성**

```ts
// src/lib/mapSource.ts
import type { Coords } from "@/lib/geocode";

export type MapSource =
  | { kind: "coords"; coords: Coords }
  | { kind: "address"; address: string }
  | null;

export function resolveMapSource(
  coords: Coords | null | undefined,
  address: string | null | undefined,
): MapSource {
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return { kind: "coords", coords };
  }
  const trimmed = address?.trim();
  if (trimmed) return { kind: "address", address: trimmed };
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/mapSource.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/mapSource.ts tests/mapSource.test.ts
git commit -m "feat: 지도 소스 해석 순수 함수 resolveMapSource 추가"
```

---

### Task 2: `NaverMap` 컴포넌트 확장 (좌표|주소 + geocoder 폴백)

`NaverMap`이 `{ lat, lng }` 대신 `{ coords?, address? }`를 받아 `resolveMapSource`로 분기하고, 좌표가 없으면 `geocoder` 서브모듈로 주소를 즉석 변환하도록 재작성.

**Files:**
- Modify (전체 재작성): `src/components/NaverMap.tsx`

**Interfaces:**
- Consumes: `resolveMapSource`, `MapSource` (Task 1); `Coords` (geocode.ts).
- Produces: `NaverMap(props: { coords?: Coords | null; address?: string; zoom?: number })` — React 컴포넌트. 소스가 없거나 `NEXT_PUBLIC_NCP_MAP_KEY_ID`가 없으면 `null` 렌더.

- [ ] **Step 1: 컴포넌트 재작성**

```tsx
// src/components/NaverMap.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { resolveMapSource } from "@/lib/mapSource";
import type { Coords } from "@/lib/geocode";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver?: any;
  }
}

const SCRIPT_ID = "naver-maps-sdk";

// maps.js(+geocoder) 로드 후 콜백. cleanup 함수 반환.
function loadSdk(keyId: string, onReady: () => void): () => void {
  if (window.naver?.maps) {
    onReady();
    return () => {};
  }
  let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}&submodules=geocoder`;
    document.head.appendChild(script);
  }
  script.addEventListener("load", onReady);
  return () => script?.removeEventListener("load", onReady);
}

export function NaverMap({
  coords,
  address,
  zoom = 16,
}: {
  coords?: Coords | null;
  address?: string;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const keyId = process.env.NEXT_PUBLIC_NCP_MAP_KEY_ID;
  const source = useMemo(
    () => resolveMapSource(coords, address),
    [coords?.lat, coords?.lng, address],
  );

  useEffect(() => {
    if (!keyId || !ref.current || !source) return;

    function render(lat: number, lng: number) {
      const naver = window.naver;
      if (!naver?.maps || !ref.current) return;
      const pos = new naver.maps.LatLng(lat, lng);
      const map = new naver.maps.Map(ref.current, { center: pos, zoom });
      new naver.maps.Marker({ position: pos, map });
    }

    return loadSdk(keyId, () => {
      const naver = window.naver;
      if (source.kind === "coords") {
        render(source.coords.lat, source.coords.lng);
        return;
      }
      if (!naver?.maps?.Service) return;
      naver.maps.Service.geocode(
        { query: source.address },
        (status: string, res: any) => {
          const item = res?.v2?.addresses?.[0];
          if (status !== naver.maps.Service.Status.OK || !item) return;
          render(Number(item.y), Number(item.x));
        },
      );
    });
  }, [keyId, source, zoom]);

  if (!keyId || !source) return null;
  return <div ref={ref} className="h-56 w-full overflow-hidden rounded-md" />;
}
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `npx tsc --noEmit 2>&1 | grep -E "NaverMap|mapSource" || echo "no errors in touched files"`
Expected: `no errors in touched files`

- [ ] **Step 3: 커밋**

```bash
git add src/components/NaverMap.tsx
git commit -m "feat: NaverMap이 저장 좌표 또는 주소 지오코딩 폴백으로 렌더"
```

---

### Task 3: 이벤트 상세에서 좌표+주소 전달

상세 페이지가 `NaverMap`에 place 좌표(있으면)와 주소 폴백을 함께 넘긴다. `NaverMap`이 내부에서 소스 없을 때 `null`을 렌더하므로 조건부 마운트를 제거한다.

**Files:**
- Modify: `src/app/(member)/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `NaverMap({ coords?, address? })` (Task 2). 상세 쿼리는 이미 `select("*, place:places(lat, lng)")`.

- [ ] **Step 1: NaverMap 호출 교체**

기존 블록:

```tsx
        {e.place?.lat != null && e.place?.lng != null && (
          <NaverMap lat={e.place.lat} lng={e.place.lng} />
        )}
```

로 아래로 교체:

```tsx
        <NaverMap
          coords={
            e.place?.lat != null && e.place?.lng != null
              ? { lat: e.place.lat, lng: e.place.lng }
              : null
          }
          address={e.address || e.location}
        />
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `npx tsc --noEmit 2>&1 | grep "events/\[id\]" || echo "no errors in touched file"`
Expected: `no errors in touched file`

- [ ] **Step 3: 라이브 확인**

dev 서버(`.claude/launch.json`의 named config, 없으면 생성)로 회원 로그인 후 지도 있는 이벤트 상세 열기. 문제 URL: `/events/81d829d6-0570-46ab-85e1-d4e14e0a2865`.
- 콘솔 에러 없음, 주소 텍스트 아래에 지도 + 핀 표시.
- 지오코딩 실패 시 지도만 숨고 주소 텍스트는 유지.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/(member)/events/[id]/page.tsx"
git commit -m "feat: 이벤트 상세에서 좌표+주소로 네이버 지도 표시"
```

---

### Task 4: 기존 장소 풀 1회성 일괄 지오코딩

좌표가 비어있는(`lat is null AND address <> ''`) place들을 관리자 버튼 한 번으로 서버 지오코딩해 채운다.

**Files:**
- Modify: `src/actions/place.ts` (액션 추가)
- Modify: `src/app/admin/places/PlaceManager.tsx` (버튼 + 결과 표시)

**Interfaces:**
- Consumes: `geocodeAddress` (geocode.ts), `requireAdmin`, `createClient`, `isDemoMode`.
- Produces: `backfillPlaceCoords(): Promise<{ error?: string; done?: number; failed?: number }>`

- [ ] **Step 1: 서버 액션 추가**

[src/actions/place.ts](../../../src/actions/place.ts) 끝에 추가:

```ts
export async function backfillPlaceCoords(): Promise<{
  error?: string;
  done?: number;
  failed?: number;
}> {
  await requireAdmin();
  if (await isDemoMode()) return { done: 0, failed: 0 };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("places")
    .select("id, address")
    .is("lat", null)
    .neq("address", "");

  const places = (rows ?? []) as { id: string; address: string }[];
  let done = 0;
  let failed = 0;
  for (const place of places) {
    const coords = await geocodeAddress(place.address);
    if (!coords) {
      failed += 1;
      continue;
    }
    const { error } = await supabase
      .from("places")
      .update({ lat: coords.lat, lng: coords.lng })
      .eq("id", place.id);
    if (error) failed += 1;
    else done += 1;
  }

  revalidatePath("/admin/places");
  return { done, failed };
}
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `npx tsc --noEmit 2>&1 | grep "actions/place" || echo "no errors in actions/place"`
Expected: `no errors in actions/place`

- [ ] **Step 3: 관리자 버튼 + 결과 표시 추가**

[src/app/admin/places/PlaceManager.tsx](../../../src/app/admin/places/PlaceManager.tsx) 수정.

import에 `backfillPlaceCoords` 추가:

```tsx
import { createPlace, updatePlace, deletePlace, backfillPlaceCoords } from "@/actions/place";
```

`const [pending, startTransition] = useTransition();` 아래에 상태 + 핸들러 추가:

```tsx
  const [backfillMsg, setBackfillMsg] = useState<string>();

  function handleBackfill() {
    setError(undefined);
    setBackfillMsg(undefined);
    startTransition(async () => {
      const result = await backfillPlaceCoords();
      if (result.error) {
        setError(result.error);
        return;
      }
      setBackfillMsg(
        `좌표 변환 완료 — 성공 ${result.done ?? 0} · 실패 ${result.failed ?? 0}`,
      );
      router.refresh();
    });
  }
```

"장소 추가" `Card` 닫는 `</Card>` 바로 다음에 툴바 삽입:

```tsx
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={handleBackfill}
        >
          좌표 없는 장소 일괄 변환
        </Button>
        {backfillMsg && (
          <span className="text-sm text-gray-500">{backfillMsg}</span>
        )}
      </div>
```

- [ ] **Step 4: 타입체크 통과 확인**

Run: `npx tsc --noEmit 2>&1 | grep "PlaceManager" || echo "no errors in PlaceManager"`
Expected: `no errors in PlaceManager`

- [ ] **Step 5: 라이브 확인**

관리자로 `/admin/places` 접속 → "좌표 없는 장소 일괄 변환" 클릭 → `성공 N · 실패 M` 표시되고 목록 배지가 "핀 있음"으로 갱신. 이후 Task 3의 이벤트 상세를 새로고침하면 저장 좌표 경로로 지도가 뜬다(폴백 지오코딩 호출 없음 — 네트워크 탭에서 view 시 geocode 요청 없음 확인).

- [ ] **Step 6: 커밋**

```bash
git add src/actions/place.ts src/app/admin/places/PlaceManager.tsx
git commit -m "feat: 좌표 없는 장소 일괄 지오코딩 관리자 버튼"
```

---

## 실행 순서 메모

Task 1 → 2 → 3 이 지도 표시(핵심)를 완성한다. Task 4는 데이터 정리(성능·배지 정확도)로 독립적이라 나중에 해도 무방하다.
