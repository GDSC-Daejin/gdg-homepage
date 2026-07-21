# 이벤트 리마인더 · 정원 승급 알림 · 홈 대시보드 보강 구현 계획

> **For agentic workers (Codex 등):** 이 계획을 태스크 단위로 순서대로 실행한다. 각 스텝은 체크박스(`- [ ]`)로 추적한다. 태스크마다 마지막에 커밋한다. 코드베이스 사전 지식이 없다고 가정하고 모든 코드·경로·명령을 그대로 담았다.

**Goal:** [docs/improvement-proposals.md](../../plans/improvement-proposals.md)의 상위 제안 중 ②(이벤트 리마인더 + 정원 승급 알림)와 ③(회원 홈 대시보드 보강)을 구현한다.

**Architecture:** 리마인더는 기존 출석 경고 cron(`/api/cron/attendance-warning`)과 동일한 패턴 — Community Store reads + 순수 메시지 빌더(vitest 테스트) + Vercel cron 라우트 + Slack webhook. 승급 알림은 `cancel_registration` RPC가 승급자 이름을 반환하도록 마이그레이션하고 서버 액션에서 Slack으로 전송. 대시보드는 기존 `HomeDashboard` 서버 컴포넌트에 미응답 설문 배너와 이번 달 포인트 카드를 추가.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Supabase (RLS/RPC, plpgsql) · Tailwind 4 · vitest 4

## 스코프 결정 (제안 문서 대비)

- **제안 ① 출석 자동 포인트 적립 — 이미 구현됨. 제외.** `supabase/migrations/0004_phase2.sql:89-98`의 `on_attendance_points` 트리거가 출석 insert마다 +10포인트를 적립한다. 제안 문서가 이를 놓쳤다.
- **제안 ④ 통합 검색, ⑤ 인앱 알림 센터 — 이 계획에서 제외.** 제안 문서 스스로 "데이터 확인 후 착수"로 게이트했다. 착수가 결정되면 별도 계획서로 작성한다.

## Global Constraints

- **AGENTS.md 필독**: 이 프로젝트의 Next.js는 훈련 데이터와 다를 수 있다. Next 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 가이드를 읽을 것.
- 사용자 노출 문구는 전부 한국어, 에러 메시지는 해요체(예: "권한이 없어요").
- Postgres 함수는 `security definer set search_path = public` + 말미에 `revoke execute ... from public, anon;` 후 `grant execute ... to authenticated;` (기존 마이그레이션 0001·0004 패턴).
- 날짜/시간 표시는 반드시 `src/lib/format.ts`의 KST 헬퍼 사용. 월 키는 `monthKst()`가 주는 `"YYYY-MM"`.
- 서버 액션은 `"use server"` + `ActionResult` 반환 + `toKoreanError`로 에러 변환 (기존 `src/actions/*.ts` 패턴).
- 테스트는 `tests/*.test.ts`에 vitest로, **순수 함수만** 테스트한다 (기존 `tests/attendance-warnings.test.ts` 패턴). 실행: `npm test` 또는 `npx vitest run tests/<파일>`.
- 커밋 메시지는 한국어 conventional commit (`feat: ...`, `fix: ...`) — `git log --oneline` 참조.
- 마이그레이션 파일 번호는 `0024`부터 (현재 마지막이 `0023_member_nickname.sql`).
- 마이그레이션은 파일 작성까지만 한다. **DB 적용(`supabase db push` 또는 SQL 에디터)은 사람이 수행** — 계획 실행자는 적용을 시도하지 말 것.

---

### Task 1: Community Store에 EventReads 추가

리마인더 cron이 이벤트를 읽을 통로. 기존 `AttendanceReads`와 같은 구조로 `EventReads`를 추가한다.

**Files:**
- Modify: `src/lib/community/types.ts`
- Modify: `src/lib/community/supabase.ts`
- Modify: `src/lib/community/demo.ts`

**Interfaces:**
- Produces: `EventReads.eventsStartingBetween(fromIso: string, toIso: string): Promise<Event[]>`, `EventReads.confirmedCounts(eventIds: string[]): Promise<Record<string, number>>`, `Community.events: EventReads` — Task 3이 사용.

