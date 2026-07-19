# 스터디·프로젝트 소속(groups) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원이 스터디·프로젝트에 자가가입으로 소속되고, 운영진이 명단을 확인하며, 잘된 건을 골라 공개 `/projects`에 노출한다.

**Architecture:** 신규 `groups` + `group_members` 테이블. 관리자 CRUD는 `is_admin()` RLS로 직접 write, 회원 자가가입은 정원 검사가 필요해 `join_group` RPC(security definer), 탈퇴는 self-delete RLS. 공개 페이지는 익명이 `group_members`를 못 읽으므로 `public_groups()` RPC로 멤버 수만 집계 노출. 페이지는 이 저장소의 기존 패턴(`createClient()` + `isDemoMode()` + demoData 인라인 fallback)을 따른다 — 기존 community seam은 출석 cron 전용이라 확장하지 않는다.

**Tech Stack:** Next.js(App Router), TypeScript strict, Supabase(Postgres + RLS), Vitest, Tailwind.

## Global Constraints

- 마이그레이션 파일: `supabase/migrations/0030_groups.sql` (다음 번호).
- 테이블/함수는 `public` 스키마, 함수는 `security definer set search_path = public`.
- 쓰기 RPC는 `revoke execute ... from public, anon; grant execute ... to authenticated`.
- 관리자 판정은 기존 `public.is_admin()` 재사용 (organizer + team_member).
- season 표기는 `applications.season`과 동일 문자열(예: `"2026-2"`).
- 테스트 러너: `npm test` (= `vitest run`). 개별: `npx vitest run tests/<file> -t "<name>"`.
- 액션 반환 타입은 `ActionResult = { error?: string; warning?: string }`.
- Supabase 에러는 `toKoreanError(error)`로 한글 매핑, RPC 커스텀 예외(`NOT_RECRUITING`/`FULL`/`NOT_FOUND`)는 액션에서 직접 한글 매핑.
- UI는 다크 테마 Tailwind, 기존 회원/관리자 페이지 클래스 관례 준수.

---

### Task 1: DB 마이그레이션 + 타입 + 마이그레이션 테스트

**Files:**
- Create: `supabase/migrations/0030_groups.sql`
- Modify: `src/lib/types.ts` (파일 끝에 추가)
- Modify: `src/lib/demoData.ts` (export 추가)
- Test: `tests/groups-migration.test.ts`

**Interfaces:**
- Produces (SQL): 테이블 `public.groups`, `public.group_members`; 함수 `public.join_group(p_group uuid) returns void`, `public.public_groups() returns table(...)`.
- Produces (TS): `GroupType`, `GroupStatus`, `Group`, `GroupMember`, `PublicGroupCard`; demo `DEMO_GROUPS: Group[]`, `DEMO_GROUP_MEMBERS: GroupMember[]`.

- [ ] **Step 1: 마이그레이션 테스트 작성 (실패)**

`tests/groups-migration.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("groups 마이그레이션", () => {
  it("테이블·RLS·RPC를 정의한다", async () => {
    const sql = await readFile("supabase/migrations/0030_groups.sql", "utf8");

    expect(sql).toContain("create table public.groups");
    expect(sql).toContain("check (type in ('study', 'project'))");
    expect(sql).toContain(
      "check (status in ('recruiting', 'active', 'archived'))",
    );
    expect(sql).toContain("is_public boolean not null default false");
    expect(sql).toContain("create table public.group_members");
    expect(sql).toContain("primary key (group_id, user_id)");
    expect(sql).toContain("references public.groups(id) on delete cascade");

    // RLS
    expect(sql).toContain("enable row level security");
    expect(sql).toContain('"groups: member read"');
    expect(sql).toContain('"groups: public read"');
    expect(sql).toContain('"groups: admin all"');
    expect(sql).toContain('"group_members: member read"');
    expect(sql).toContain('"group_members: self leave"');
    expect(sql).toContain('"group_members: admin all"');

    // 자가입 RPC + 정원 검사
    expect(sql).toContain("function public.join_group(p_group uuid)");
    expect(sql).toContain("NOT_RECRUITING");
    expect(sql).toContain("FULL");
    expect(sql).toContain("revoke execute on function public.join_group(uuid)");
    expect(sql).toContain(
      "grant execute on function public.join_group(uuid) to authenticated",
    );

    // 공개 카드 집계 RPC (anon 실행 허용)
    expect(sql).toContain("function public.public_groups()");
    expect(sql).toContain(
      "grant execute on function public.public_groups() to anon, authenticated",
    );
  });

  it("TypeScript 타입이 SQL 제약과 일치한다", async () => {
    const types = await readFile("src/lib/types.ts", "utf8");
    expect(types).toContain('export type GroupType = "study" | "project"');
    expect(types).toContain(
      'export type GroupStatus = "recruiting" | "active" | "archived"',
    );
    expect(types).toContain("export interface Group");
    expect(types).toContain("export interface GroupMember");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/groups-migration.test.ts`
