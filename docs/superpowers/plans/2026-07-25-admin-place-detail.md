# 어드민 장소 상세 페이지 (지도 + 운영 메모)

- 작성일: 2026-07-25
- 범위: 어드민 전용. 멤버 화면 변경 없음.

## 목표

`/admin/places` 목록에서 장소명을 누르면 `/admin/places/[id]` 상세로 이동해서 (1) 네이버 지도에 핀이 찍힌 위치, (2) 주소·복사·네이버 지도 링크, (3) 운영자가 직접 적는 **운영 메모**(오시는 길·주차·출입·와이파이), (4) 이 장소에서 열린 이벤트 목록을 한 화면에서 본다.

네이버 장소의 사진·리뷰·평점·영업시간은 공개 API로 얻을 수 없고(`docs/research/naver-place-detail-api-research-2026-07-20.md`) 크롤링은 약관·유지보수 리스크로 채택하지 않는다. 대신 네이버에 없는 운영 정보를 운영자가 직접 채운다.

**신규 외부 API·의존성 0.** 지도는 기존 컴포넌트 재사용, 좌표는 이미 DB에 있다. 새 마이그레이션은 컬럼 1개.

## 대상 파일 + 현재 상태 (실측)

| 파일 | 현재 상태 |
| --- | --- |
| `supabase/migrations/0026_places.sql` | `places(id, name, address, lat, lng, created_at)`. RLS 정책 2개 — `places: read all`(로그인), `places: admin all`(`is_admin()`). **정책은 테이블 단위라 컬럼 추가 시 정책 변경 불필요.** `events.place_id` FK도 여기서 추가됨 |
| `supabase/migrations/` 마지막 번호 | `0051_admin_set_slack_link.sql` → **다음 번호는 0052** |
| `src/lib/types.ts:122-129` | `interface Place { id, name, address, lat, lng, created_at }` — `notes` 없음 |
| `src/components/NaverMap.tsx:43` | `<NaverMap coords={Coords|null} address={string} zoom={16} />`. 좌표 있으면 바로 렌더, 없으면 SDK `Service.geocode`로 주소 폴백. 키 없음·소스 없음·실패 시 `null` 반환(카드 안 깨짐). 높이 `h-56` 고정 |
| `src/components/EventLocation.tsx:5` | `"use client"`. `location`이 truthy일 때만 `장소: {location}` 줄을 렌더하고, `address`가 있으면 주소 + `map.naver.com/p/search/{address}` 링크 + 클립보드 복사 버튼을 렌더 |
| `src/actions/place.ts:11-16` | `readPlaceForm(formData)`가 `{name, address}`만 파싱. `updatePlace`(39행)는 이 파서 결과로 `.update({name, address})` — **notes를 건드리지 않는다** |
| `src/app/admin/places/page.tsx` | 서버 컴포넌트. `dynamic = "force-dynamic"`, 데모면 빈 배열, `PageHeader` + `PlaceManager` |
| `src/app/admin/places/PlaceManager.tsx:171-180` | 목록 카드. 이름이 `<p className="truncate font-medium text-gray-900">{place.name}</p>` — **링크 아님** |
| `src/app/admin/layout.tsx:28` | 레이아웃에서 `requireAdmin()` 호출. 단, `src/app/admin/members/[id]/page.tsx:26`은 페이지에서도 한 번 더 호출 — **이 관례를 따른다** |
| `src/lib/demoData.ts` | `Place` 데모 데이터 **없음**. 데모 모드에서 목록이 비어 상세로 가는 링크 자체가 생기지 않는다 |
| `src/lib/format.ts` | `formatKstDate(iso)` — "2026. 7. 25." 형태 |
| `tests/admin-places-layout.test.ts` | `PlaceManager.tsx` **소스 문자열**을 단언한다. `flex flex-col gap-3 sm:flex-row sm:items-end`, `sm:w-56`, `pendingCount > 0 &&`, `bg-warning-soft`, `장소를 쓰던 이벤트의 장소 정보가 비워질 수 있어요` 등이 사라지면 실패. `핀 있음`, `bg-success-soft`, `confirm(`는 등장하면 실패 |
| `package.json` | `test: vitest run`, `build: next build`. eslint 미설치 |

## 정확한 변경

### 1. `supabase/migrations/0052_place_notes.sql` (신규)

```sql
-- 장소 운영 메모: 오시는 길·주차·출입·와이파이 등 네이버 지도에 없는 정보를 운영자가 직접 적는다
alter table public.places add column notes text not null default '';
```

0026의 RLS 정책이 테이블 단위이므로 추가 정책은 없다.

### 2. `src/lib/types.ts` — `Place`에 필드 1개

```ts
export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string;        // ← 추가
  created_at: string;
}
```

### 3. `src/actions/place.ts` — 액션 1개 추가 (기존 액션 수정 금지)

파일 끝에 추가한다.

