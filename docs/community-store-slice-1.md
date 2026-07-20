# 구현 브리프 (Codex용): Community Store — 슬라이스 1 (출석 경고 경로)

이 문서만 읽고 착수할 수 있게 자체 완결로 썼다. 배경 설계는 [community-store-design.md](community-store-design.md), 도메인 용어는 [CONTEXT.md](../CONTEXT.md)의 `## 아키텍처` 참조.

**먼저 읽을 것**: 저장소 루트의 [AGENTS.md](../AGENTS.md) — 이 프로젝트의 Next.js(16.2.10)는 관례가 다를 수 있으니 코드 쓰기 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인하라. (이 슬라이스는 새 Next API 표면을 추가하지 않고 기존 lib 함수 시그니처와 두 호출부만 바꾸므로 위험은 낮다.)

## 목표

"둘러보기(demo) 모드냐 아니냐"를 데이터 접근 창구 한 곳(**Community Store** seam)에서만 판정하게 만든다. 이번 슬라이스는 **출석 경고 경로에서만** seam을 증명한다. 나머지 store·페이지는 이번에 건드리지 않는다.

이 경로를 첫 슬라이스로 고른 이유: 이미 `computeAttendanceWarnings(supabase)`가 client를 인자로 받는 주입 구조라 변환이 최소이고, cookie client와 service-role client 둘 다를 태워 supabase adapter를 증명하며, 읽기 전용이라 위험이 없고, `next/*` 목킹 없는 첫 회귀 테스트가 나온다.

## 스코프 (이 3~4파일만)

- **신규** `src/lib/community/` — seam. 이번 슬라이스에 필요한 **출석 읽기(reads)만** 구현한다. 10개 store를 다 만들지 마라.
- **수정** `src/lib/attendance-stats.ts` — `computeAttendanceWarnings`가 `SupabaseClient` 대신 reads interface를 받게.
- **수정** `src/actions/attendance-warning.ts` — cookie 경로, seam 통해 호출.
- **수정** `src/app/api/cron/attendance-warning/route.ts` — service-role 경로, seam에 client 주입.
- **신규** `tests/attendance-warnings.test.ts` — 무목킹 회귀 테스트.

## 1. seam 만들기 — `src/lib/community/`

`computeAttendanceWarnings`가 실제로 필요로 하는 읽기는 4개다(현재 `attendance-stats.ts:10-37`의 쿼리 그대로). 이걸 interface로 뽑는다.

```ts
// src/lib/community/types.ts
import type { Profile } from "@/lib/types";

export type EventUserPair = { user_id: string; event_id: string };

// 출석 경고 계산이 건너는 읽기 seam. 이후 슬라이스에서 members/applications/... 가 추가됨.
export interface AttendanceReads {
  activeMembers(): Promise<Profile[]>;                        // role=member, status=active, name 정렬
  pastEventIds(beforeIso: string): Promise<string[]>;         // starts_at < before
  confirmedRegistrations(eventIds: string[]): Promise<EventUserPair[]>; // status=confirmed
  attendances(eventIds: string[]): Promise<EventUserPair[]>;
}

export interface Community {
  attendance: AttendanceReads;
  // 이후 슬라이스: members, applications, events, surveys, ... (community-store-design.md 참조)
}
```

**정렬은 계약이다**(설계 D4): supabase·demo 둘 다 동일 정렬을 지켜야 real/demo가 안 갈린다.

### supabase adapter

client를 인자로 받는다 — cookie-bound든 service-role이든 동일 코드. 쿼리는 지금 `attendance-stats.ts`에 있는 것을 그대로 옮긴다(재작성 금지, 이동).

```ts
// src/lib/community/supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import type { Community, AttendanceReads, EventUserPair } from "./types";

export function supabaseCommunity(client: SupabaseClient): Community {
  const attendance: AttendanceReads = {
    async activeMembers() {
      const { data } = await client
        .from("profiles").select("*")
        .eq("role", "member").eq("status", "active").order("name");
      return (data as Profile[]) ?? [];
    },
    async pastEventIds(beforeIso) {
      const { data } = await client.from("events").select("id").lt("starts_at", beforeIso);
      return (data ?? []).map((e) => e.id);
    },
    async confirmedRegistrations(eventIds) {
      if (eventIds.length === 0) return [];
      const { data } = await client
        .from("event_registrations").select("user_id, event_id")
        .eq("status", "confirmed").in("event_id", eventIds);
      return (data as EventUserPair[]) ?? [];
    },
    async attendances(eventIds) {
      if (eventIds.length === 0) return [];
      const { data } = await client
        .from("attendances").select("user_id, event_id").in("event_id", eventIds);
      return (data as EventUserPair[]) ?? [];
    },
  };
  return { attendance };
}
```

### demo adapter

`next/*` import 절대 없음. `src/lib/demoData.ts`를 backing으로 쓴다.