Expected: FAIL (파일 없음 / ENOENT)

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0030_groups.sql`:

```sql
-- 스터디·프로젝트 소속: 지속 그룹 + 자가가입 명단

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('study', 'project')),
  title text not null,
  description text not null default '',
  season text not null,
  status text not null default 'recruiting'
    check (status in ('recruiting', 'active', 'archived')),
  is_public boolean not null default false,
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index groups_season_idx on public.groups (season, type);

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id  uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- RLS: groups
alter table public.groups enable row level security;
create policy "groups: member read" on public.groups
  for select to authenticated using (true);
create policy "groups: public read" on public.groups
  for select to anon using (is_public = true);
create policy "groups: admin all" on public.groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- RLS: group_members (자가입은 join_group RPC로만, 여기선 insert 정책 없음)
alter table public.group_members enable row level security;
create policy "group_members: member read" on public.group_members
  for select to authenticated using (true);
create policy "group_members: self leave" on public.group_members
  for delete to authenticated using (user_id = auth.uid());
create policy "group_members: admin all" on public.group_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 자가입: 상태·정원 검사 후 원자적 insert
create or replace function public.join_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_cap int;
  v_count int;
begin
  select status, capacity into v_status, v_cap from groups where id = p_group;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_status <> 'recruiting' then raise exception 'NOT_RECRUITING'; end if;
  if v_cap is not null then
    -- ponytail: 경합 있으면 advisory lock, 동아리 규모라 우선 단순 count
    select count(*) into v_count from group_members where group_id = p_group;
    if v_count >= v_cap then raise exception 'FULL'; end if;
  end if;
  insert into group_members (group_id, user_id)
    values (p_group, auth.uid())
    on conflict do nothing;
end $$;
revoke execute on function public.join_group(uuid) from public, anon;
grant execute on function public.join_group(uuid) to authenticated;

-- 공개 카드: 익명은 group_members를 못 읽으므로 정의자 권한으로 멤버 수만 집계
create or replace function public.public_groups()
returns table (
  id uuid, type text, title text, description text,
  season text, member_count bigint
)
language sql stable security definer set search_path = public as $$
  select g.id, g.type, g.title, g.description, g.season,
         (select count(*) from group_members m where m.group_id = g.id)
  from groups g
  where g.is_public = true
  order by g.created_at desc
$$;
grant execute on function public.public_groups() to anon, authenticated;
```

- [ ] **Step 4: 타입 추가**

`src/lib/types.ts` 파일 끝에 추가:

```ts
export type GroupType = "study" | "project";
export type GroupStatus = "recruiting" | "active" | "archived";