- [ ] **Step 1: types.ts에 EventReads 추가**

`src/lib/community/types.ts` 전체를 다음으로 교체:

```ts
import type { Event, Profile } from "@/lib/types";

export type EventUserPair = { user_id: string; event_id: string };

export interface AttendanceReads {
  activeMembers(): Promise<Profile[]>;
  pastEventIds(beforeIso: string): Promise<string[]>;
  confirmedRegistrations(eventIds: string[]): Promise<EventUserPair[]>;
  attendances(eventIds: string[]): Promise<EventUserPair[]>;
}

export interface EventReads {
  /** starts_at이 [fromIso, toIso) 구간인 이벤트, 시작 시각 오름차순 */
  eventsStartingBetween(fromIso: string, toIso: string): Promise<Event[]>;
  confirmedCounts(eventIds: string[]): Promise<Record<string, number>>;
}

export interface Community {
  attendance: AttendanceReads;
  events: EventReads;
}
```

- [ ] **Step 2: supabase.ts에 구현 추가**

`src/lib/community/supabase.ts`에서 import 줄을 다음으로 바꾸고:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Event, Profile } from "@/lib/types";
import type { AttendanceReads, Community, EventReads, EventUserPair } from "./types";
```

파일 끝의 `return { attendance };` 바로 앞에 추가:

```ts
  const events: EventReads = {
    async eventsStartingBetween(fromIso, toIso) {
      const { data } = await client
        .from("events")
        .select("*")
        .gte("starts_at", fromIso)
        .lt("starts_at", toIso)
        .order("starts_at", { ascending: true });
      return (data as Event[]) ?? [];
    },
    async confirmedCounts(eventIds) {
      if (eventIds.length === 0) return {};
      const { data } = await client.rpc("event_confirmed_counts", {
        p_event_ids: eventIds,
      });
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.event_id] = Number(row.confirmed);
      }
      return counts;
    },
  };
```

그리고 `return { attendance };`를 `return { attendance, events };`로 변경.

- [ ] **Step 3: demo.ts에 no-op 구현 추가**

`src/lib/community/demo.ts`의 `demoCommunity` 객체에 `attendance` 다음 프로퍼티로 추가:

```ts
  events: {
    async eventsStartingBetween() {
      return [];
    },
    async confirmedCounts() {
      return {};
    },
  },
```

- [ ] **Step 4: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/lib/community/types.ts src/lib/community/supabase.ts src/lib/community/demo.ts
git commit -m "feat: Community Store에 EventReads 추가"
```

---

### Task 2: 리마인더 메시지 빌더 (TDD)

Slack 메시지 문자열을 만드는 순수 함수. cron 라우트에서 호출한다.

**Files:**
- Create: `src/lib/event-reminder.ts`
- Test: `tests/event-reminder.test.ts`

**Interfaces:**
- Consumes: `Event` 타입 (`src/lib/types.ts` — `type`, `title`, `starts_at`, `location`, `capacity` 필드 사용)
- Produces: `buildEventReminderMessage(events: Event[], counts: Record<string, number>): string | null` — Task 3이 사용. 이벤트가 없으면 `null`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/event-reminder.test.ts` 생성:

```ts
import { describe, expect, it } from "vitest";
import { buildEventReminderMessage } from "@/lib/event-reminder";
import type { Event } from "@/lib/types";

