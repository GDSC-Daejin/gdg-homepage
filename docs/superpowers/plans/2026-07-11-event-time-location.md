# 이벤트 진행시간·장소/주소 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이벤트에 종료 일시(`ends_at`)와 주소(`address`) 구조화 필드를 추가하고, 상세 페이지에 진행시간 범위·주소 복사·구글맵 링크를 표시한다.

**Architecture:** Supabase `events` 테이블에 nullable `ends_at`, 기본값 `''`인 `address` 컬럼 추가 → 타입/스키마/서버액션/어드민 폼에 전파 → 상세 페이지는 클라이언트 컴포넌트 `EventLocation`(주소 복사+구글맵)과 시간 범위 포맷 헬퍼로 렌더.

**Tech Stack:** Next.js(App Router), TypeScript strict, React, Zod, Supabase(Postgres), Vitest.

## Global Constraints

- `AGENTS.md`: Next.js 버전이 학습 데이터와 다를 수 있음 — 새 API 사용 전 `node_modules/next/dist/docs/` 확인.
- 한국어 UI 카피. 기존 컴포넌트(`Input`, `DatePicker`, `Card` 등)와 스타일 관례 준수.
- 코드 리뷰에 Opus 사용 금지(사용자 명시 요청 시에만).
- Typecheck: `npx tsc --noEmit`. Test: `npx vitest run`.
- 커밋 메시지에 `Co-Authored-By` 라인 금지(훅이 거부함).
- 기존 데이터 백필 없음: `address` 기본값 `''`, `ends_at` null. 표시 로직이 빈 값/null을 fallback 처리.

---

### Task 1: DB 마이그레이션 + 타입 + demoData

**Files:**
- Create: `supabase/migrations/0011_event_time_location.sql`
- Modify: `src/lib/types.ts:43-54` (Event 인터페이스)
- Modify: `src/lib/demoData.ts:30-38` (demo Event 객체들)

**Interfaces:**
- Produces: `Event.ends_at: string | null`, `Event.address: string`

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/0011_event_time_location.sql`:

```sql
-- 이벤트 종료 일시(nullable) + 주소 컬럼 추가
alter table public.events add column ends_at timestamptz;
alter table public.events add column address text not null default '';
```

- [ ] **Step 2: Event 타입에 필드 추가**

`src/lib/types.ts` — `Event` 인터페이스에서 `starts_at` 아래에 `ends_at`, `location` 아래에 `address` 추가:

```ts
export interface Event {
  id: string;
  type: EventType;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  address: string;
  speaker: string;
  capacity: number | null;
  created_by: string | null;
  created_at: string;
}
```

- [ ] **Step 3: demoData 이벤트 객체에 필드 추가**

`src/lib/demoData.ts` — 8개 demo Event 객체(`demo-e1`~`demo-e8`) 각각에 `ends_at: null, address: ""` 추가. 예시(demo-e1):

```ts
{ id: "demo-e1", type: "mogakco", title: "8월 모각코", description: "모두 각자 코딩 — 다같이 모여 각자 할 일을 하는 자율 세션", starts_at: "2026-08-20T05:00:00.000Z", ends_at: null, location: "공학관 401호", address: "", speaker: "", capacity: 30, created_by: "demo-m1", created_at: "2026-06-01T00:00:00.000Z" },
```

나머지 7개도 동일하게 `starts_at` 뒤 `ends_at: null`, `location` 뒤 `address: ""` 삽입.

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS. (demoData 외에 `Event`를 리터럴로 만드는 곳이 있으면 에러가 나므로 그 파일도 동일 패턴으로 필드 추가.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_event_time_location.sql src/lib/types.ts src/lib/demoData.ts
git commit -m "feat: 이벤트 ends_at·address 컬럼과 타입 추가"
```

---

### Task 2: 스키마 검증 + 테스트