export interface Group {
  id: string;
  type: GroupType;
  title: string;
  description: string;
  season: string;
  status: GroupStatus;
  is_public: boolean;
  capacity: number | null;
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface PublicGroupCard {
  id: string;
  type: GroupType;
  title: string;
  description: string;
  season: string;
  member_count: number;
}
```

- [ ] **Step 5: demo 픽스처 추가**

`src/lib/demoData.ts` 끝에 추가 (기존 `demo-m*` 회원 id 재사용):

```ts
export const DEMO_GROUPS: Group[] = [
  { id: "demo-g1", type: "study", title: "타입스크립트 딥다이브 스터디", description: "타입 시스템 심화 — 주 1회 온라인", season: "2026-2", status: "recruiting", is_public: false, capacity: 6, created_by: "demo-m1", created_at: "2026-07-01T00:00:00.000Z" },
  { id: "demo-g2", type: "project", title: "캠퍼스 길찾기 AI", description: "Gemini 기반 캠퍼스 내비게이션", season: "2026-2", status: "active", is_public: true, capacity: 5, created_by: "demo-m1", created_at: "2026-06-20T00:00:00.000Z" },
  { id: "demo-g3", type: "project", title: "행사 등록 플랫폼", description: "Firebase 기반 이벤트 허브", season: "2026-1", status: "archived", is_public: true, capacity: null, created_by: "demo-m2", created_at: "2026-02-10T00:00:00.000Z" },
];

export const DEMO_GROUP_MEMBERS: GroupMember[] = [
  { group_id: "demo-g1", user_id: "demo-m3", joined_at: "2026-07-02T00:00:00.000Z" },
  { group_id: "demo-g1", user_id: "demo-m4", joined_at: "2026-07-03T00:00:00.000Z" },
  { group_id: "demo-g2", user_id: "demo-m1", joined_at: "2026-06-21T00:00:00.000Z" },
  { group_id: "demo-g2", user_id: "demo-m5", joined_at: "2026-06-22T00:00:00.000Z" },
  { group_id: "demo-g2", user_id: "demo-m6", joined_at: "2026-06-23T00:00:00.000Z" },
  { group_id: "demo-g3", user_id: "demo-m2", joined_at: "2026-02-11T00:00:00.000Z" },
];
```

`demoData.ts` 상단 import에 `Group`, `GroupMember`가 타입 목록에 포함돼야 함 (기존 `import type { ... } from "@/lib/types"` 줄에 추가).

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `npx vitest run tests/groups-migration.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/0030_groups.sql src/lib/types.ts src/lib/demoData.ts tests/groups-migration.test.ts
git commit -m "feat: groups 테이블·RLS·RPC 마이그레이션 + 타입"
```

---

### Task 2: 서버 액션 + 폼 검증 테스트

**Files:**
- Create: `src/actions/group.ts`
- Create: `src/lib/group-form.ts` (순수 파싱/검증)
- Test: `tests/group-form.test.ts`

**Interfaces:**
- Consumes: `Group`, `GroupType`, `GroupStatus` (Task 1), `join_group` RPC (Task 1).
- Produces:
  - `parseGroupForm(fd: FormData): { data: GroupInput; error?: string }` — `GroupInput = { type: GroupType; title: string; description: string; season: string; status: GroupStatus; capacity: number | null }`
  - 액션: `createGroup(fd)`, `updateGroup(id, fd)`, `setGroupPublic(id, isPublic)`, `removeMember(groupId, userId)`, `joinGroup(groupId)`, `leaveGroup(groupId)` — 모두 `Promise<ActionResult>`.

- [ ] **Step 1: 폼 검증 테스트 작성 (실패)**

`tests/group-form.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseGroupForm } from "@/lib/group-form";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("parseGroupForm", () => {
  it("정상 입력을 파싱한다", () => {
    const { data, error } = parseGroupForm(
      fd({ type: "study", title: " TS 스터디 ", description: "설명", season: "2026-2", status: "recruiting", capacity: "6" }),
    );
    expect(error).toBeUndefined();
    expect(data.title).toBe("TS 스터디");
    expect(data.capacity).toBe(6);
  });

  it("제목이 비면 에러", () => {
    const { error } = parseGroupForm(fd({ type: "study", title: "  ", season: "2026-2", status: "recruiting" }));
    expect(error).toBe("제목을 입력해주세요");
  });

  it("잘못된 type은 에러", () => {
    const { error } = parseGroupForm(fd({ type: "club", title: "x", season: "2026-2", status: "recruiting" }));
    expect(error).toBe("종류가 올바르지 않습니다");
  });

  it("빈 capacity는 null", () => {
    const { data } = parseGroupForm(fd({ type: "project", title: "x", season: "2026-2", status: "active", capacity: "" }));
    expect(data.capacity).toBeNull();
  });

  it("capacity가 0 이하면 에러", () => {
    const { error } = parseGroupForm(fd({ type: "project", title: "x", season: "2026-2", status: "active", capacity: "0" }));
    expect(error).toBe("정원은 1 이상이어야 합니다");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/group-form.test.ts`
Expected: FAIL (`@/lib/group-form` 없음)

- [ ] **Step 3: 폼 검증 구현**

`src/lib/group-form.ts`:

```ts
import type { GroupType, GroupStatus } from "@/lib/types";

export interface GroupInput {
  type: GroupType;
  title: string;
  description: string;
  season: string;
  status: GroupStatus;
  capacity: number | null;
}

const TYPES: GroupType[] = ["study", "project"];
const STATUSES: GroupStatus[] = ["recruiting", "active", "archived"];

export function parseGroupForm(fd: FormData): { data: GroupInput; error?: string } {
  const type = String(fd.get("type") ?? "") as GroupType;
  const title = String(fd.get("title") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const season = String(fd.get("season") ?? "").trim();
  const status = String(fd.get("status") ?? "recruiting") as GroupStatus;
  const capRaw = String(fd.get("capacity") ?? "").trim();

  const data: GroupInput = { type, title, description, season, status, capacity: null };

  if (!TYPES.includes(type)) return { data, error: "종류가 올바르지 않습니다" };
  if (!title) return { data, error: "제목을 입력해주세요" };
  if (!season) return { data, error: "기수를 입력해주세요" };
  if (!STATUSES.includes(status)) return { data, error: "상태가 올바르지 않습니다" };
  if (capRaw !== "") {
    const n = Number(capRaw);
    if (!Number.isInteger(n) || n < 1) return { data, error: "정원은 1 이상이어야 합니다" };
    data.capacity = n;
  }
  return { data };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run tests/group-form.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 서버 액션 구현**

`src/actions/group.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import { parseGroupForm } from "@/lib/group-form";
import type { ActionResult } from "@/lib/types";

const ADMIN_PATH = "/admin/groups";

export async function createGroup(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { data, error: vErr } = parseGroupForm(formData);
  if (vErr) return { error: vErr };

  const supabase = await createClient();
  const { error } = await supabase.from("groups").insert({
    type: data.type,
    title: data.title,
    description: data.description,
    season: data.season,
    status: data.status,
    capacity: data.capacity,
  });
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function updateGroup(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { data, error: vErr } = parseGroupForm(formData);
  if (vErr) return { error: vErr };

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({
      type: data.type,
      title: data.title,
      description: data.description,
      season: data.season,
      status: data.status,
      capacity: data.capacity,
    })
    .eq("id", id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function setGroupPublic(id: string, isPublic: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.from("groups").update({ is_public: isPublic }).eq("id", id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  revalidatePath("/projects");
  return {};
}

export async function removeMember(groupId: string, userId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function joinGroup(groupId: string): Promise<ActionResult> {
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group", { p_group: groupId });
  if (error) {
    const map: Record<string, string> = {
      NOT_FOUND: "존재하지 않는 그룹입니다",
      NOT_RECRUITING: "지금은 모집 중이 아닙니다",
      FULL: "정원이 가득 찼습니다",
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { error: key ? map[key] : toKoreanError(error) };
  }
  revalidatePath("/groups");
  return {};
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/groups");
  return {};
}
```

> 참고: `joinGroup`/`leaveGroup`은 회원 액션이라 `requireAdmin()` 없이 세션 사용자로 동작. RLS/RPC가 권한을 강제한다.

- [ ] **Step 6: 타입체크 + 폼 테스트 재확인**

Run: `npx tsc --noEmit && npx vitest run tests/group-form.test.ts`
Expected: 에러 없음, PASS
> (액션 자체는 Supabase 의존이라 단위 테스트 없음 — 이 저장소의 다른 액션과 동일한 관례.)

- [ ] **Step 7: 커밋**

```bash
git add src/actions/group.ts src/lib/group-form.ts tests/group-form.test.ts
git commit -m "feat: group 서버 액션 + 폼 검증"
```

---

### Task 3: 운영진 관리 화면 (`/admin/groups`)

**Files:**
- Create: `src/app/admin/groups/page.tsx` (목록 + 생성)
- Create: `src/app/admin/groups/[id]/page.tsx` (상세: 로스터·상태·공개 토글)
- Create: `src/app/admin/groups/GroupForm.tsx` (client, 생성/수정 폼)
- Create: `src/app/admin/groups/GroupActions.tsx` (client, 공개 토글·멤버 제거 버튼)
- Modify: `src/app/admin/AdminSidebarNav.tsx` (네비 항목 추가)

**Interfaces:**
- Consumes: 액션 전부(Task 2), `Group`/`GroupMember`/`Profile`, `DEMO_GROUPS`/`DEMO_GROUP_MEMBERS`/`DEMO_MEMBERS`.
- Produces: 없음 (터미널 UI).

- [ ] **Step 1: 목록+생성 페이지**

`src/app/admin/groups/page.tsx` — 기존 `src/app/admin/members/page.tsx` 구조(서버 컴포넌트 + `requireAdmin()` + demo fallback) 준수:

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { isDemoMode } from "@/lib/demo";
import { DEMO_GROUPS, DEMO_GROUP_MEMBERS } from "@/lib/demoData";
import type { Group } from "@/lib/types";
import { GroupForm } from "./GroupForm";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { study: "스터디", project: "프로젝트" } as const;
const STATUS_LABEL = { recruiting: "모집중", active: "진행중", archived: "종료" } as const;

export default async function AdminGroupsPage() {
  await requireAdmin();
  const demo = await isDemoMode();

  let groups: Group[] = DEMO_GROUPS;
  let counts: Record<string, number> = DEMO_GROUP_MEMBERS.reduce(
    (a, m) => ((a[m.group_id] = (a[m.group_id] ?? 0) + 1), a),
    {} as Record<string, number>,
  );

  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    groups = (data ?? []) as Group[];
    const { data: members } = await supabase.from("group_members").select("group_id");
    counts = (members ?? []).reduce(
      (a, m: { group_id: string }) => ((a[m.group_id] = (a[m.group_id] ?? 0) + 1), a),
      {} as Record<string, number>,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="스터디·프로젝트" description="그룹을 만들고 소속 명단을 확인합니다" />
      <GroupForm />
      {groups.length === 0 ? (
        <EmptyState message="아직 그룹이 없습니다" />
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/admin/groups/${g.id}`}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
            >
              <div>
                <span className="text-xs text-white/50">{TYPE_LABEL[g.type]} · {g.season}</span>
                <div className="font-semibold">{g.title}</div>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <span>{STATUS_LABEL[g.status]}</span>
                <span>{counts[g.id] ?? 0}{g.capacity ? `/${g.capacity}` : ""}명</span>
                {g.is_public && <span className="text-emerald-400">공개</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 생성/수정 폼 (client)**

`src/app/admin/groups/GroupForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup, updateGroup } from "@/actions/group";
import type { Group } from "@/lib/types";

export function GroupForm({ group }: { group?: Group }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(fd: FormData) {
    setPending(true);
    setError(undefined);
    const res = group ? await updateGroup(group.id, fd) : await createGroup(fd);
    setPending(false);
    if (res.error) return setError(res.error);
    router.refresh();
    if (!group) (document.getElementById("group-form") as HTMLFormElement)?.reset();
  }

  return (
    <form
      id="group-form"
      action={onSubmit}
      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
    >
      <select name="type" defaultValue={group?.type ?? "study"} className="rounded-lg bg-white/5 px-3 py-2">
        <option value="study">스터디</option>
        <option value="project">프로젝트</option>
      </select>
      <select name="status" defaultValue={group?.status ?? "recruiting"} className="rounded-lg bg-white/5 px-3 py-2">
        <option value="recruiting">모집중</option>
        <option value="active">진행중</option>
        <option value="archived">종료</option>
      </select>
      <input name="title" defaultValue={group?.title} placeholder="제목" className="rounded-lg bg-white/5 px-3 py-2 sm:col-span-2" />
      <input name="description" defaultValue={group?.description} placeholder="설명" className="rounded-lg bg-white/5 px-3 py-2 sm:col-span-2" />
      <input name="season" defaultValue={group?.season ?? "2026-2"} placeholder="기수 (예: 2026-2)" className="rounded-lg bg-white/5 px-3 py-2" />
      <input name="capacity" type="number" min={1} defaultValue={group?.capacity ?? ""} placeholder="정원 (선택)" className="rounded-lg bg-white/5 px-3 py-2" />
      {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
      <button disabled={pending} className="rounded-lg bg-white/90 px-4 py-2 font-semibold text-black disabled:opacity-50 sm:col-span-2">
        {group ? "수정" : "그룹 만들기"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 상세(로스터·토글·제거) 페이지 + 액션 버튼**

`src/app/admin/groups/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { isDemoMode } from "@/lib/demo";
import { DEMO_GROUPS, DEMO_GROUP_MEMBERS, DEMO_MEMBERS } from "@/lib/demoData";
import type { Group, Profile } from "@/lib/types";
import { GroupForm } from "../GroupForm";
import { GroupActions } from "../GroupActions";

export const dynamic = "force-dynamic";

export default async function AdminGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const demo = await isDemoMode();

  let group: Group | undefined;
  let roster: Profile[] = [];

  if (demo) {
    group = DEMO_GROUPS.find((g) => g.id === id);
    const ids = DEMO_GROUP_MEMBERS.filter((m) => m.group_id === id).map((m) => m.user_id);
    roster = DEMO_MEMBERS.filter((p) => ids.includes(p.id));
  } else {
    const supabase = await createClient();
    const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    group = (g as Group) ?? undefined;
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, profiles(*)")
      .eq("group_id", id);
    roster = (members ?? []).map((m: { profiles: Profile }) => m.profiles);
  }

  if (!group) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={group.title} description={`${group.season} · ${roster.length}명`} />
      <GroupActions group={group} />
      <GroupForm group={group} />
      <div>
        <h2 className="mb-2 text-sm font-semibold text-white/70">소속 멤버</h2>
        <div className="grid gap-2">
          {roster.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2">
              <span>{p.name}{p.nickname ? ` (${p.nickname})` : ""}</span>
              <GroupActions.RemoveButton groupId={group.id} userId={p.id} />
            </div>
          ))}
          {roster.length === 0 && <p className="text-sm text-white/40">아직 소속 멤버가 없습니다</p>}
        </div>
      </div>
    </div>
  );
}
```

`src/app/admin/groups/GroupActions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setGroupPublic, removeMember } from "@/actions/group";
import type { Group } from "@/lib/types";

export function GroupActions({ group }: { group: Group }) {
  const router = useRouter();
  const [pub, setPub] = useState(group.is_public);

  async function toggle() {
    const next = !pub;
    setPub(next);
    const res = await setGroupPublic(group.id, next);
    if (res.error) setPub(!next);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={pub} onChange={toggle} />
      공개 페이지(/projects)에 노출
    </label>
  );
}

GroupActions.RemoveButton = function RemoveButton({ groupId, userId }: { groupId: string; userId: string }) {
  const router = useRouter();
  async function remove() {
    if (!confirm("이 멤버를 제거할까요?")) return;
    await removeMember(groupId, userId);
    router.refresh();
  }
  return (
    <button onClick={remove} className="text-xs text-red-400 hover:underline">
      제거
    </button>
  );
};
```

- [ ] **Step 4: 관리자 사이드바 항목 추가**

`src/app/admin/AdminSidebarNav.tsx`를 열어 기존 nav 항목 배열(예: members·events 등)에 동일 형식으로 추가:

```tsx
{ href: "/admin/groups", label: "스터디·프로젝트", icon: "groups" },
```
아이콘 맵이 있으면 `groups: "M17 20h5v-2a3 3 0 0 0-4.5-2.6M9 20H4v-2a3 3 0 0 1 4.5-2.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 8a3 3 0 0 1 6 0m2 0a3 3 0 0 1 6 0"` 항목을 추가. (파일의 실제 자료구조에 맞춰 배치 — members 항목을 복제해 수정.)

- [ ] **Step 5: 검증 (dev 서버, 브라우저)**

이 저장소는 UI 단위 테스트가 없다. dev 서버로 확인:
1. `/admin/groups` 접속 → 그룹 생성 폼 제출 → 목록에 나타남.
2. 그룹 클릭 → 상세에서 상태/공개 토글, 멤버 제거 동작.
3. 콘솔·네트워크 에러 없음.

Run(확인): `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/app/admin/groups src/app/admin/AdminSidebarNav.tsx
git commit -m "feat: 운영진 스터디·프로젝트 관리 화면"
```

---

### Task 4: 회원 화면 (`/(member)/groups` + 대시보드 카드 + 사이드바)

**Files:**
- Create: `src/app/(member)/groups/page.tsx`
- Create: `src/app/(member)/groups/GroupCard.tsx` (client, 가입/탈퇴 버튼)
- Modify: `src/app/(member)/SidebarNav.tsx` (nav 항목 + 아이콘)
- Modify: `src/app/(member)/HomeDashboard.tsx` ("내 스터디·프로젝트" 요약 카드)

**Interfaces:**
- Consumes: `joinGroup`/`leaveGroup`(Task 2), `Group`, demo 픽스처.
- Produces: 없음.

- [ ] **Step 1: 회원 목록 페이지 (서버 컴포넌트)**

`src/app/(member)/groups/page.tsx` — 이번 기수 기준. "내 소속" 먼저, 그 아래 "모집중" 목록:

```tsx
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { isDemoMode } from "@/lib/demo";
import { DEMO_GROUPS, DEMO_GROUP_MEMBERS } from "@/lib/demoData";
import type { Group } from "@/lib/types";
import { GroupCard } from "./GroupCard";

export const dynamic = "force-dynamic";

export default async function MemberGroupsPage() {
  const demo = await isDemoMode();

  let groups: Group[] = DEMO_GROUPS;
  let myIds = new Set(demo ? DEMO_GROUP_MEMBERS.filter((m) => m.user_id === "demo-m3").map((m) => m.group_id) : []);
  let counts: Record<string, number> = tally(DEMO_GROUP_MEMBERS.map((m) => m.group_id));

  if (!demo) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    groups = (data ?? []) as Group[];
    const { data: members } = await supabase.from("group_members").select("group_id, user_id");
    counts = tally((members ?? []).map((m: { group_id: string }) => m.group_id));
    myIds = new Set((members ?? []).filter((m: { user_id: string }) => m.user_id === user?.id).map((m: { group_id: string }) => m.group_id));
  }

  const mine = groups.filter((g) => myIds.has(g.id));
  const joinable = groups.filter((g) => !myIds.has(g.id) && g.status === "recruiting");

  return (
    <div className="space-y-8">
      <PageHeader title="스터디·프로젝트" description="관심 있는 그룹에 가입하세요" />
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white/70">내 소속</h2>
        {mine.length === 0 ? <EmptyState message="아직 소속된 그룹이 없습니다" /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((g) => <GroupCard key={g.id} group={g} joined count={counts[g.id] ?? 0} />)}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white/70">모집중</h2>
        {joinable.length === 0 ? <EmptyState message="모집중인 그룹이 없습니다" /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {joinable.map((g) => <GroupCard key={g.id} group={g} count={counts[g.id] ?? 0} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function tally(ids: string[]): Record<string, number> {
  return ids.reduce((a, id) => ((a[id] = (a[id] ?? 0) + 1), a), {} as Record<string, number>);
}
```

- [ ] **Step 2: 가입/탈퇴 카드 (client)**

`src/app/(member)/groups/GroupCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinGroup, leaveGroup } from "@/actions/group";
import type { Group } from "@/lib/types";

const TYPE_LABEL = { study: "스터디", project: "프로젝트" } as const;

export function GroupCard({ group, joined, count }: { group: Group; joined?: boolean; count: number }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const full = group.capacity != null && count >= group.capacity;

  async function act() {
    setPending(true);
    setError(undefined);
    const res = joined ? await leaveGroup(group.id) : await joinGroup(group.id);
    setPending(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <span className="text-xs text-white/50">{TYPE_LABEL[group.type]} · {group.season}</span>
      <div className="mt-1 text-lg font-bold">{group.title}</div>
      <p className="mt-1 text-sm text-white/60">{group.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-white/50">{count}{group.capacity ? `/${group.capacity}` : ""}명</span>
        <button
          onClick={act}
          disabled={pending || (!joined && full)}
          className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {joined ? "탈퇴" : full ? "정원마감" : "가입"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: 회원 사이드바 항목**

`src/app/(member)/SidebarNav.tsx`의 `icons` 맵에 추가:
```tsx
groups: "M17 20h5v-2a3 3 0 0 0-4.5-2.6M9 20H4v-2a3 3 0 0 1 4.5-2.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 8a3 3 0 0 1 6 0m2 0a3 3 0 0 1 6 0",
```
그리고 `NavItem` 목록(홈·출석 등 배열)에 `{ href: "/groups", label: "스터디·프로젝트", icon: "groups" }`를 홈 다음에 추가.

- [ ] **Step 4: 대시보드 요약 카드**

`src/app/(member)/HomeDashboard.tsx`를 열어 데이터 조회 부분에서 내 소속 개수를 가져오고(서버 컴포넌트면 `group_members`를 user_id로 count, demo면 `DEMO_GROUP_MEMBERS`에서 count), 카드 그리드에 한 장 추가:

```tsx
<Link href="/groups" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06]">
  <div className="text-sm text-white/50">내 스터디·프로젝트</div>
  <div className="mt-1 text-2xl font-bold">{myGroupCount}개</div>
</Link>
```
> 실제 조회 코드는 `HomeDashboard.tsx`의 기존 데이터 로딩 패턴(다른 통계 카드가 어떻게 값을 받는지)에 맞춰 삽입. demo 분기에서는 `DEMO_GROUP_MEMBERS.filter(m => m.user_id === "demo-m3").length` 사용.

- [ ] **Step 5: 검증 (dev 서버)**

1. 회원 계정으로 `/groups` → 모집중 그룹 [가입] → "내 소속"으로 이동, 카운트 증가.
2. [탈퇴] 동작. 정원 찬 그룹은 "정원마감" 비활성.
3. 대시보드에 소속 개수 카드 표시.

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(member)/groups" "src/app/(member)/SidebarNav.tsx" "src/app/(member)/HomeDashboard.tsx"
git commit -m "feat: 회원 스터디·프로젝트 가입 화면"
```

---

### Task 5: 공개 `/projects` 실데이터 연동

**Files:**
- Modify: `src/app/projects/page.tsx` (하드코딩 배열 → `public_groups()` RPC)

**Interfaces:**
- Consumes: `public_groups()` RPC(Task 1), `PublicGroupCard` 타입(Task 1), `DEMO_GROUPS`.

- [ ] **Step 1: 공개 페이지 실데이터로 교체**

`src/app/projects/page.tsx` 전체 교체 (기존 시각 스타일 유지, 데이터만 실제로):

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_GROUPS, DEMO_GROUP_MEMBERS } from "@/lib/demoData";
import type { PublicGroupCard } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { study: "스터디", project: "프로젝트" } as const;

export default async function ProjectsPage() {
  let cards: PublicGroupCard[];

  if (await isDemoMode()) {
    cards = DEMO_GROUPS.filter((g) => g.is_public).map((g) => ({
      id: g.id, type: g.type, title: g.title, description: g.description, season: g.season,
      member_count: DEMO_GROUP_MEMBERS.filter((m) => m.group_id === g.id).length,
    }));
  } else {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_groups");
    cards = (data ?? []) as PublicGroupCard[];
  }

  return (
    <div className="min-h-dvh bg-[#060608] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-white/50 hover:text-white">← 로그인으로 돌아가기</Link>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight">PROJECTS</h1>
        <p className="mt-4 text-white/70">멤버들이 진행 중인 스터디·프로젝트입니다.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="text-xs text-white/40">{TYPE_LABEL[c.type]} · {c.season}</span>
              <div className="mt-2 text-lg font-bold">{c.title}</div>
              <div className="mt-1 text-sm text-white/60">{c.description}</div>
              <div className="mt-3 text-xs text-white/40">{c.member_count}명 참여</div>
            </div>
          ))}
          {cards.length === 0 && <p className="text-white/40">공개된 프로젝트가 아직 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 검증**

1. demo 모드에서 `/projects` → `is_public` 그룹(캠퍼스 길찾기 AI, 행사 등록 플랫폼) 노출, 멤버 수 표시.
2. 운영진이 그룹 공개 토글 → `/projects`에 반영(revalidate).
3. 익명 접속 시 그룹 멤버 **이름 노출 없음**(멤버 수만).

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/projects/page.tsx
git commit -m "feat: 공개 projects 페이지 실데이터 연동"
```

---

## Self-Review

**Spec coverage:**
- 소속 명단(핵심) → Task 1(스키마) + Task 3(운영진 로스터) + Task 4(내 소속). ✅
- 운영진 생성 + 회원 자가가입 → Task 2(액션) + Task 3(생성) + Task 4(가입). ✅
- 기수(season) 단위 → `groups.season`, 폼/카드에 표기. ✅
- 회원 전용 기본 + 개별 공개 토글 → `is_public` + `setGroupPublic` + Task 5. ✅
- 공개 페이지 멤버 이름 숨김 → `public_groups()`가 이름 미노출, 멤버 수만. ✅
- 정원 초과 차단 → `join_group` RPC. ✅
- RLS(회원 read / anon public / admin write / self-leave) → Task 1. ✅
- 테스트(자가입 게이트·정원·anon 차단·본인만 leave) → 마이그레이션 텍스트 단언 테스트로 정책·RPC 존재 검증(Task 1) + 폼 검증 단위 테스트(Task 2). 라이브 DB 통합 테스트는 이 저장소에 인프라가 없어 텍스트 단언으로 대체(기존 `notifications-migration.test.ts` 관례). ✅

**Placeholder scan:** UI nav 삽입 스텝(Task 3 Step4, Task 4 Step3/4)은 파일의 실제 자료구조를 열어 맞추라는 지시 — 코드 형태는 제시. 이 저장소 관례상 UI 단위 테스트가 없어 해당 태스크는 dev 서버 검증으로 대체(명시).

**Type consistency:** `Group`/`GroupType`/`GroupStatus`/`GroupMember`/`PublicGroupCard` 정의(Task 1)와 이후 사용처(액션·페이지·카드) 일치. `parseGroupForm`/`GroupInput` 시그니처는 Task 2에서 정의·소비 일관. RPC 이름 `join_group`/`public_groups` 마이그레이션·액션·페이지 통일.

## 스코프 밖 (재확인)
팀장 역할, 진행/산출물/마일스톤, 포인트 연동, 가입 승인 플로우, 공개 멤버 이름 노출 — 전부 제외.