function fakeEvent(over: Partial<Event> = {}): Event {
  return {
    id: "e1",
    type: "session",
    title: "6월 정기세션",
    description: "",
    starts_at: "2026-07-17T10:00:00Z", // KST 19:00
    ends_at: null,
    location: "산학협력관 101호",
    address: "",
    speaker: "",
    capacity: 30,
    created_by: null,
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

describe("buildEventReminderMessage", () => {
  it("이벤트가 없으면 null", () => {
    expect(buildEventReminderMessage([], {})).toBeNull();
  });

  it("정원 있는 이벤트: 유형·제목·KST 시각·장소·신청 현황을 담는다", () => {
    const msg = buildEventReminderMessage([fakeEvent()], { e1: 12 });
    expect(msg).toContain("[이벤트 리마인더] 내일 시작하는 이벤트 1건");
    expect(msg).toContain("정기세션");
    expect(msg).toContain("6월 정기세션");
    expect(msg).toContain("오후 7:00");
    expect(msg).toContain("산학협력관 101호");
    expect(msg).toContain("신청 12/30명");
  });

  it("정원 없는 이벤트는 신청 수만 표시한다", () => {
    const msg = buildEventReminderMessage(
      [fakeEvent({ id: "e2", type: "mogakco", capacity: null, location: "" })],
      { e2: 5 },
    );
    expect(msg).toContain("모각코");
    expect(msg).toContain("신청 5명");
    expect(msg).not.toContain("·  ·"); // 빈 장소는 구분자 없이 생략
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/event-reminder.test.ts`
Expected: FAIL — `Cannot find module '@/lib/event-reminder'` 류의 에러

- [ ] **Step 3: 구현**

`src/lib/event-reminder.ts` 생성:

```ts
import { formatKst } from "@/lib/format";
import type { Event, EventType } from "@/lib/types";

const TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

/** 내일 시작 이벤트 목록으로 Slack 리마인더 문자열 생성. 없으면 null. */
export function buildEventReminderMessage(
  events: Event[],
  counts: Record<string, number>,
): string | null {
  if (events.length === 0) return null;

  const lines = events.map((event) => {
    const confirmed = counts[event.id] ?? 0;
    const applied = event.capacity
      ? `신청 ${confirmed}/${event.capacity}명`
      : `신청 ${confirmed}명`;
    const parts = [
      `[${TYPE_LABELS[event.type]}] ${event.title}`,
      formatKst(event.starts_at),
      event.location,
      applied,
    ].filter(Boolean);
    return `- ${parts.join(" · ")}`;
  });

  return `[이벤트 리마인더] 내일 시작하는 이벤트 ${events.length}건\n${lines.join("\n")}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/event-reminder.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/event-reminder.ts tests/event-reminder.test.ts
git commit -m "feat: 이벤트 리마인더 메시지 빌더"
```

---

### Task 3: 리마인더 cron 라우트 + Vercel 스케줄

`src/app/api/cron/attendance-warning/route.ts`와 같은 인증·클라이언트 생성 패턴. 매일 KST 09:00(UTC 00:00)에 앞으로 24시간 내 시작하는 이벤트를 Slack에 공지한다.

**Files:**
- Create: `src/app/api/cron/event-reminder/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: Task 1의 `getCommunity({ client }).events`, Task 2의 `buildEventReminderMessage`, `postSlack` (`src/lib/slack.ts`)

- [ ] **Step 1: 라우트 작성**

`src/app/api/cron/event-reminder/route.ts` 생성:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCommunity } from "@/lib/community";
import { buildEventReminderMessage } from "@/lib/event-reminder";
import { postSlack } from "@/lib/slack";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET이 설정되지 않았어요" },
      { status: 401 },
    );
  }

  if (
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase 서비스 롤 연동이 설정되지 않았어요" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const community = await getCommunity({ client: supabase });

  const now = new Date();
  const dayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await community.events.eventsStartingBetween(
    now.toISOString(),
    dayLater.toISOString(),
  );
  const counts = await community.events.confirmedCounts(events.map((e) => e.id));

  const message = buildEventReminderMessage(events, counts);
  if (!message) {
    return NextResponse.json({ sent: false, count: 0 });
  }

  const { error } = await postSlack(message);
  if (error) {
    return NextResponse.json({ error, sent: false, count: events.length });
  }

  return NextResponse.json({ sent: true, count: events.length });
}
```

- [ ] **Step 2: vercel.json에 스케줄 추가**

`vercel.json` 전체를 다음으로 교체 (UTC 00:00 = KST 09:00):

```json
{
  "crons": [
    {
      "path": "/api/cron/attendance-warning",
      "schedule": "0 0 * * 1"
    },
    {
      "path": "/api/cron/event-reminder",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공, `/api/cron/event-reminder` 라우트가 출력 목록에 표시

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/event-reminder/route.ts vercel.json
git commit -m "feat: 이벤트 리마인더 cron (매일 KST 09:00 Slack 공지)"
```

---

### Task 4: 마이그레이션 — cancel_registration이 승급자 이름 반환

현재 `cancel_registration`(`supabase/migrations/0001_init.sql:128-145`)은 대기자를 조용히 승급시키고 `void`를 반환한다. 반환 타입을 `text`(승급자 이름, 없으면 null)로 바꾼다. Postgres는 반환 타입 변경에 `create or replace`를 허용하지 않으므로 drop 후 재생성하고 grant를 복원한다.

**Files:**
- Create: `supabase/migrations/0024_cancel_returns_promoted.sql`

**Interfaces:**
- Produces: RPC `cancel_registration(p_event_id uuid) returns text` — Task 5가 사용. 취소자가 confirmed였고 대기자가 승급하면 그 회원의 `profiles.name`, 아니면 null.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0024_cancel_returns_promoted.sql` 생성:

```sql
-- cancel_registration: 대기자 승급 시 승급자 이름을 반환한다 (알림용).
-- 반환 타입 변경(void -> text)은 create or replace가 불가하므로 drop 후 재생성.

drop function public.cancel_registration(uuid);

create function public.cancel_registration(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_was text;
  v_promoted_user uuid;
  v_promoted_name text;
begin
  perform 1 from events where id = p_event_id for update;
  delete from event_registrations where event_id = p_event_id and user_id = auth.uid()
    returning status into v_was;
  if v_was is null then raise exception 'NOT_REGISTERED'; end if;
  if v_was = 'confirmed' then
    update event_registrations set status = 'confirmed'
    where id = (
      select id from event_registrations
      where event_id = p_event_id and status = 'waitlisted'
      order by created_at limit 1
    )
    returning user_id into v_promoted_user;
    if v_promoted_user is not null then
      select name into v_promoted_name from profiles where id = v_promoted_user;
    end if;
  end if;
  return v_promoted_name;
end $$;

revoke execute on function public.cancel_registration(uuid) from public, anon;
grant execute on function public.cancel_registration(uuid) to authenticated;
```

- [ ] **Step 2: 기존 로직과 대조 검증**

`supabase/migrations/0001_init.sql:128-145`의 원본과 나란히 놓고 확인: 락(`for update`) → 삭제·NOT_REGISTERED → confirmed였을 때만 최선순위 대기자 승급 — 세 단계가 동일하고, 추가된 것은 `returning user_id`와 이름 조회뿐이어야 한다.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0024_cancel_returns_promoted.sql
git commit -m "feat: cancel_registration이 정원 승급자 이름 반환"
```

> ⚠️ DB 적용은 사람이 한다 (Global Constraints). 적용 전까지 Task 5의 알림은 발동하지 않지만 기존 동작은 깨지지 않는다 — 액션은 반환값이 null인 것처럼 동작한다.

---

### Task 5: 취소 액션에서 승급 Slack 알림

**Files:**
- Modify: `src/actions/registration.ts` (`cancelRegistration`, 27-41행)

**Interfaces:**
- Consumes: Task 4의 `cancel_registration returns text`, `postSlack` (`src/lib/slack.ts`)

- [ ] **Step 1: cancelRegistration 수정**

`src/actions/registration.ts`의 import에 추가:

```ts
import { postSlack } from "@/lib/slack";
```

`cancelRegistration` 함수 전체를 다음으로 교체:

```ts
export async function cancelRegistration(eventId: string): Promise<ActionResult> {
  await requireProfile();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_registration", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  const promotedName = data as string | null;
  if (promotedName) {
    const { data: event } = await supabase
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();
    // 알림 실패가 취소 성공을 막으면 안 됨 — 결과 무시
    await postSlack(
      `[정원 승급] ${promotedName}님이 '${event?.title ?? "이벤트"}' 확정으로 승급했어요`,
    );
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");

  return {};
}
```

- [ ] **Step 2: 타입 검사 + 기존 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: 에러 없음, 기존 테스트 전부 PASS

- [ ] **Step 3: Commit**

```bash
git add src/actions/registration.ts
git commit -m "feat: 정원 승급 시 Slack 알림"
```

---

### Task 6: sumPointsInMonth 순수 함수 (TDD) + 프로필 페이지 재사용

이번 달 포인트 합산이 프로필 페이지에 인라인으로 있고(서버 로컬 타임존 기준 — KST와 어긋나는 잠재 버그), 대시보드에서도 필요해진다. KST 기준 순수 함수로 추출한다.

**Files:**
- Create: `src/lib/points.ts`
- Modify: `src/app/(member)/profile/page.tsx:64-70`
- Test: `tests/points.test.ts`

**Interfaces:**
- Consumes: `monthKst(iso): "YYYY-MM"` (`src/lib/format.ts`), `PointLog` (`src/lib/types.ts`)
- Produces: `sumPointsInMonth(logs: Pick<PointLog, "amount" | "created_at">[], month: string): number` — Task 7이 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/points.test.ts` 생성:

```ts
import { describe, expect, it } from "vitest";
import { sumPointsInMonth } from "@/lib/points";

const log = (amount: number, created_at: string) => ({ amount, created_at });

describe("sumPointsInMonth", () => {
  it("해당 월 로그만 합산한다", () => {
    const logs = [
      log(10, "2026-07-10T03:00:00Z"),
      log(20, "2026-07-15T03:00:00Z"),
      log(99, "2026-06-15T03:00:00Z"),
    ];
    expect(sumPointsInMonth(logs, "2026-07")).toBe(30);
  });

  it("KST 기준으로 월을 판정한다 (UTC 6/30 15:30 = KST 7/1 00:30)", () => {
    expect(sumPointsInMonth([log(10, "2026-06-30T15:30:00Z")], "2026-07")).toBe(10);
    expect(sumPointsInMonth([log(10, "2026-06-30T15:30:00Z")], "2026-06")).toBe(0);
  });

  it("빈 목록은 0", () => {
    expect(sumPointsInMonth([], "2026-07")).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/points.test.ts`
Expected: FAIL — `Cannot find module '@/lib/points'`

- [ ] **Step 3: 구현**

`src/lib/points.ts` 생성:

```ts
import { monthKst } from "@/lib/format";
import type { PointLog } from "@/lib/types";

/** KST 기준 해당 월("YYYY-MM")에 적립·차감된 포인트 합 */
export function sumPointsInMonth(
  logs: Pick<PointLog, "amount" | "created_at">[],
  month: string,
): number {
  return logs
    .filter((log) => monthKst(log.created_at) === month)
    .reduce((sum, log) => sum + log.amount, 0);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/points.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 프로필 페이지가 재사용하도록 수정**

`src/app/(member)/profile/page.tsx`에서 import 추가:

```ts
import { monthKst } from "@/lib/format";
import { sumPointsInMonth } from "@/lib/points";
```

다음 블록(64-70행)을:

```ts
  const now = new Date();
  const monthTotal = pointLogList
    .filter((log) => {
      const d = new Date(log.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, log) => sum + log.amount, 0);
```

이것으로 교체:

```ts
  const monthTotal = sumPointsInMonth(pointLogList, monthKst(new Date().toISOString()));
```

- [ ] **Step 6: 전체 검증 + Commit**

Run: `npx tsc --noEmit && npm test`
Expected: PASS

```bash
git add src/lib/points.ts tests/points.test.ts "src/app/(member)/profile/page.tsx"
git commit -m "feat: KST 기준 월간 포인트 합산 함수 추출"
```

---

### Task 7: 홈 대시보드 보강 — 미응답 설문 배너 + 이번 달 포인트

`HomeDashboard`(`src/app/(member)/HomeDashboard.tsx`)에는 이미 최신 공지 배너와 이벤트 목록이 있다. 여기에 (1) 미응답 열린 설문 배너, (2) 이번 달 포인트 카드를 추가한다. 사용자별 조회가 필요하므로 `profileId`를 prop으로 받는다.

**Files:**
- Modify: `src/app/page.tsx` (HomeDashboard 호출부)
- Modify: `src/app/(member)/HomeDashboard.tsx`

**Interfaces:**
- Consumes: Task 6의 `sumPointsInMonth`, `monthKst` (`src/lib/format.ts`), `StatCard` (`src/components/StatCard.tsx`)
- Produces: `HomeDashboard({ month, profileId }: { month?: string; profileId: string })`

- [ ] **Step 1: page.tsx에서 profileId 전달**

`src/app/page.tsx`의 `<HomeDashboard month={month} />`를 다음으로 변경:

```tsx
      <HomeDashboard month={month} profileId={profile.id} />
```

- [ ] **Step 2: HomeDashboard 수정**

`src/app/(member)/HomeDashboard.tsx`에서 import에 추가:

```ts
import { StatCard } from "@/components/StatCard";
import { sumPointsInMonth } from "@/lib/points";
```

(`formatKst, formatMonthLabel, monthKst`는 이미 import돼 있다.)

시그니처를 변경:

```ts
export async function HomeDashboard({
  month,
  profileId,
}: {
  month?: string;
  profileId: string;
}) {
```

`latestNotice` 조회 바로 다음에 사용자별 조회 추가:

```ts
  const [{ data: openSurveys }, { data: myResponses }, { data: pointLogs }] =
    await Promise.all([
      supabase
        .from("surveys")
        .select("id, title")
        .eq("is_open", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("survey_responses")
        .select("survey_id")
        .eq("user_id", profileId),
      supabase
        .from("point_logs")
        .select("amount, created_at")
        .eq("user_id", profileId),
    ]);

  const respondedIds = new Set((myResponses ?? []).map((r) => r.survey_id));
  const unanswered = (openSurveys ?? []).filter((s) => !respondedIds.has(s.id));
  const monthPoints = sumPointsInMonth(
    (pointLogs ?? []) as { amount: number; created_at: string }[],
    monthKst(new Date().toISOString()),
  );
```

JSX에서 기존 공지 배너 블록(`{notice && (...)}`) **바로 다음**에 추가:

```tsx
      {unanswered.length > 0 && (
        <Link href="/surveys">
          <Card className="flex items-center gap-2 transition-shadow hover:shadow-md">
            <Badge tone="warning">설문</Badge>
            <p className="text-sm font-medium text-gray-900">
              응답을 기다리는 설문 {unanswered.length}개 — {unanswered[0].title}
            </p>
          </Card>
        </Link>
      )}
      <Link href="/profile" className="sm:max-w-xs">
        <StatCard
          label="이번 달 포인트"
          value={monthPoints}
          hint="프로필에서 내역 보기"
        />
      </Link>
```

- [ ] **Step 3: 빌드 + 화면 검증**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공

가능하면 `npm run dev`로 로그인 상태의 `/`에서 확인: 미응답 설문이 있으면 배너 노출, 클릭 시 `/surveys` 이동, 포인트 카드 클릭 시 `/profile` 이동. (열린 설문이 없으면 배너가 없는 것이 정상.)

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx "src/app/(member)/HomeDashboard.tsx"
git commit -m "feat: 홈 대시보드에 미응답 설문 배너·이번 달 포인트 추가"
```

---

### Task 8: 최종 검증

- [ ] **Step 1: 전체 테스트·빌드**

Run: `npm test && npm run build`
Expected: 전부 PASS, 빌드 성공

- [ ] **Step 2: 체크리스트 확인**

- `vercel.json`에 cron 2개 (`attendance-warning`, `event-reminder`)
- `tests/`에 신규 테스트 2파일 (`event-reminder`, `points`)
- 마이그레이션 `0024` 파일 존재 — **적용은 사람 몫임을 최종 보고에 명시**
- 신규 라우트가 CRON_SECRET 없이는 401을 반환하는지 코드 재확인

## 배포 시 사람이 할 일 (실행자는 보고만)

1. `supabase/migrations/0024_cancel_returns_promoted.sql`을 스테이징 → 프로덕션 순으로 적용.
2. Vercel 환경변수 `CRON_SECRET`, `SLACK_WEBHOOK_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 설정돼 있는지 확인 (attendance-warning cron이 이미 돌고 있다면 설정돼 있음).
3. 배포 후 `curl -H "Authorization: Bearer $CRON_SECRET" https://<도메인>/api/cron/event-reminder`로 수동 1회 실행해 Slack 수신 확인.