**Files:**
- Modify: `src/lib/schemas.ts:14-22` (eventSchema)
- Modify: `tests/schemas.test.ts` (eventSchema 테스트 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `eventSchema`가 `ends_at`(optional, nullable), `address`(string)를 받고, `ends_at`이 있으면 `starts_at`보다 뒤임을 검증.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/schemas.test.ts` — import에 `eventSchema` 추가하고 파일 끝에 블록 추가:

```ts
describe("eventSchema", () => {
  const base = {
    type: "session" as const,
    title: "정기세션",
    description: "",
    starts_at: "2026-07-23T03:00:00.000Z",
    location: "서울 청년센터 도봉 1층",
    address: "서울특별시 도봉구 마들로11길 75",
    speaker: "",
    capacity: null,
  };

  it("ends_at 없이 통과한다", () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it("ends_at이 starts_at보다 뒤면 통과한다", () => {
    const r = eventSchema.safeParse({ ...base, ends_at: "2026-07-23T07:00:00.000Z" });
    expect(r.success).toBe(true);
  });

  it("ends_at이 starts_at보다 앞이면 reject한다", () => {
    const r = eventSchema.safeParse({ ...base, ends_at: "2026-07-23T01:00:00.000Z" });
    expect(r.success).toBe(false);
  });

  it("ends_at이 null이면 통과한다", () => {
    expect(eventSchema.safeParse({ ...base, ends_at: null }).success).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — `eventSchema` import 실패 또는 `address`/`ends_at` 관련 실패.

- [ ] **Step 3: eventSchema 수정**

`src/lib/schemas.ts` — `eventSchema`를 다음으로 교체:

```ts
export const eventSchema = z
  .object({
    type: z.enum(["session", "study", "mogakco"]),
    title: z.string().min(1, "제목을 입력해주세요"),
    description: z.string(),
    starts_at: z.string().min(1, "일시를 입력해주세요"),
    ends_at: z.string().nullable().optional(),
    location: z.string(),
    address: z.string(),
    speaker: z.string(),
    capacity: z.coerce.number().int().positive().nullable(),
  })
  .refine(
    (v) => !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at),
    { message: "종료 일시는 시작 일시보다 뒤여야 해요", path: ["ends_at"] },
  );
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS (기존 테스트 포함 전부).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/schemas.test.ts
git commit -m "feat: eventSchema에 ends_at·address 검증 추가"
```

---

### Task 3: 서버 액션 폼 파싱

**Files:**
- Modify: `src/actions/event.ts:11-21` (parseEventForm)

**Interfaces:**
- Consumes: `eventSchema` (Task 2)
- Produces: `parseEventForm`이 `ends_at`(빈 값 → null), `address`를 파싱.

- [ ] **Step 1: parseEventForm 수정**

`src/actions/event.ts` — `parseEventForm` 내 `safeParse` 인자에 두 필드 추가:

```ts
function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at") || null,
    location: formData.get("location"),
    address: formData.get("address"),
    speaker: formData.get("speaker"),
    capacity: formData.get("capacity") || null,
  });
}
```

`insert`/`update`는 `...parsed.data`를 그대로 쓰므로 추가 변경 불필요. (`parsed.data`에 `ends_at`, `address` 포함됨.)

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/actions/event.ts
git commit -m "feat: 이벤트 액션에서 ends_at·address 파싱"
```

---

### Task 4: 어드민 폼 필드

**Files:**
- Modify: `src/app/admin/events/EventForm.tsx` (handleSubmit + 일시/장소 그리드)

**Interfaces:**
- Consumes: `Event.ends_at`, `Event.address` (Task 1)
- Produces: `ends_at`, `address` 를 담은 FormData 제출.

- [ ] **Step 1: handleSubmit에 ends_at ISO 변환 추가**

`src/app/admin/events/EventForm.tsx` — `handleSubmit`에서 `starts_at` 변환 블록 바로 아래에 추가:

```ts
    const startsAt = formData.get("starts_at");
    if (typeof startsAt === "string" && startsAt) {
      formData.set("starts_at", new Date(startsAt).toISOString());
    }
    const endsAt = formData.get("ends_at");
    if (typeof endsAt === "string" && endsAt) {
      formData.set("ends_at", new Date(endsAt).toISOString());
    }
```

- [ ] **Step 2: 일시 그리드에 종료 일시 추가**

같은 파일 — `일시`/`정원` 2열 그리드를 다음으로 교체(종료 일시를 정원 위에 배치하고 정원은 그 아래 단독 행으로 이동):

```tsx
      <div className="grid grid-cols-2 gap-4">
        <DatePicker
          withTime
          name="starts_at"
          label={
            isEdit ? (
              "시작"
            ) : (
              <>
                시작 <RequiredMark /> <OptionalMark>KST 기준</OptionalMark>
              </>
            )
          }
          defaultValue={event ? toKstDatetimeLocal(event.starts_at) : ""}
          required
        />
        <DatePicker
          withTime
          name="ends_at"
          label={isEdit ? "종료" : <>종료 <OptionalMark /></>}
          defaultValue={event?.ends_at ? toKstDatetimeLocal(event.ends_at) : ""}
        />
      </div>

      <Input
        type="number"
        name="capacity"
        label={isEdit ? "정원" : <>정원 <OptionalMark>선택 · 비우면 무제한</OptionalMark></>}
        placeholder="예) 30"
        min={1}
        defaultValue={event?.capacity ?? undefined}
      />
```

(기존 `일시`/`정원` 그리드 블록 전체를 위 내용으로 대체.)

- [ ] **Step 3: 장소 그리드에 주소 추가**

같은 파일 — `장소`/`발표자` 2열 그리드 블록 바로 아래(닫는 `</div>` 다음)에 주소 입력 추가:

```tsx
      <Input
        name="address"
        label={isEdit ? "주소" : <>주소 <OptionalMark>도로명주소</OptionalMark></>}
        placeholder="예) 서울특별시 도봉구 마들로11길 75"
        defaultValue={event?.address}
      />
```

- [ ] **Step 4: 타입 체크 + 프리뷰 확인**

Run: `npx tsc --noEmit`
Expected: PASS.

프리뷰(`preview_start` name로 dev 서버) → `/admin/events/new` 또는 기존 이벤트 수정 페이지에서 시작/종료/장소/주소 필드가 보이고, 종료 < 시작으로 저장 시 "종료 일시는 시작 일시보다 뒤여야 해요" 에러가 뜨는지 확인. (데모 모드면 저장이 no-op이므로 검증은 로컬 Supabase 연결 시.)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/events/EventForm.tsx
git commit -m "feat: 이벤트 폼에 종료 일시·주소 필드 추가"
```

---

### Task 5: 시간 범위 포맷 헬퍼

**Files:**
- Modify: `src/lib/format.ts` (formatKstRange, formatKstTime 추가)
- Create: `tests/format.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `formatKstRange(start: string, end: string | null): string`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatKstRange } from "@/lib/format";

describe("formatKstRange", () => {
  it("종료가 없으면 시작 일시만 반환한다", () => {
    const s = "2026-07-23T03:00:00.000Z"; // KST 12:00
    expect(formatKstRange(s, null)).toBe("2026. 7. 23. 오후 12:00");
  });

  it("같은 날이면 시작 일시 + 종료 시각만 붙인다", () => {
    const s = "2026-07-23T03:00:00.000Z"; // KST 12:00
    const e = "2026-07-23T07:00:00.000Z"; // KST 16:00
    expect(formatKstRange(s, e)).toBe("2026. 7. 23. 오후 12:00 ~ 오후 4:00");
  });

  it("다른 날이면 시작·종료 전체를 표시한다", () => {
    const s = "2026-07-23T15:00:00.000Z"; // KST 07-24 00:00
    const e = "2026-07-24T03:00:00.000Z"; // KST 07-24 12:00
    const out = formatKstRange(s, e);
    expect(out).toContain("~");
    expect(out).toContain("7. 24.");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — `formatKstRange`가 없음.

- [ ] **Step 3: 헬퍼 구현**

`src/lib/format.ts` 끝에 추가:

```ts
function kstDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatKstTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** 시작~종료 일시. 종료 없으면 시작만, 같은 날이면 종료는 시각만 표시. */
export function formatKstRange(start: string, end: string | null): string {
  if (!end) return formatKst(start);
  if (kstDay(start) === kstDay(end)) {
    return `${formatKst(start)} ~ ${formatKstTime(end)}`;
  }
  return `${formatKst(start)} ~ ${formatKst(end)}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS. (문자열이 로케일 출력과 다르면 실제 출력에 맞춰 기대값을 조정 — 핵심은 "같은 날=시각만, 다른 날=전체, null=시작만" 분기.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/format.test.ts
git commit -m "feat: 이벤트 진행시간 범위 포맷 헬퍼 추가"
```

---

### Task 6: 상세 페이지 표시 (진행시간 + 주소 UI)

**Files:**
- Create: `src/components/EventLocation.tsx`
- Modify: `src/app/(member)/events/[id]/page.tsx:8,54-60`

**Interfaces:**
- Consumes: `formatKstRange` (Task 5), `Event.ends_at`, `Event.address`, `Event.location`
- Produces: 없음(최종 소비자)

- [ ] **Step 1: EventLocation 클라이언트 컴포넌트 작성**

Create `src/components/EventLocation.tsx`:

```tsx
"use client";

import { useState } from "react";

export function EventLocation({
  location,
  address,
}: {
  location: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="text-sm text-gray-700">
      {location && <p>장소: {location}</p>}
      {address && (
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-gray-500">
          <span>{address}</span>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            지도
          </a>
          <button
            type="button"
            onClick={copy}
            className="text-primary hover:underline"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 상세 페이지에서 사용**

`src/app/(member)/events/[id]/page.tsx`:

import 수정 (line 8):
```ts
import { formatKstRange } from "@/lib/format";
import { EventLocation } from "@/components/EventLocation";
```

시간 표시(line 55) `{formatKst(e.starts_at)}` → `{formatKstRange(e.starts_at, e.ends_at)}`.

장소 블록(line 58-60)을 교체:
```tsx
        {(e.location || e.address) && (
          <EventLocation location={e.location} address={e.address} />
        )}
```

(기존 `formatKst` import가 이 파일에서 더 이상 쓰이지 않으면 import에서 제거.)

- [ ] **Step 3: 타입 체크 + 프리뷰 확인**

Run: `npx tsc --noEmit`
Expected: PASS.

프리뷰에서 이벤트 상세 페이지 확인:
- 종료 있는 이벤트: `... 오후 12:00 ~ 오후 4:00` 형태로 표시
- 주소 있는 이벤트: 주소 아래 "지도"(새 탭 구글맵), "복사"(클릭 시 "복사됨") 동작
- 주소 없는 기존 이벤트: 장소명만, 지도/복사 미표시

`read_console_messages`로 에러 없음 확인, 복사 버튼 클릭 후 `read_page`로 "복사됨" 라벨 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/EventLocation.tsx "src/app/(member)/events/[id]/page.tsx"
git commit -m "feat: 이벤트 상세에 진행시간 범위·주소 복사·지도 링크 표시"
```

---

## 범위 밖 (이 계획에서 다루지 않음)

- 목록 화면(멤버 홈, 어드민 목록)은 기존대로 시작 시각·장소명만 표시(컴팩트 유지). 필요 시 별도 작업.
- `supabase/seed.sql`은 컬럼을 명시적으로 나열하므로 기본값으로 정상 동작 — 변경 없음(샘플 주소가 필요하면 별도).
- 지도 임베드(iframe/SDK), 좌표 저장.
- 기존 description에 적힌 시간/주소 텍스트 자동 이전.

## Self-Review 체크

- **Spec 커버리지**: ends_at(T1,2,3,4,5,6) · address(T1,2,3,4,6) · 검증 ends_at>starts_at(T2) · 구글맵+복사(T6) · description 순수화(폼 필드 분리로 달성) — 전부 매핑됨.
- **Placeholder**: 없음. 모든 코드 블록 실제 내용.
- **타입 일관성**: `formatKstRange(start, end)` 시그니처 T5 정의 = T6 사용 일치. `EventLocation({location, address})` T6 정의=사용 일치. `ends_at: string | null` 전 태스크 일관.