**중요한 판정 — demo 출석 읽기는 빈 배열을 반환한다.** 이유: 현재 동작은 demo 모드에서 출석 경고가 아무것도 안 한다(`attendance-warning.ts:14`가 `{count:0}` early-return). Slack 알림은 seam 밖 side effect라 **demo에서 절대 발송되면 안 된다**. demo 읽기를 비우면 → 경고 0건 → Slack 미발송 → `{count:0}` 로 현재 동작이 분기 없이 그대로 보존된다. (`DEMO_MEMBERS` 등으로 채워 경고를 만들면 실제 Slack이 발송돼 버리니 하지 마라.)

```ts
// src/lib/community/demo.ts
import type { Community } from "./types";

export const demoCommunity: Community = {
  attendance: {
    async activeMembers() { return []; },
    async pastEventIds() { return []; },
    async confirmedRegistrations() { return []; },
    async attendances() { return []; },
  },
};
```

### 선택 factory — 유일한 판정 지점

```ts
// src/lib/community/index.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { supabaseCommunity } from "./supabase";
import { demoCommunity } from "./demo";
import type { Community } from "./types";

export type { Community, AttendanceReads, EventUserPair } from "./types";

export async function getCommunity(opts?: { client?: SupabaseClient }): Promise<Community> {
  if (opts?.client) return supabaseCommunity(opts.client); // cron: isDemoMode 안 봄, 절대 demo 아님
  if (await isDemoMode()) return demoCommunity;            // ← isDemoMode()를 읽는 유일한 곳
  return supabaseCommunity(await createClient());
}
```

## 2. `computeAttendanceWarnings` 수정

시그니처를 `SupabaseClient` → `AttendanceReads`로. 본문의 4개 쿼리를 reads 호출로 치환. 나머지 계산 로직(Set 페어 매칭, `confirmed===0` skip, `rate < ATTENDANCE_WARNING_THRESHOLD`)은 **그대로 둔다** — 이게 테스트할 대상이다.

```ts
// src/lib/attendance-stats.ts
import type { AttendanceReads } from "@/lib/community/types";
import { ATTENDANCE_WARNING_THRESHOLD } from "@/app/admin/attendance/constants";

export async function computeAttendanceWarnings(
  reads: AttendanceReads,
): Promise<{ userId: string; name: string; rate: number }[]> {
  const now = new Date().toISOString();
  const [members, pastEventIds] = await Promise.all([
    reads.activeMembers(),
    reads.pastEventIds(now),
  ]);

  const confirmedByUser = new Map<string, number>();
  const attendedByUser = new Map<string, number>();

  if (pastEventIds.length > 0) {
    const [regs, attends] = await Promise.all([
      reads.confirmedRegistrations(pastEventIds),
      reads.attendances(pastEventIds),
    ]);
    const confirmedPairs = new Set<string>();
    for (const r of regs) {
      confirmedPairs.add(`${r.user_id}:${r.event_id}`);
      confirmedByUser.set(r.user_id, (confirmedByUser.get(r.user_id) ?? 0) + 1);
    }
    for (const a of attends) {
      if (confirmedPairs.has(`${a.user_id}:${a.event_id}`)) {
        attendedByUser.set(a.user_id, (attendedByUser.get(a.user_id) ?? 0) + 1);
      }
    }
  }

  const warnings: { userId: string; name: string; rate: number }[] = [];
  for (const member of members) {
    const confirmed = confirmedByUser.get(member.id) ?? 0;
    if (confirmed === 0) continue;
    const attended = attendedByUser.get(member.id) ?? 0;
    const rate = attended / confirmed;
    if (rate < ATTENDANCE_WARNING_THRESHOLD) {
      warnings.push({ userId: member.id, name: member.name, rate });
    }
  }
  return warnings;
}
```

`@supabase/supabase-js`·`Profile` import는 이제 이 파일에서 불필요하면 제거(네 변경이 만든 orphan만 정리, 그 외 손대지 마라).

## 3. 두 호출부 수정

**`src/actions/attendance-warning.ts`** — `isDemoMode()`/`createClient()` 직접 호출 제거, seam 경유. `if (await isDemoMode()) return { count: 0 }` 줄은 **삭제**(demo는 이제 store가 빈 읽기로 처리). `requireAdmin()`과 Slack 발송은 그대로 남긴다.

```ts
"use server";
import { requireAdmin } from "@/lib/auth";
import { getCommunity } from "@/lib/community";
import { computeAttendanceWarnings } from "@/lib/attendance-stats";
import { postSlack } from "@/lib/slack";
import type { ActionResult } from "@/lib/types";

export async function sendAttendanceWarning(): Promise<ActionResult & { count?: number }> {
  await requireAdmin();
  const community = await getCommunity();
  const warnings = await computeAttendanceWarnings(community.attendance);
  if (warnings.length === 0) return { count: 0 };

  const lines = warnings.map((w) => `- ${w.name} (${Math.round(w.rate * 100)}%)`).join("\n");
  const { error } = await postSlack(
    `[출석 경고] 출석률 50% 미만 회원 ${warnings.length}명\n${lines}`,
  );
  if (error) return { error };
  return { count: warnings.length };
}
```