```ts
// 메모는 목록 인라인 수정 폼에 없다 — readPlaceForm/updatePlace에 합치면 인라인 저장 시 메모가 지워진다
export async function updatePlaceNotes(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const notes = String(formData.get("notes") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.from("places").update({ notes }).eq("id", id);

  if (error) return { error: toKoreanError(error) };
  revalidatePath(`/admin/places/${id}`);
  return {};
}
```

**`readPlaceForm`에 `notes`를 추가하지 마라.** 목록의 인라인 수정 폼에는 notes 입력이 없어서, 파서에 넣으면 이름만 고쳐도 메모가 빈 문자열로 덮인다.

### 4. `src/app/admin/places/[id]/page.tsx` (신규, 서버 컴포넌트)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { NaverMap } from "@/components/NaverMap";
import { EventLocation } from "@/components/EventLocation";
import { formatKstDate } from "@/lib/format";
import type { Place } from "@/lib/types";
import { PlaceNotesForm } from "./PlaceNotesForm";

interface PlaceEventRow {
  id: string;
  title: string;
  starts_at: string;
}

export const dynamic = "force-dynamic";

export default async function AdminPlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  // 데모 모드엔 places 데이터가 없어 목록도 비어 있다 — 상세로 오는 링크 자체가 없다
  if (await isDemoMode()) notFound();

  const supabase = await createClient();
  const { data: placeData } = await supabase
    .from("places")
    .select("*")
    .eq("id", id)
    .single();
  if (!placeData) notFound();
  const place = placeData as Place;

  const { data: eventData } = await supabase
    .from("events")
    .select("id, title, starts_at")
    .eq("place_id", id)
    .order("starts_at", { ascending: false });
  const events = (eventData ?? []) as PlaceEventRow[];

  const coords =
    place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng }
      : null;

  return (
    <div>
      <PageHeader
        title={place.name}
        description={place.address || "주소 미등록"}
        action={
          <Link
            href="/admin/places"
            className="text-sm text-primary hover:underline"
          >
            장소 목록
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 overflow-hidden p-0">
          <p className="px-6 pt-6 text-sm font-semibold text-gray-900">위치</p>
          {place.address ? (
            <div className="px-6">
              {/* location=""이면 EventLocation이 이름 줄을 건너뛴다 — 제목에 이미 있다 */}
              <EventLocation location="" address={place.address} />
            </div>
          ) : (
            <p className="px-6 pb-6 text-sm text-gray-500">
              주소를 등록하면 지도에 핀이 찍혀요.
            </p>
          )}
          {/* 키·좌표·주소가 모두 없으면 NaverMap이 null을 반환한다 */}
          <NaverMap coords={coords} address={place.address} />
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">운영 메모</p>
            <p className="mt-1 text-xs text-gray-400">
              네이버 지도에 없는 정보를 적어두면 이벤트 준비할 때 바로 확인할 수 있어요.
            </p>
          </div>
          <PlaceNotesForm placeId={place.id} notes={place.notes} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              이 장소의 이벤트
            </h2>
            <p className="text-xs text-gray-400">최근순 · 총 {events.length}건</p>
          </div>
          {events.length === 0 ? (
            <EmptyState title="이 장소에서 열린 이벤트가 없어요" />
          ) : (
            <ul className="flex flex-col divide-y divide-gray-200">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="truncate text-sm text-gray-900 hover:underline"
                  >
                    {event.title}
                  </Link>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatKstDate(event.starts_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
```

### 5. `src/app/admin/places/[id]/PlaceNotesForm.tsx` (신규, 클라이언트)

`PlaceManager`의 `useTransition` + `router.refresh()` 패턴을 그대로 따른다.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlaceNotes } from "@/actions/place";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";

export function PlaceNotesForm({
  placeId,
  notes,
}: {
  placeId: string;
  notes: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(undefined);
        setSaved(false);
        startTransition(async () => {
          const result = await updatePlaceNotes(placeId, fd);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSaved(true);
          router.refresh();
        });
      }}
      className="flex flex-col gap-3"
    >
      <Textarea
        name="notes"
        rows={5}
        defaultValue={notes}
        placeholder={"예) 3층 세미나실 — 정문 옆 엘리베이터\n주차: 건물 뒤편, 2시간 무료\n와이파이: GDG-GUEST"}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          저장
        </Button>
        {saved && <span className="text-xs text-gray-500">저장됐어요</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </form>
  );
}
```

### 6. `src/app/admin/places/PlaceManager.tsx` — 이름을 링크로 (이 2줄만)

파일 상단에 `import Link from "next/link";`를 추가하고, 171~180행 목록 카드의 이름 줄만 바꾼다.

변경 전:
```tsx
<p className="truncate font-medium text-gray-900">{place.name}</p>
```
변경 후:
```tsx
<Link
  href={`/admin/places/${place.id}`}
  className="truncate font-medium text-gray-900 hover:underline"
>
  {place.name}
</Link>
```

**다른 줄은 건드리지 마라.** `tests/admin-places-layout.test.ts`가 이 파일의 클래스 문자열과 배지·모달 로직을 문자열로 단언한다.

### 7. `tests/admin-place-detail.test.ts` (신규)

기존 `tests/admin-places-layout.test.ts`의 소스 문자열 단언 관례를 따른다.

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/admin/places/[id]/page.tsx";
const ACTIONS = "src/actions/place.ts";
const MANAGER = "src/app/admin/places/PlaceManager.tsx";
const MIGRATION = "supabase/migrations/0052_place_notes.sql";

describe("관리자 장소 상세", () => {
  it("목록에서 장소명을 누르면 상세로 간다", async () => {
    const source = await readFile(MANAGER, "utf8");
    expect(source).toContain("/admin/places/${place.id}");
  });

  it("상세가 지도·운영 메모·이벤트 목록을 담는다", async () => {
    const source = await readFile(PAGE, "utf8");
    expect(source).toContain('from "@/components/NaverMap"');
    expect(source).toContain("PlaceNotesForm");
    expect(source).toContain('eq("place_id"');
    expect(source).toContain("notFound()");
  });

  it("메모는 별도 액션이라 목록 인라인 수정이 메모를 지우지 않는다", async () => {
    const source = await readFile(ACTIONS, "utf8");
    expect(source).toContain("updatePlaceNotes");
    // readPlaceForm은 목록 인라인 폼(notes 입력 없음)의 파서다
    const parser = source.slice(
      source.indexOf("function readPlaceForm"),
      source.indexOf("export async function createPlace"),
    );
    expect(parser).not.toContain("notes");
  });

  it("notes 컬럼은 NOT NULL DEFAULT ''", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    expect(sql).toContain("add column notes text not null default ''");
  });
});
```

## 완료 정의 (DoD)

- [ ] `supabase/migrations/0052_place_notes.sql` 생성 (내용 위와 동일)
- [ ] `Place` 타입에 `notes: string` 추가
- [ ] `updatePlaceNotes` 액션 추가, `readPlaceForm`/`updatePlace`/`createPlace`/`deletePlace`/`backfillPlaceCoords` **무수정**
- [ ] `/admin/places/[id]` 페이지 + `PlaceNotesForm` 생성
- [ ] `PlaceManager`에서 장소명이 상세 링크 (다른 줄 무수정)
- [ ] `tests/admin-place-detail.test.ts` 4개 전부 green
- [ ] `tests/admin-places-layout.test.ts` 여전히 green (회귀 없음)
- [ ] `npm run build` 통과
- [ ] 멤버 화면(`src/app/(member)/**`) 변경 0줄

## 검증 커맨드 (green 될 때까지 반복)

```bash
npx tsc --noEmit
npx vitest run tests/admin-place-detail.test.ts tests/admin-places-layout.test.ts tests/geocode.test.ts
npm run build
```

## 건드리지 말 것 (스코프 펜스)

- `src/components/NaverMap.tsx`, `src/components/EventLocation.tsx`, `src/lib/geocode.ts`, `src/lib/mapSource.ts` — 재사용만. 수정 금지.
- `src/app/(member)/**` — 멤버 화면 전부.
- `src/actions/place.ts`의 기존 5개 함수와 `readPlaceForm`.
- `PlaceManager.tsx`의 이름 줄 외 모든 줄 (추가 폼 클래스, 배지, 일괄 변환, 삭제 모달).
- `.env*`, `package.json`, `next.config.*`.
- **git 명령 금지** — 커밋·푸시는 사람이 한다 (같은 워킹트리에 병행 세션의 미커밋 변경이 다수 있음).
- 네이버 지역검색 API·크롤링·새 의존성 추가 금지. 이번 범위 밖이다.

## 알려진 지뢰 (추적 금지)

- 이 레포는 표준 Next.js가 아니다 — 먼저 `AGENTS.md`를 읽고, 필요하면 `node_modules/next/dist/docs/`를 확인한다.
- `tests/accessibility-primitives.test.ts` — eslint 미설치로 **상시 실패**. 회귀 아니다. `package.json` 고치지 마라.
- turbopack dev의 `adapterFn` 반복 에러 = dev 캐시 이슈. 코드 문제 아니다.
- `npm install`이 EACCES로 죽으면 npm 캐시 소유권 문제다. sudo 실행하지 말고 멈추고 보고하라.

## 배포 (사람이 직접, Codex 아님)

이 저장소는 마이그레이션 CI가 없다. **코드보다 마이그레이션을 먼저 적용한다** — 순서가 뒤집히면 메모 저장이 "column does not exist"로 실패한다.

```bash
supabase migration list
```

중복 버전이 `db push`를 막은 전례가 있으니 목록부터 실측한 뒤 `0052`를 적용하고, 그다음 코드를 배포한다.

## 나중 (이번 범위 아님)

네이버 검색 API 지역검색으로 `category` + 네이버 상세 링크만 캐싱하는 3단계. 별도 키(네이버 개발자센터, NCP 지도 키와 다름) 발급이 필요하고 얻는 정보가 적어 보류.