**`src/app/api/cron/attendance-warning/route.ts`** — service-role client를 만드는 부분은 그대로(가드·env 체크 포함), `computeAttendanceWarnings(supabase)` 호출만 seam 주입으로 바꾼다:

```ts
import { getCommunity } from "@/lib/community";
// ... 기존 가드/env 체크/service-role createClient 그대로 ...
const community = await getCommunity({ client: supabase });
const warnings = await computeAttendanceWarnings(community.attendance);
// ... 이후 Slack/응답 로직 그대로 ...
```

(cron route의 `import { computeAttendanceWarnings }`는 유지. `getCommunity` import 추가.)

## 4. 회귀 테스트 — `tests/attendance-warnings.test.ts`

seam의 성과: `computeAttendanceWarnings`가 이제 평범한 객체 fake로 테스트된다. `next/*` 목킹 없음. 임계 로직·`confirmed===0` skip·페어 매칭을 검증.

```ts
import { describe, it, expect } from "vitest";
import { computeAttendanceWarnings } from "@/lib/attendance-stats";
import type { AttendanceReads } from "@/lib/community/types";
import type { Profile } from "@/lib/types";

function fakeReads(over: Partial<AttendanceReads> = {}): AttendanceReads {
  return {
    activeMembers: async () => [],
    pastEventIds: async () => [],
    confirmedRegistrations: async () => [],
    attendances: async () => [],
    ...over,
  };
}
const member = (id: string, name: string) => ({ id, name } as Profile);

describe("computeAttendanceWarnings", () => {
  it("확정 대비 출석이 임계(50%) 미만인 회원을 표시한다", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "낮은출석")],
      pastEventIds: async () => ["e1", "e2", "e3", "e4"],
      confirmedRegistrations: async () =>
        ["e1", "e2", "e3", "e4"].map((event_id) => ({ user_id: "u1", event_id })),
      attendances: async () => [{ user_id: "u1", event_id: "e1" }], // 1/4 = 25%
    });
    const warnings = await computeAttendanceWarnings(reads);
    expect(warnings).toEqual([{ userId: "u1", name: "낮은출석", rate: 0.25 }]);
  });

  it("임계 이상이면 표시하지 않는다", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "높은출석")],
      pastEventIds: async () => ["e1", "e2"],
      confirmedRegistrations: async () => [
        { user_id: "u1", event_id: "e1" }, { user_id: "u1", event_id: "e2" },
      ],
      attendances: async () => [
        { user_id: "u1", event_id: "e1" }, { user_id: "u1", event_id: "e2" }, // 2/2 = 100%
      ],
    });
    expect(await computeAttendanceWarnings(reads)).toEqual([]);
  });

  it("확정 신청이 0인 회원은 건너뛴다(0으로 나누지 않음)", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "신청없음")],
      pastEventIds: async () => ["e1"],
    });
    expect(await computeAttendanceWarnings(reads)).toEqual([]);
  });

  it("확정된 이벤트의 출석만 센다(미확정 출석 무시)", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "A")],
      pastEventIds: async () => ["e1", "e2"],
      confirmedRegistrations: async () => [{ user_id: "u1", event_id: "e1" }], // e1만 확정
      attendances: async () => [
        { user_id: "u1", event_id: "e1" }, { user_id: "u1", event_id: "e2" }, // e2 출석은 무효
      ],
    });
    // 확정 1건, 그 중 출석 1건 → 100% → 경고 없음
    expect(await computeAttendanceWarnings(reads)).toEqual([]);
  });
});
```

## 검증 (완료 기준)

```
pnpm test                       # 새 테스트 4개 통과
pnpm exec tsc --noEmit          # 타입 에러 0 (typecheck 스크립트 없음)
pnpm build                      # 빌드 성공
```

셋 다 통과하면 슬라이스 1 완료. 통과 출력 확인 전엔 완료라고 하지 마라.

## 하지 말 것 (스코프 밖)

- members/applications/events/surveys 등 나머지 store 만들기 — 이후 슬라이스.
- 다른 페이지·action의 `isDemoMode()` 분기 건드리기 — 53개 중 이 경로만.
- 회원 action 누수 수정 — 별도 슬라이스(behavior change, 별도 리뷰).
- RPC(PL/pgSQL)·RLS·마이그레이션 수정 — 이번 슬라이스는 읽기 전용 TS만.
- `attendance-stats.ts`의 계산 로직 재작성 — 시그니처만 바꾸고 로직은 보존.
