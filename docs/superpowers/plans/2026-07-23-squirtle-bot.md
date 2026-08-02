# 꼬북봇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬랙 `#아무말대잔치`에서 물 마시기 이모지 리액션을 받아 포인트를 적립하고, 누적 인증으로 꼬북이가 꼬부기 → 어니부기 → 거북왕으로 진화하는 봇을 만든다.

**Architecture:** Slack Events API가 `reaction_added`를 Next.js 라우트로 보낸다. 라우트는 서명을 검증하고 200을 즉시 반환한 뒤 `after()`로 DB RPC와 Slack API를 이어서 호출한다. 하루 한 개의 메시지를 Supabase `pg_cron`이 게시하고, 그 메시지의 스레드 답글 하나를 리액션마다 `chat.update`로 갱신해 실시간 집계를 보여준다.

**Tech Stack:** Next.js 16.2.10 (App Router, `after()`), TypeScript strict, Supabase (Postgres + pg_cron + pg_net + Vault), vitest, Slack Web API

**설계서:** `docs/superpowers/specs/2026-07-23-squirtle-bot-design.md`

## Global Constraints

- **이 저장소는 표준 Next.js가 아니다.** 코드를 쓰기 전에 `AGENTS.md`를 읽고, 필요하면 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다.
- **테스트 러너는 vitest다.** `npm test` = `vitest run`. `node:test`를 쓰지 않는다.
- **테스트 코드도 타입 체크된다.** `tsconfig.json`의 `include`가 `**/*.ts`라 `npm run build`가 `tests/`까지 검사한다. 목(mock)에 `any`를 흘리지 말고 파라미터 타입을 명시한다.
- **경로 별칭은 `@/` → `./src/`.** `vitest.config.ts`와 `tsconfig.json` 양쪽에 설정되어 있다.
- **날짜는 전부 KST 기준.** SQL에서 `current_date`를 그대로 쓰지 않는다. 반드시 `(now() at time zone 'Asia/Seoul')::date`. Supabase DB 타임존은 UTC라서, 이걸 어기면 KST 오전 9시 이전 리액션이 전부 거부된다.
- **기존 파일을 수정하지 않는다:** `src/lib/slack.ts`, `supabase/migrations/0004_phase2.sql`의 `admin_grant_points`, `vercel.json`.
- **`tests/accessibility-primitives.test.ts`는 eslint 미설치로 클린 트리에서도 실패한다.** 기존 지뢰이며 이 작업과 무관하다. 고치지 않는다. `package.json`을 건드리지 않는다.
- **RPC EXECUTE 봉인:** 새로 만드는 모든 함수는 `public, anon, authenticated`에서 execute를 revoke한다 (`0004_phase2.sql`의 관례).
- **커밋 메시지에 `Co-Authored-By` 트레일러를 넣지 않는다.** 이 저장소의 훅이 거부한다.
- **커밋은 명시한 경로만 `git add` 한다.** 이 워킹트리에는 다른 세션의 미커밋 변경(`src/actions/member.ts`, `src/app/admin/AdminSidebarNav.tsx`, `src/lib/demoData.ts`, `docs/superpowers/**/admin-places-*`, `src/app/admin/members/pending/`, `tests/admin-places-layout.test.ts`)이 있다. 절대 함께 커밋하지 않는다.

## 기존 코드 현재 상태 (실측)

새 코드가 의존하거나 절대 건드리면 안 되는 것들. 전부 실제로 읽고 확인했다.

| 위치 | 현재 상태 | 이 작업과의 관계 |
|---|---|---|
| `src/lib/cron.ts` | `hasValidCronAuthorization(authorization: string \| null, secret: string): boolean` — `timingSafeEqual`로 `Bearer ${secret}` 비교 | Task 7이 **그대로 재사용**. 새로 만들지 않는다 |
| `src/lib/slack.ts` | `postSlack(text)` 하나뿐. `SLACK_WEBHOOK_URL` Incoming Webhook 전용이라 채널 지정·ts 반환 불가 | **수정 금지.** Task 3에서 `src/lib/slack/api.ts`를 새로 만든다 |
| `src/app/api/cron/event-reminder/route.ts` | `CRON_SECRET` 검증 → service-role `createClient` → 작업 → `NextResponse.json` | Task 7이 이 패턴을 그대로 따른다 |
| `supabase/migrations/0004_phase2.sql:201` | `admin_grant_points`가 `is_admin()`을 검사하고 `created_by`에 `auth.uid()` 사용 | **service-role은 `auth.uid()`가 null이라 반드시 실패한다.** 쓰지 말고 수정도 하지 마라 |
| `supabase/migrations/0004_phase2.sql:57` | `point_logs(user_id, amount, reason, ref_event, created_by, created_at)` — `created_by` nullable | 봇 적립은 `created_by`를 생략한다 |
| `supabase/migrations/0001_init.sql:2` | `profiles(id, name, student_no, major, phone, interests, role, status, joined_at)` — **email 컬럼 없음** | 이메일은 `auth.users`에만 있다. Task 7이 `auth.admin.listUsers()`로 가져온다 |
| `supabase/migrations/0009_roles_positions.sql:22` | `public.is_admin()` 존재 | Task 1의 RLS 정책이 사용 |
| `supabase/migrations/` 최신 | `0041_fix_event_registrants_ambiguous.sql` | 새 파일은 **`0044_squirtle.sql`** |
| `vercel.json` | cron 2개(`attendance-warning`, `event-reminder`) | **수정 금지.** 신규 스케줄은 전부 pg_cron |
| `vitest.config.ts` | `@` → `./src`, `server-only` → `./tests/server-only.ts`, environment node | 별칭 그대로 사용. 설정 수정 불필요 |
| `package.json` | `next 16.2.10`, `react 19.2.4`, `test: vitest run`. **eslint 미설치** | `after`는 `next/server`에서 제공된다(`node_modules/next/server.d.ts:21`). package.json 수정 금지 |

## 알려진 지뢰 (추적 금지)

- 이 레포는 표준 Next.js가 아니다. 코드를 쓰기 전에 `AGENTS.md`를 읽고, 필요하면 `node_modules/next/dist/docs/`를 확인한다.
- **`tests/accessibility-primitives.test.ts`는 상시 실패한다.** eslint 의존성·스크립트를 `package.json`에서 찾는데 eslint가 설치돼 있지 않다. 클린 트리에서도 실패하므로 회귀가 아니다. `package.json`을 고쳐서 "해결"하려 하지 마라.
- turbopack dev의 `adapterFn` 반복 에러는 dev 캐시 이슈다. 코드 문제로 착각하지 마라.
- Supabase DB 타임존은 UTC다. SQL에서 `current_date`를 그대로 쓰면 KST 오전 9시 이전 리액션이 전부 거부된다.
- 이 워킹트리에는 **다른 세션의 미커밋 변경**이 있다: `src/actions/member.ts`, `src/app/admin/AdminSidebarNav.tsx`, `src/lib/demoData.ts`, `docs/superpowers/**/admin-places-*`, `src/app/admin/members/pending/`, `tests/admin-places-layout.test.ts`. 절대 함께 커밋하지 말고 되돌리지도 마라. `git add`는 각 태스크에 명시된 경로만.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0044_squirtle.sql` | 테이블 4개, `profiles.slack_user_id`, RPC 3개 |
| `src/lib/slack/verify.ts` | Slack 요청 서명 검증 (순수 함수) |
| `src/lib/slack/api.ts` | Bot Token으로 postMessage / update / addReaction / usersList |
| `src/lib/squirtle/messages.ts` | 문구 풀과 메시지 조립 (순수 함수) |
| `src/lib/squirtle/types.ts` | RPC 반환 타입 |
| `src/lib/squirtle/backfill.ts` | 슬랙 이메일 ↔ 회원 매칭으로 `slack_user_id` 채우기 |
| `src/app/api/slack/events/route.ts` | 이벤트 수신 + 검증 + `after()` 처리 |
| `src/app/api/cron/squirtle-daily/route.ts` | 시즌 전환 + 일일 메시지 게시 + 백필 |
| `tests/squirtle-migration.test.ts` | 마이그레이션 정적 검증 |
| `tests/squirtle-verify.test.ts` | 서명 검증 동작 테스트 |
| `tests/squirtle-messages.test.ts` | 메시지 조립 동작 테스트 |
| `tests/squirtle-events-route.test.ts` | 라우트 분기 테스트 |

RPC 반환은 snake_case를 그대로 TS 타입으로 받는다. 매핑 레이어를 두지 않는다.

---

### Task 1: 마이그레이션 — 스키마와 RPC

**Files:**
- Create: `supabase/migrations/0044_squirtle.sql`
- Test: `tests/squirtle-migration.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: RPC 3개
  - `squirtle_checkin(p_slack_user text, p_message_ts text) returns jsonb`
  - `squirtle_open_season() returns uuid`
  - `squirtle_close_season() returns jsonb`
  - 테이블 `squirtle_config`, `squirtle_seasons`, `squirtle_posts`, `squirtle_checkins`
  - 컬럼 `profiles.slack_user_id text unique`

- [ ] **Step 1: 실패하는 정적 검증 테스트 작성**

`tests/squirtle-migration.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0044_squirtle.sql", "utf8");
});

describe("꼬북봇 마이그레이션", () => {
  it("인증 중복을 막는 유니크 제약이 있다", () => {
    expect(sql).toContain("unique (season_id, user_id, checked_on)");
  });

  it("하루 두 번 게시를 막는 제약이 있다", () => {
    expect(sql).toMatch(/posted_on\s+date\s+not null\s+unique/);
  });

  it("활성 시즌은 하나뿐이다", () => {
    expect(sql).toContain("squirtle_one_active_season");
    expect(sql).toContain("where status = 'active'");
  });

  it("날짜를 KST로 계산한다", () => {
    expect(sql).toContain("now() at time zone 'Asia/Seoul'");
  });

  it("UTC 기준 current_date를 쓰지 않는다", () => {
    const withoutKst = sql.replace(/\(now\(\) at time zone 'Asia\/Seoul'\)::date/g, "");
    expect(withoutKst).not.toContain("current_date");
  });

  it("RPC 3개가 authenticated 포함 전 롤에서 revoke된다", () => {
    for (const fn of ["squirtle_checkin", "squirtle_open_season", "squirtle_close_season"]) {
      const pattern = new RegExp(
        `revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`,
      );
      expect(sql).toMatch(pattern);
    }
  });

  it("기존 admin_grant_points를 재정의하지 않는다", () => {
    expect(sql).not.toContain("admin_grant_points");
  });

  it("네 테이블 모두 RLS를 켠다", () => {
    for (const t of ["squirtle_config", "squirtle_seasons", "squirtle_posts", "squirtle_checkins"]) {
      expect(sql).toContain(`alter table public.${t} enable row level security`);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-migration.test.ts`
Expected: FAIL — `ENOENT: no such file or directory ... 0044_squirtle.sql`

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0044_squirtle.sql`:

```sql
-- 꼬북봇: 슬랙 리액션 기반 물 마시기 인증 + 시즌 진화

-- 1) 슬랙 계정 연결 컬럼
alter table public.profiles add column slack_user_id text unique;
create index profiles_slack_user_id_idx on public.profiles (slack_user_id)
  where slack_user_id is not null;

-- 2) 설정 (단일 행) — 임계값은 실측 후 조정하는 손잡이
create table public.squirtle_config (
  id int primary key default 1 check (id = 1),
  channel_id text not null,
  emoji text not null,
  points_per_checkin int not null default 5,
  stage2_threshold int not null default 80,
  stage3_threshold int not null default 200,
  bonus_first int not null default 30,
  bonus_second int not null default 20,
  bonus_third int not null default 10
);
insert into public.squirtle_config (id, channel_id, emoji)
values (1, 'C02BE2ERYCC', 'squirtle');

-- 3) 시즌
create table public.squirtle_seasons (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null unique,
  ends_on date not null,
  stage int not null default 1 check (stage between 1 and 3),
  total_count int not null default 0,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now()
);
create unique index squirtle_one_active_season
  on public.squirtle_seasons ((status)) where status = 'active';

-- 4) 하루 한 개의 메시지
create table public.squirtle_posts (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.squirtle_seasons(id) on delete cascade,
  posted_on date not null unique,
  message_ts text not null unique,
  thread_ts text,
  created_at timestamptz not null default now()
);

-- 5) 인증 기록 — 이 유니크 제약 하나가 멱등성의 전부
create table public.squirtle_checkins (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.squirtle_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (season_id, user_id, checked_on)
);

alter table public.squirtle_config enable row level security;
alter table public.squirtle_seasons enable row level security;
alter table public.squirtle_posts enable row level security;
alter table public.squirtle_checkins enable row level security;

create policy "squirtle_config: admin read"
  on public.squirtle_config for select using (public.is_admin());
create policy "squirtle_seasons: admin read"
  on public.squirtle_seasons for select using (public.is_admin());
create policy "squirtle_posts: admin read"
  on public.squirtle_posts for select using (public.is_admin());
create policy "squirtle_checkins: admin read"
  on public.squirtle_checkins for select using (public.is_admin());

-- 6) 시즌 개시 — 남은 날이 14일 미만이면 다음 달 말일까지
create or replace function public.squirtle_open_season()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_month_end date;
  v_ends date;
  v_id uuid;
begin
  if exists (select 1 from squirtle_seasons where status = 'active') then
    select id into v_id from squirtle_seasons where status = 'active';
    return v_id;
  end if;

  v_month_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  if v_month_end - v_today < 14 then
    v_ends := (date_trunc('month', v_today) + interval '2 months - 1 day')::date;
  else
    v_ends := v_month_end;
  end if;

  insert into squirtle_seasons (starts_on, ends_on)
  values (v_today, v_ends)
  on conflict (starts_on) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from squirtle_seasons where starts_on = v_today;
  end if;
  return v_id;
end $$;

-- 7) 인증 처리
create or replace function public.squirtle_checkin(p_slack_user text, p_message_ts text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cfg squirtle_config;
  v_post squirtle_posts;
  v_season squirtle_seasons;
  v_user uuid;
  v_new_stage int;
  v_changed boolean := false;
  v_participants jsonb;
  v_top3 jsonb;
begin
  select * into v_cfg from squirtle_config where id = 1;

  select * into v_post from squirtle_posts where message_ts = p_message_ts;
  if not found or v_post.posted_on <> v_today then
    return jsonb_build_object('counted', false, 'reason', 'stale');
  end if;

  select id into v_user from profiles where slack_user_id = p_slack_user;
  if v_user is null then
    return jsonb_build_object('counted', false, 'reason', 'unlinked');
  end if;

  insert into squirtle_checkins (season_id, user_id, checked_on)
  values (v_post.season_id, v_user, v_today)
  on conflict (season_id, user_id, checked_on) do nothing;
  if not found then
    return jsonb_build_object('counted', false, 'reason', 'duplicate');
  end if;

  insert into point_logs (user_id, amount, reason)
  values (v_user, v_cfg.points_per_checkin, '꼬북봇 물 마시기 인증');

  update squirtle_seasons
    set total_count = total_count + 1
    where id = v_post.season_id
    returning * into v_season;

  v_new_stage := case
    when v_season.total_count >= v_cfg.stage3_threshold then 3
    when v_season.total_count >= v_cfg.stage2_threshold then 2
    else 1 end;

  if v_new_stage > v_season.stage then
    update squirtle_seasons set stage = v_new_stage where id = v_season.id;
    v_changed := true;
  end if;

  select coalesce(jsonb_agg(p.slack_user_id order by c.created_at), '[]'::jsonb)
    into v_participants
    from squirtle_checkins c join profiles p on p.id = c.user_id
    where c.season_id = v_season.id and c.checked_on = v_today;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top3 from (
    select p.slack_user_id, count(*)::int as count
      from squirtle_checkins c join profiles p on p.id = c.user_id
      where c.season_id = v_season.id
      group by p.slack_user_id
      order by count(*) desc, max(c.created_at) asc
      limit 3
  ) t;

  return jsonb_build_object(
    'counted', true,
    'total', v_season.total_count,
    'stage', v_new_stage,
    'stage_changed', v_changed,
    'participants', v_participants,
    'top3', v_top3
  );
end $$;

-- 8) 시즌 마감 — 이미 closed면 무동작 (보너스 중복 지급 방지)
create or replace function public.squirtle_close_season()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_cfg squirtle_config;
  v_season squirtle_seasons;
  v_top3 jsonb;
  v_row record;
  v_rank int := 0;
  v_bonus int;
begin
  select * into v_cfg from squirtle_config where id = 1;

  select * into v_season from squirtle_seasons
    where status = 'active' and ends_on < v_today;
  if not found then
    return jsonb_build_object('closed', false);
  end if;

  update squirtle_seasons set status = 'closed' where id = v_season.id;

  for v_row in
    select p.id as user_id, p.slack_user_id, count(*)::int as count
      from squirtle_checkins c join profiles p on p.id = c.user_id
      where c.season_id = v_season.id
      group by p.id, p.slack_user_id
      order by count(*) desc, max(c.created_at) asc
      limit 3
  loop
    v_rank := v_rank + 1;
    v_bonus := case v_rank
      when 1 then v_cfg.bonus_first
      when 2 then v_cfg.bonus_second
      else v_cfg.bonus_third end;
    insert into point_logs (user_id, amount, reason)
    values (v_row.user_id, v_bonus, '꼬북봇 시즌 ' || v_rank || '위 보너스');
  end loop;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top3 from (
    select p.slack_user_id, count(*)::int as count
      from squirtle_checkins c join profiles p on p.id = c.user_id
      where c.season_id = v_season.id
      group by p.slack_user_id
      order by count(*) desc, max(c.created_at) asc
      limit 3
  ) t;

  return jsonb_build_object(
    'closed', true,
    'stage', v_season.stage,
    'total', v_season.total_count,
    'top3', v_top3
  );
end $$;

-- 9) EXECUTE 봉인 — service-role 전용
revoke execute on function public.squirtle_checkin(text, text) from public, anon, authenticated;
revoke execute on function public.squirtle_open_season() from public, anon, authenticated;
revoke execute on function public.squirtle_close_season() from public, anon, authenticated;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-migration.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0044_squirtle.sql tests/squirtle-migration.test.ts
git commit -m "🗃️ 꼬북봇 스키마: 시즌·인증·설정 테이블과 RPC 3종"
```

---

### Task 2: Slack 요청 서명 검증

**Files:**
- Create: `src/lib/slack/verify.ts`
- Test: `tests/squirtle-verify.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `verifySlackSignature(params: VerifyParams): boolean`
  ```ts
  type VerifyParams = {
    rawBody: string;
    timestamp: string | null;
    signature: string | null;
    signingSecret: string;
    now?: Date;
  };
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/squirtle-verify.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "@/lib/slack/verify";

const SECRET = "test-signing-secret";
const BODY = '{"type":"event_callback"}';

function sign(body: string, timestamp: string, secret = SECRET) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`v0:${timestamp}:${body}`);
  return `v0=${hmac.digest("hex")}`;
}

const NOW = new Date("2026-07-23T10:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

describe("Slack 서명 검증", () => {
  it("유효한 서명을 통과시킨다", () => {
    expect(
      verifySlackSignature({
        rawBody: BODY,
        timestamp: TS,
        signature: sign(BODY, TS),
        signingSecret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("body가 변조되면 거부한다", () => {
    expect(
      verifySlackSignature({
        rawBody: '{"type":"tampered"}',
        timestamp: TS,
        signature: sign(BODY, TS),
        signingSecret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("다른 시크릿으로 만든 서명을 거부한다", () => {
    expect(
      verifySlackSignature({
        rawBody: BODY,
        timestamp: TS,
        signature: sign(BODY, TS, "wrong-secret"),
        signingSecret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("5분을 초과한 요청을 거부한다 (리플레이 방지)", () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 301);
    expect(
      verifySlackSignature({
        rawBody: BODY,
        timestamp: old,
        signature: sign(BODY, old),
        signingSecret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("미래로 5분을 초과한 요청도 거부한다", () => {
    const future = String(Math.floor(NOW.getTime() / 1000) + 301);
    expect(
      verifySlackSignature({
        rawBody: BODY,
        timestamp: future,
        signature: sign(BODY, future),
        signingSecret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("헤더가 없으면 거부한다", () => {
    expect(
      verifySlackSignature({
        rawBody: BODY, timestamp: null, signature: null,
        signingSecret: SECRET, now: NOW,
      }),
    ).toBe(false);
  });

  it("서명 형식이 잘못되면 거부한다", () => {
    expect(
      verifySlackSignature({
        rawBody: BODY, timestamp: TS, signature: "garbage",
        signingSecret: SECRET, now: NOW,
      }),
    ).toBe(false);
  });

  it("timestamp가 숫자가 아니면 거부한다", () => {
    expect(
      verifySlackSignature({
        rawBody: BODY, timestamp: "not-a-number", signature: sign(BODY, TS),
        signingSecret: SECRET, now: NOW,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-verify.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/slack/verify"`

- [ ] **Step 3: 구현**

`src/lib/slack/verify.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export type VerifyParams = {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret: string;
  now?: Date;
};

export function verifySlackSignature({
  rawBody,
  timestamp,
  signature,
  signingSecret,
  now = new Date(),
}: VerifyParams): boolean {
  if (!timestamp || !signature) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - sent) > MAX_SKEW_SECONDS) return false;

  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`v0:${timestamp}:${rawBody}`);
  const expected = Buffer.from(`v0=${hmac.digest("hex")}`);
  const actual = Buffer.from(signature);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-verify.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/slack/verify.ts tests/squirtle-verify.test.ts
git commit -m "🔐 슬랙 요청 서명 검증 유틸"
```

---

### Task 3: Slack Web API 클라이언트

**Files:**
- Create: `src/lib/slack/api.ts`
- Test: `tests/squirtle-slack-api.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  ```ts
  type SlackResult = { ok: true; ts: string } | { ok: false; error: string };
  postMessage(opts: { channel: string; text: string; threadTs?: string }): Promise<SlackResult>
  updateMessage(opts: { channel: string; ts: string; text: string }): Promise<SlackResult>
  addReaction(opts: { channel: string; ts: string; emoji: string }): Promise<{ ok: boolean; error?: string }>
  listUserEmails(): Promise<Map<string, string>>   // slackUserId → 소문자 이메일
  ```

기존 `src/lib/slack.ts`의 `postSlack`은 Incoming Webhook 전용이라 채널 지정과 ts 반환이 안 된다. 수정하지 않고 새 파일을 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/squirtle-slack-api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addReaction, listUserEmails, postMessage, updateMessage } from "@/lib/slack/api";

const originalFetch = globalThis.fetch;

// 파라미터 타입을 명시해야 mock.calls가 튜플로 잡힌다 (테스트도 타입 체크 대상)
function mockFetch(payload: unknown) {
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200 }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Slack Web API 클라이언트", () => {
  it("postMessage가 ts를 돌려준다", async () => {
    const spy = mockFetch({ ok: true, ts: "1784791636.251449" });
    const result = await postMessage({ channel: "C1", text: "안녕" });

    expect(result).toEqual({ ok: true, ts: "1784791636.251449" });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer xoxb-test" });
    expect(JSON.parse(String(init?.body))).toEqual({ channel: "C1", text: "안녕" });
  });

  it("threadTs를 주면 thread_ts로 보낸다", async () => {
    const spy = mockFetch({ ok: true, ts: "2" });
    await postMessage({ channel: "C1", text: "답글", threadTs: "1" });

    const [, init] = spy.mock.calls[0];
    expect(JSON.parse(String(init?.body)).thread_ts).toBe("1");
  });

  it("HTTP 200이어도 ok:false면 실패로 처리한다", async () => {
    mockFetch({ ok: false, error: "channel_not_found" });
    const result = await postMessage({ channel: "C1", text: "안녕" });

    expect(result).toEqual({ ok: false, error: "channel_not_found" });
  });

  it("updateMessage가 chat.update를 호출한다", async () => {
    const spy = mockFetch({ ok: true, ts: "1" });
    const result = await updateMessage({ channel: "C1", ts: "1", text: "수정" });

    expect(result).toEqual({ ok: true, ts: "1" });
    expect(spy.mock.calls[0][0]).toBe("https://slack.com/api/chat.update");
  });

  it("addReaction이 콜론 없는 이름을 보낸다", async () => {
    const spy = mockFetch({ ok: true });
    await addReaction({ channel: "C1", ts: "1", emoji: "squirtle" });

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://slack.com/api/reactions.add");
    expect(JSON.parse(String(init?.body)).name).toBe("squirtle");
  });

  it("already_reacted는 성공으로 취급한다", async () => {
    mockFetch({ ok: false, error: "already_reacted" });
    const result = await addReaction({ channel: "C1", ts: "1", emoji: "squirtle" });

    expect(result.ok).toBe(true);
  });

  it("listUserEmails가 봇·삭제 사용자를 빼고 소문자 이메일로 모은다", async () => {
    mockFetch({
      ok: true,
      members: [
        { id: "U1", is_bot: false, deleted: false, profile: { email: "A@Gmail.com" } },
        { id: "U2", is_bot: true, deleted: false, profile: { email: "bot@x.com" } },
        { id: "U3", is_bot: false, deleted: true, profile: { email: "gone@x.com" } },
        { id: "U4", is_bot: false, deleted: false, profile: {} },
      ],
      response_metadata: { next_cursor: "" },
    });

    const map = await listUserEmails();
    expect(map.get("U1")).toBe("a@gmail.com");
    expect(map.size).toBe(1);
  });

  it("토큰이 없으면 호출하지 않고 실패를 반환한다", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const spy = mockFetch({ ok: true, ts: "1" });
    const result = await postMessage({ channel: "C1", text: "안녕" });

    expect(result).toEqual({ ok: false, error: "missing_token" });
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-slack-api.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/slack/api"`

- [ ] **Step 3: 구현**

`src/lib/slack/api.ts`:

```ts
// 서버 전용: SLACK_BOT_TOKEN은 서버 환경변수이므로 클라이언트 컴포넌트에서 import하지 말 것.
const BASE = "https://slack.com/api";

export type SlackResult = { ok: true; ts: string } | { ok: false; error: string };

type SlackResponse = { ok: boolean; error?: string; ts?: string };

async function call(method: string, body: Record<string, unknown>): Promise<SlackResponse> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: "missing_token" };

  try {
    const res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    // Slack은 실패해도 HTTP 200에 {ok:false}를 준다 — body를 봐야 한다
    return (await res.json()) as SlackResponse;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : "fetch_failed" };
  }
}

function toResult(res: SlackResponse): SlackResult {
  if (!res.ok || !res.ts) return { ok: false, error: res.error ?? "unknown_error" };
  return { ok: true, ts: res.ts };
}

export async function postMessage(opts: {
  channel: string;
  text: string;
  threadTs?: string;
}): Promise<SlackResult> {
  const body: Record<string, unknown> = { channel: opts.channel, text: opts.text };
  if (opts.threadTs) body.thread_ts = opts.threadTs;
  return toResult(await call("chat.postMessage", body));
}

export async function updateMessage(opts: {
  channel: string;
  ts: string;
  text: string;
}): Promise<SlackResult> {
  return toResult(await call("chat.update", { channel: opts.channel, ts: opts.ts, text: opts.text }));
}

export async function addReaction(opts: {
  channel: string;
  ts: string;
  emoji: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await call("reactions.add", {
    channel: opts.channel,
    timestamp: opts.ts,
    name: opts.emoji,
  });
  // 이미 달려 있으면 목적은 달성된 상태다
  if (!res.ok && res.error === "already_reacted") return { ok: true };
  return { ok: res.ok, error: res.error };
}

type SlackMember = {
  id: string;
  is_bot?: boolean;
  deleted?: boolean;
  profile?: { email?: string };
};

export async function listUserEmails(): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  let cursor = "";

  do {
    const res = (await call("users.list", { limit: 200, cursor })) as SlackResponse & {
      members?: SlackMember[];
      response_metadata?: { next_cursor?: string };
    };
    if (!res.ok) break;

    for (const member of res.members ?? []) {
      const email = member.profile?.email;
      if (member.is_bot || member.deleted || !email) continue;
      emails.set(member.id, email.toLowerCase());
    }
    cursor = res.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return emails;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-slack-api.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/slack/api.ts tests/squirtle-slack-api.test.ts
git commit -m "🔌 슬랙 봇 토큰 API 클라이언트 (postMessage/update/reaction/users)"
```

---

### Task 4: 메시지 조립

**Files:**
- Create: `src/lib/squirtle/types.ts`
- Create: `src/lib/squirtle/messages.ts`
- Test: `tests/squirtle-messages.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  ```ts
  // types.ts
  type Stage = 1 | 2 | 3;
  type Contributor = { slack_user_id: string; count: number };
  type CheckinResult =
    | { counted: false; reason: string }
    | { counted: true; total: number; stage: Stage; stage_changed: boolean;
        participants: string[]; top3: Contributor[] };
  type CloseResult =
    | { closed: false }
    | { closed: true; stage: Stage; total: number; top3: Contributor[] };

  // messages.ts
  const STAGE_NAMES: Record<Stage, string>;
  const DAILY_MESSAGES: readonly string[];   // 15개
  dailyMessage(emoji: string, index: number): string
  threadSummary(o: { participants: string[]; total: number; stage: Stage; stage3Threshold: number }): string
  evolutionMessage(o: { stage: Stage; total: number; top3: Contributor[]; participantCount: number }): string
  seasonEndMessage(o: { stage: Stage; total: number; top3: Contributor[]; bonuses: readonly [number, number, number] }): string
  ```

`dailyMessage`는 랜덤을 안에서 쓰지 않고 `index`를 받는다. 그래야 테스트가 결정적이다. 랜덤 선택은 호출부에서 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/squirtle-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DAILY_MESSAGES,
  dailyMessage,
  evolutionMessage,
  seasonEndMessage,
  threadSummary,
} from "@/lib/squirtle/messages";

describe("일일 메시지", () => {
  it("문구가 15개다 (구미베어처럼 매주 같은 문구를 쓰지 않는다)", () => {
    expect(DAILY_MESSAGES).toHaveLength(15);
    expect(new Set(DAILY_MESSAGES).size).toBe(15);
  });

  it("이모지 안내를 포함한다", () => {
    expect(dailyMessage("squirtle", 0)).toContain(":squirtle:");
  });

  it("index를 문구 개수로 나눈 나머지로 고른다", () => {
    expect(dailyMessage("squirtle", 15)).toBe(dailyMessage("squirtle", 0));
  });

  it("외부 링크를 넣지 않는다", () => {
    for (let i = 0; i < DAILY_MESSAGES.length; i += 1) {
      expect(dailyMessage("squirtle", i)).not.toMatch(/https?:\/\//);
    }
  });
});

describe("스레드 집계", () => {
  it("참여자를 멘션 형식으로 호명하고 남은 잔을 알려준다", () => {
    const text = threadSummary({
      participants: ["U1", "U2"], total: 158, stage: 2, stage3Threshold: 200,
    });

    expect(text).toContain("2명");
    expect(text).toContain("<@U1>");
    expect(text).toContain("<@U2>");
    expect(text).toContain("42잔");
  });

  it("거북왕이면 남은 잔 문구를 뺀다", () => {
    const text = threadSummary({
      participants: ["U1"], total: 210, stage: 3, stage3Threshold: 200,
    });

    expect(text).not.toContain("남았");
    expect(text).toContain("거북왕");
  });

  it("참여자가 없으면 빈 문자열을 돌려준다", () => {
    expect(threadSummary({
      participants: [], total: 0, stage: 1, stage3Threshold: 200,
    })).toBe("");
  });
});

describe("진화 축하", () => {
  const top3 = [
    { slack_user_id: "U1", count: 24 },
    { slack_user_id: "U2", count: 22 },
    { slack_user_id: "U3", count: 19 },
  ];

  it("단계 이름과 순위를 메달과 함께 보여준다", () => {
    const text = evolutionMessage({ stage: 3, total: 200, top3, participantCount: 21 });

    expect(text).toContain("거북왕");
    expect(text).toContain("🥇 <@U1> 24잔");
    expect(text).toContain("🥈 <@U2> 22잔");
    expect(text).toContain("🥉 <@U3> 19잔");
    expect(text).toContain("21명");
  });

  it("참여자가 3명 미만이면 있는 만큼만 보여준다", () => {
    const text = evolutionMessage({
      stage: 2, total: 80, top3: top3.slice(0, 1), participantCount: 1,
    });

    expect(text).toContain("🥇 <@U1>");
    expect(text).not.toContain("🥈");
  });
});

describe("시즌 종료", () => {
  it("최종 단계와 보너스 포인트를 안내한다", () => {
    const text = seasonEndMessage({
      stage: 2, total: 143,
      top3: [{ slack_user_id: "U1", count: 20 }],
      bonuses: [30, 20, 10],
    });

    expect(text).toContain("어니부기");
    expect(text).toContain("143");
    expect(text).toContain("30포인트");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-messages.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/squirtle/messages"`

- [ ] **Step 3: 구현**

`src/lib/squirtle/types.ts`:

```ts
export type Stage = 1 | 2 | 3;

export type Contributor = { slack_user_id: string; count: number };

export type CheckinResult =
  | { counted: false; reason: string }
  | {
      counted: true;
      total: number;
      stage: Stage;
      stage_changed: boolean;
      participants: string[];
      top3: Contributor[];
    };

export type CloseResult =
  | { closed: false }
  | { closed: true; stage: Stage; total: number; top3: Contributor[] };
```

`src/lib/squirtle/messages.ts`:

```ts
import type { Contributor, Stage } from "./types";

export const STAGE_NAMES: Record<Stage, string> = {
  1: "꼬부기",
  2: "어니부기",
  3: "거북왕",
};

const MEDALS = ["🥇", "🥈", "🥉"] as const;

// 매번 다른 문구를 쓴다 — 같은 문구 반복은 3주면 배경으로 처리된다
export const DAILY_MESSAGES = [
  "꼬북이가 물을 한 잔 마셨어요. 여러분도 한 잔 어때요?",
  "물 마실 시간이에요! 꼬북이가 컵을 들고 기다리고 있어요.",
  "꼬북이가 목이 마르대요. 같이 한 잔 하실래요?",
  "오늘도 수분 충전! 꼬북이는 벌써 마셨어요.",
  "똑똑, 꼬북이예요. 물 챙겨 드셨나요?",
  "꼬북이가 물병을 흔들고 있어요. 신호예요!",
  "한 잔의 물이 오늘의 컨디션을 바꿔요. 꼬북이의 조언입니다.",
  "꼬북이가 여러분을 기다리며 물을 홀짝이고 있어요.",
  "잠깐! 지금 물 한 잔 하고 오는 거 어때요?",
  "꼬북이가 오늘도 출석했어요. 여러분은요?",
  "물 마시기 딱 좋은 시간이에요. 꼬북이 보증.",
  "꼬북이가 컵을 두 개 준비했어요. 하나는 여러분 거예요.",
  "수분 부족은 집중력의 적이래요. 꼬북이가 그러던데요.",
  "오늘 첫 잔이신가요? 꼬북이는 세 잔째예요.",
  "꼬북이와 함께하는 물 마시기 타임! 지금이에요.",
] as const;

export function dailyMessage(emoji: string, index: number): string {
  const line = DAILY_MESSAGES[index % DAILY_MESSAGES.length];
  return `🐢 ${line}\n:${emoji}: 눌러서 함께해요!`;
}

export function threadSummary(o: {
  participants: string[];
  total: number;
  stage: Stage;
  stage3Threshold: number;
}): string {
  if (o.participants.length === 0) return "";

  const mentions = o.participants.map((id) => `<@${id}>`).join(" ");
  const head = `🐢 오늘 ${o.participants.length}명이 꼬북이와 함께했어요!\n${mentions}`;

  if (o.stage >= 3) return `${head}\n꼬북이는 이미 거북왕이에요 🏆`;

  const remaining = Math.max(o.stage3Threshold - o.total, 0);
  return `${head}\n거북왕까지 ${remaining}잔 남았어요`;
}

function ranking(top3: Contributor[]): string {
  return top3
    .map((c, i) => `${MEDALS[i]} <@${c.slack_user_id}> ${c.count}잔`)
    .join("\n");
}

export function evolutionMessage(o: {
  stage: Stage;
  total: number;
  top3: Contributor[];
  participantCount: number;
}): string {
  return [
    `🎉 꼬북이가 ${STAGE_NAMES[o.stage]}(으)로 진화했어요!`,
    `   이번 시즌 ${o.total}잔 달성 🏆`,
    "",
    ranking(o.top3),
    "",
    `함께해준 ${o.participantCount}명 모두 고마워요!`,
  ].join("\n");
}

export function seasonEndMessage(o: {
  stage: Stage;
  total: number;
  top3: Contributor[];
  bonuses: readonly [number, number, number];
}): string {
  const bonusLines = o.top3
    .map((c, i) => `${MEDALS[i]} <@${c.slack_user_id}> ${c.count}잔 · ${o.bonuses[i]}포인트`)
    .join("\n");

  return [
    "🏁 이번 시즌이 끝났어요!",
    `   최종 ${STAGE_NAMES[o.stage]} · 총 ${o.total}잔`,
    "",
    bonusLines,
    "",
    "내일부터 새 시즌이 꼬부기로 시작해요. 다시 키워봐요 🐢",
  ].join("\n");
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-messages.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/squirtle/types.ts src/lib/squirtle/messages.ts tests/squirtle-messages.test.ts
git commit -m "💬 꼬북봇 메시지 조립: 문구 풀 15종·스레드 집계·진화 축하"
```

---

### Task 5: 이벤트 수신 라우트

**Files:**
- Create: `src/app/api/slack/events/route.ts`
- Test: `tests/squirtle-events-route.test.ts`

**Interfaces:**
- Consumes: `verifySlackSignature` (Task 2), `postMessage`/`updateMessage` (Task 3), `threadSummary`/`evolutionMessage` (Task 4), `CheckinResult` (Task 4), RPC `squirtle_checkin` (Task 1)
- Produces: `POST` 핸들러. 테스트를 위해 `shouldProcess(event, config)`를 별도 export 한다.
  ```ts
  export function shouldProcess(
    event: { type?: string; user?: string; reaction?: string; item?: { ts?: string } },
    config: { emoji: string; botUserId: string },
  ): boolean
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/squirtle-events-route.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (fn: () => unknown) => { void fn; } };
});

const SECRET = "test-signing-secret";

function signedRequest(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const hmac = createHmac("sha256", secret);
  hmac.update(`v0:${ts}:${raw}`);

  return new Request("https://example.com/api/slack/events", {
    method: "POST",
    headers: {
      "x-slack-request-timestamp": ts,
      "x-slack-signature": `v0=${hmac.digest("hex")}`,
      "content-type": "application/json",
    },
    body: raw,
  });
}

beforeEach(() => {
  process.env.SLACK_SIGNING_SECRET = SECRET;
  process.env.SLACK_BOT_USER_ID = "UBOT";
});

afterEach(() => {
  vi.resetModules();
});

describe("이벤트 라우트", () => {
  it("url_verification에 challenge를 그대로 돌려준다", async () => {
    const { POST } = await import("@/app/api/slack/events/route");
    const res = await POST(signedRequest({ type: "url_verification", challenge: "abc123" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge: "abc123" });
  });

  it("서명이 틀리면 401을 준다", async () => {
    const { POST } = await import("@/app/api/slack/events/route");
    const res = await POST(signedRequest({ type: "event_callback" }, "wrong-secret"));

    expect(res.status).toBe(401);
  });

  it("유효한 이벤트에 200을 즉시 준다", async () => {
    const { POST } = await import("@/app/api/slack/events/route");
    const res = await POST(
      signedRequest({
        type: "event_callback",
        event: { type: "reaction_added", user: "U1", reaction: "squirtle", item: { ts: "1" } },
      }),
    );

    expect(res.status).toBe(200);
  });
});

describe("shouldProcess", () => {
  const config = { emoji: "squirtle", botUserId: "UBOT" };

  it("설정된 이모지의 reaction_added를 처리한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(
      shouldProcess({ type: "reaction_added", user: "U1", reaction: "squirtle", item: { ts: "1" } }, config),
    ).toBe(true);
  });

  it("다른 이모지는 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(
      shouldProcess({ type: "reaction_added", user: "U1", reaction: "tada", item: { ts: "1" } }, config),
    ).toBe(false);
  });

  it("reaction_added가 아니면 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(
      shouldProcess({ type: "reaction_removed", user: "U1", reaction: "squirtle", item: { ts: "1" } }, config),
    ).toBe(false);
  });

  it("봇 자신의 리액션은 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(
      shouldProcess({ type: "reaction_added", user: "UBOT", reaction: "squirtle", item: { ts: "1" } }, config),
    ).toBe(false);
  });

  it("item.ts가 없으면 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(
      shouldProcess({ type: "reaction_added", user: "U1", reaction: "squirtle", item: {} }, config),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-events-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/slack/events/route"`

- [ ] **Step 3: 구현**

`src/app/api/slack/events/route.ts`:

```ts
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/verify";
import { postMessage, updateMessage } from "@/lib/slack/api";
import { evolutionMessage, threadSummary } from "@/lib/squirtle/messages";
import type { CheckinResult, Stage } from "@/lib/squirtle/types";

type ReactionEvent = {
  type?: string;
  user?: string;
  reaction?: string;
  item?: { ts?: string };
};

export function shouldProcess(
  event: ReactionEvent,
  config: { emoji: string; botUserId: string },
): boolean {
  if (event.type !== "reaction_added") return false;
  if (event.reaction !== config.emoji) return false;
  if (!event.user || event.user === config.botUserId) return false;
  if (!event.item?.ts) return false;
  return true;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function handleReaction(event: ReactionEvent) {
  const supabase = serviceClient();
  if (!supabase) return;

  const { data: config } = await supabase
    .from("squirtle_config")
    .select("channel_id, emoji, stage3_threshold")
    .eq("id", 1)
    .single();
  if (!config) return;

  if (!shouldProcess(event, { emoji: config.emoji, botUserId: process.env.SLACK_BOT_USER_ID ?? "" })) {
    return;
  }

  const messageTs = event.item!.ts!;
  const { data, error } = await supabase.rpc("squirtle_checkin", {
    p_slack_user: event.user,
    p_message_ts: messageTs,
  });
  if (error) return;

  const result = data as CheckinResult;
  if (!result.counted) return;

  const { data: post } = await supabase
    .from("squirtle_posts")
    .select("thread_ts")
    .eq("message_ts", messageTs)
    .single();

  const text = threadSummary({
    participants: result.participants,
    total: result.total,
    stage: result.stage,
    stage3Threshold: config.stage3_threshold,
  });
  if (!text) return;

  if (post?.thread_ts) {
    const updated = await updateMessage({ channel: config.channel_id, ts: post.thread_ts, text });
    // 스레드 답글이 삭제된 경우 — thread_ts를 비워 다음 리액션 때 다시 만든다
    if (!updated.ok && updated.error === "message_not_found") {
      await supabase.from("squirtle_posts").update({ thread_ts: null }).eq("message_ts", messageTs);
    }
  } else {
    const created = await postMessage({ channel: config.channel_id, text, threadTs: messageTs });
    if (created.ok) {
      await supabase
        .from("squirtle_posts")
        .update({ thread_ts: created.ts })
        .eq("message_ts", messageTs);
    }
  }

  if (result.stage_changed) {
    await postMessage({
      channel: config.channel_id,
      text: evolutionMessage({
        stage: result.stage as Stage,
        total: result.total,
        top3: result.top3,
        participantCount: result.participants.length,
      }),
    });
  }
}

export async function POST(request: Request) {
  // 서명 검증에 원문이 필요하므로 json()을 먼저 부르면 안 된다
  const rawBody = await request.text();

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return Response.json({ error: "not_configured" }, { status: 500 });
  }

  const valid = verifySlackSignature({
    rawBody,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    signingSecret,
  });
  if (!valid) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: { type?: string; challenge?: string; event?: ReactionEvent };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  // Slack은 3초 안에 응답이 없으면 재시도한다. 200을 먼저 주고 나머지는 after()로.
  if (payload.event) {
    const event = payload.event;
    after(async () => {
      try {
        await handleReaction(event);
      } catch {
        // 스레드 표시는 다음 리액션 때 자동 정정된다 — 재시도하지 않는다
      }
    });
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-events-route.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/slack/events/route.ts tests/squirtle-events-route.test.ts
git commit -m "🎣 슬랙 리액션 수신 라우트: 검증 후 after()로 인증 처리"
```

---

### Task 6: 슬랙 계정 백필

**Files:**
- Create: `src/lib/squirtle/backfill.ts`
- Test: `tests/squirtle-backfill.test.ts`

**Interfaces:**
- Consumes: `listUserEmails` (Task 3)
- Produces: `matchSlackUsers(slackEmails: Map<string,string>, members: MemberEmail[]): Array<{ id: string; slack_user_id: string }>`
  ```ts
  type MemberEmail = { id: string; email: string };
  ```

이메일 매칭은 순수 함수로 떼어내 테스트하고, DB 입출력은 Task 7의 크론이 담당한다. 신규 가입자가 계속 생기므로 일회성 스크립트가 아니라 매일 도는 크론에 붙인다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/squirtle-backfill.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchSlackUsers } from "@/lib/squirtle/backfill";

describe("슬랙 계정 매칭", () => {
  it("이메일이 같으면 짝지어준다", () => {
    const slack = new Map([["U1", "a@gmail.com"]]);
    const result = matchSlackUsers(slack, [{ id: "p1", email: "a@gmail.com" }]);

    expect(result).toEqual([{ id: "p1", slack_user_id: "U1" }]);
  });

  it("대소문자를 무시한다", () => {
    const slack = new Map([["U1", "a@gmail.com"]]);
    const result = matchSlackUsers(slack, [{ id: "p1", email: "A@Gmail.COM" }]);

    expect(result).toHaveLength(1);
  });

  it("짝이 없는 회원은 건너뛴다", () => {
    const slack = new Map([["U1", "a@gmail.com"]]);
    const result = matchSlackUsers(slack, [{ id: "p2", email: "b@gmail.com" }]);

    expect(result).toEqual([]);
  });

  it("이메일이 빈 회원은 건너뛴다", () => {
    const slack = new Map([["U1", "a@gmail.com"]]);
    const result = matchSlackUsers(slack, [{ id: "p1", email: "" }]);

    expect(result).toEqual([]);
  });

  it("같은 이메일이 여러 회원에 있으면 아무도 매칭하지 않는다", () => {
    const slack = new Map([["U1", "a@gmail.com"]]);
    const result = matchSlackUsers(slack, [
      { id: "p1", email: "a@gmail.com" },
      { id: "p2", email: "a@gmail.com" },
    ]);

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-backfill.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/squirtle/backfill"`

- [ ] **Step 3: 구현**

`src/lib/squirtle/backfill.ts`:

```ts
export type MemberEmail = { id: string; email: string };

/**
 * 슬랙 이메일과 회원 이메일을 대조해 연결 대상을 고른다.
 * 한 이메일이 여러 회원에 걸리면 잘못 붙일 위험이 있으므로 전부 건너뛴다.
 */
export function matchSlackUsers(
  slackEmails: Map<string, string>,
  members: MemberEmail[],
): Array<{ id: string; slack_user_id: string }> {
  const byEmail = new Map<string, string | null>();

  for (const member of members) {
    const email = member.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, byEmail.has(email) ? null : member.id);
  }

  const matches: Array<{ id: string; slack_user_id: string }> = [];
  for (const [slackUserId, email] of slackEmails) {
    const memberId = byEmail.get(email);
    if (memberId) matches.push({ id: memberId, slack_user_id: slackUserId });
  }
  return matches;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-backfill.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/squirtle/backfill.ts tests/squirtle-backfill.test.ts
git commit -m "🔗 슬랙 이메일 ↔ 회원 매칭 로직"
```

---

### Task 7: 일일 크론 라우트

**Files:**
- Create: `src/app/api/cron/squirtle-daily/route.ts`
- Test: `tests/squirtle-cron-route.test.ts`

**Interfaces:**
- Consumes: `hasValidCronAuthorization` (`src/lib/cron.ts`, 기존), `postMessage`/`addReaction`/`listUserEmails` (Task 3), `dailyMessage`/`seasonEndMessage`/`DAILY_MESSAGES` (Task 4), `matchSlackUsers` (Task 6), RPC `squirtle_open_season`/`squirtle_close_season` (Task 1)
- Produces: `GET` 핸들러

기존 [event-reminder](src/app/api/cron/event-reminder/route.ts)의 인증·클라이언트 생성 패턴을 그대로 따른다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/squirtle-cron-route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function request(auth?: string) {
  return new NextRequest("https://example.com/api/cron/squirtle-daily", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
});

afterEach(() => {
  vi.resetModules();
});

describe("일일 크론 라우트", () => {
  it("CRON_SECRET이 없으면 401", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    const res = await GET(request("Bearer cron-secret"));

    expect(res.status).toBe(401);
  });

  it("Authorization 헤더가 없으면 401", async () => {
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    const res = await GET(request());

    expect(res.status).toBe(401);
  });

  it("잘못된 시크릿이면 401", async () => {
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    const res = await GET(request("Bearer wrong"));

    expect(res.status).toBe(401);
  });

  it("Supabase 설정이 없으면 500", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    const res = await GET(request("Bearer cron-secret"));

    expect(res.status).toBe(500);
  });
});

describe("pickMessageIndex", () => {
  it("문구 개수 범위 안의 정수를 돌려준다", async () => {
    const { pickMessageIndex } = await import("@/app/api/cron/squirtle-daily/route");
    const { DAILY_MESSAGES } = await import("@/lib/squirtle/messages");

    for (let i = 0; i < 50; i += 1) {
      const index = pickMessageIndex();
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(DAILY_MESSAGES.length);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/squirtle-cron-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/cron/squirtle-daily/route"`

- [ ] **Step 3: 구현**

`src/app/api/cron/squirtle-daily/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { addReaction, listUserEmails, postMessage } from "@/lib/slack/api";
import { DAILY_MESSAGES, dailyMessage, seasonEndMessage } from "@/lib/squirtle/messages";
import { matchSlackUsers } from "@/lib/squirtle/backfill";
import type { CloseResult, Stage } from "@/lib/squirtle/types";

export function pickMessageIndex(): number {
  return Math.floor(Math.random() * DAILY_MESSAGES.length);
}

type ServiceClient = ReturnType<typeof createClient>;

async function backfillSlackIds(supabase: ServiceClient) {
  const { data: unlinked } = await supabase
    .from("profiles")
    .select("id")
    .is("slack_user_id", null);
  if (!unlinked || unlinked.length === 0) return 0;

  const slackEmails = await listUserEmails();
  if (slackEmails.size === 0) return 0;

  // 이메일은 auth.users에만 있다 (profiles에는 email 컬럼이 없음)
  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const unlinkedIds = new Set(unlinked.map((row) => row.id as string));
  const members = (users?.users ?? [])
    .filter((user) => unlinkedIds.has(user.id))
    .map((user) => ({ id: user.id, email: user.email ?? "" }));

  const matches = matchSlackUsers(slackEmails, members);
  for (const match of matches) {
    await supabase
      .from("profiles")
      .update({ slack_user_id: match.slack_user_id })
      .eq("id", match.id);
  }
  return matches.length;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았어요" }, { status: 401 });
  }
  if (!hasValidCronAuthorization(request.headers.get("authorization"), cronSecret)) {
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

  const { data: config } = await supabase
    .from("squirtle_config")
    .select("channel_id, emoji, bonus_first, bonus_second, bonus_third")
    .eq("id", 1)
    .single();
  if (!config) {
    return NextResponse.json({ error: "꼬북봇 설정이 없어요" }, { status: 500 });
  }

  // 1) 지난 시즌 마감 — 이미 closed면 RPC가 무동작으로 빠진다
  const { data: closeData } = await supabase.rpc("squirtle_close_season");
  const closed = closeData as CloseResult | null;
  if (closed?.closed) {
    await postMessage({
      channel: config.channel_id,
      text: seasonEndMessage({
        stage: closed.stage as Stage,
        total: closed.total,
        top3: closed.top3,
        // 배열 리터럴은 그대로면 any[]가 되어 튜플 타입에 안 붙는다
        bonuses: [config.bonus_first, config.bonus_second, config.bonus_third] as [
          number,
          number,
          number,
        ],
      }),
    });
  }

  // 2) 활성 시즌 확보
  const { data: seasonId, error: seasonError } = await supabase.rpc("squirtle_open_season");
  if (seasonError || !seasonId) {
    return NextResponse.json({ error: "시즌을 열지 못했어요" }, { status: 500 });
  }

  // 3) 신규 가입자 슬랙 계정 연결
  const linked = await backfillSlackIds(supabase);

  // 4) 오늘의 메시지 — posted_on unique가 중복 실행을 막는다
  const posted = await postMessage({
    channel: config.channel_id,
    text: dailyMessage(config.emoji, pickMessageIndex()),
  });
  if (!posted.ok) {
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }

  const { error: insertError } = await supabase.from("squirtle_posts").insert({
    season_id: seasonId,
    posted_on: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
    message_ts: posted.ts,
  });
  if (insertError) {
    // 오늘 이미 게시됨 — 방금 올린 중복 메시지를 남기지 않는다
    return NextResponse.json({ posted: false, reason: "already_posted" });
  }

  // 5) 첫 리액션 장벽을 낮추려고 봇이 먼저 하나 달아둔다
  await addReaction({ channel: config.channel_id, ts: posted.ts, emoji: config.emoji });

  return NextResponse.json({ posted: true, linked, closed: closed?.closed ?? false });
}
```

> `toLocaleDateString("sv-SE", ...)`는 `YYYY-MM-DD` 형식을 준다. 스웨덴 로케일이 ISO 형식과 같아서 관용적으로 쓰인다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/squirtle-cron-route.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 전체 테스트와 빌드 확인**

Run: `npm run build && npm test`
Expected: 빌드 성공. `tests/accessibility-primitives.test.ts` 1개만 실패(기존 지뢰), 나머지 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/cron/squirtle-daily/route.ts tests/squirtle-cron-route.test.ts
git commit -m "⏰ 꼬북봇 일일 크론: 시즌 전환·계정 백필·메시지 게시"
```

---

### Task 8: 배포 체크리스트 문서

**Files:**
- Create: `docs/squirtle-bot-setup.md`

코드로 할 수 없는 수동 작업이 9단계라 문서로 남긴다. 순서를 어기면 이벤트가 오지 않는다.

- [ ] **Step 1: 문서 작성**

`docs/squirtle-bot-setup.md`:

````markdown
# 꼬북봇 배포 체크리스트

설계서: `docs/superpowers/specs/2026-07-23-squirtle-bot-design.md`

## 1. Slack 앱 생성

1. https://api.slack.com/apps → Create New App → From scratch
2. 앱 이름 `꼬북봇`, 워크스페이스 `gdscdaejinuniversity`

## 2. Bot Token Scopes

OAuth & Permissions → Scopes → Bot Token Scopes에 추가:

| 스코프 | 용도 |
|---|---|
| `chat:write` | 일일 메시지·스레드 답글 게시와 수정 |
| `reactions:read` | `reaction_added` 이벤트 수신 |
| `reactions:write` | 봇이 자기 메시지에 이모지 선점 |
| `users:read` | 신규 가입자 계정 백필 |
| `users:read.email` | 이메일 대조 |

## 3. 워크스페이스 설치

Install to Workspace → Bot User OAuth Token(`xoxb-`) 복사

## 4. 채널 초대 (빠뜨리면 이벤트가 오지 않음)

`#아무말대잔치`(C02BE2ERYCC)에서 `/invite @꼬북봇`

`#bot-꼬북봇`(C0BK8T33GHG)은 사용하지 않는다. 전용 채널은 "들어가야 볼 수 있음"이라는 장벽을 더한다.

## 5. 환경변수 (Vercel)

| 이름 | 값 |
|---|---|
| `SLACK_BOT_TOKEN` | 3단계의 `xoxb-` 토큰 |
| `SLACK_SIGNING_SECRET` | Basic Information → Signing Secret |
| `SLACK_BOT_USER_ID` | 아래 6단계에서 확인 |

`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`는 이미 있다.

## 6. 봇 User ID 확인

슬랙에서 꼬북봇 프로필 → 더보기 → Copy member ID (`U`로 시작). `SLACK_BOT_USER_ID`에 넣는다.

## 7. 마이그레이션 적용

```bash
supabase db push
```

중복 버전 때문에 막히면 `supabase migration list`로 원격 상태부터 확인한다.

## 8. Event Subscriptions

**7단계 배포가 끝난 뒤에 한다.** URL 검증이 실서버를 때린다.

1. Event Subscriptions → Enable Events
2. Request URL: `https://gdg-homepage.vercel.app/api/slack/events`
3. Verified 표시 확인 (실패하면 `SLACK_SIGNING_SECRET` 확인)
4. Subscribe to bot events → `reaction_added` 추가 → Save Changes

## 9. Supabase 스케줄

SQL Editor에서 실행한다. `pg_cron`·`pg_net` extension을 먼저 켠다(Database → Extensions).

```sql
-- CRON_SECRET을 Vault에 넣는다 (평문으로 두면 기존 크론 2개까지 함께 뚫린다)
select vault.create_secret('<CRON_SECRET 값>', 'cron_secret');

select cron.schedule(
  'squirtle-daily',
  '0 1 * * *',                              -- UTC 01:00 = KST 10:00
  $$ select net.http_post(
       url := 'https://gdg-homepage.vercel.app/api/cron/squirtle-daily',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                       where name = 'cron_secret'))
     ) $$
);
```

등록 확인:

```sql
select jobid, schedule, jobname from cron.job where jobname = 'squirtle-daily';
```

## 10. 동작 확인

크론을 기다리지 말고 직접 호출한다.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://gdg-homepage.vercel.app/api/cron/squirtle-daily
```

`{"posted":true,"linked":N,"closed":false}`가 나오고 `#아무말대잔치`에 메시지가 올라오면 성공이다.

이어서 수동 시나리오 4개를 확인한다.

1. 리액션 → 스레드에 이름이 뜨고 포인트 적립
2. 리액션을 뗐다 다시 달기 → 변화 없음
3. 어제 메시지에 리액션 → 무시됨
4. 임계값을 임시로 낮춰 진화 확인 후 원복

```sql
-- 4번 테스트용
update squirtle_config set stage2_threshold = 1, stage3_threshold = 2 where id = 1;
-- 확인 후 반드시 원복
update squirtle_config set stage2_threshold = 80, stage3_threshold = 200 where id = 1;
```

## 첫 주 이후 — 임계값 조정 (필수)

80/200은 참여율 40% 가정치다. 실측 후 반드시 조정한다.

```sql
select s.starts_on, s.stage, s.total_count,
       count(distinct c.user_id) as 참여자수,
       round(s.total_count::numeric / greatest(current_date - s.starts_on, 1), 1) as 하루평균
  from squirtle_seasons s
  left join squirtle_checkins c on c.season_id = s.id
  where s.status = 'active'
  group by s.id, s.starts_on, s.stage, s.total_count;
```

하루평균 × 시즌일수가 `stage3_threshold` 근처가 되도록 맞춘다.
````

- [ ] **Step 2: 커밋**

```bash
git add docs/squirtle-bot-setup.md
git commit -m "📋 꼬북봇 배포 체크리스트"
```

---

## 완료 기준

- [ ] `npm run build` 성공
- [ ] `npm test` — `tests/accessibility-primitives.test.ts` 1개만 실패(기존 지뢰), 나머지 전부 통과
- [ ] `docs/squirtle-bot-setup.md`의 10단계를 순서대로 완료
- [ ] 수동 시나리오 4개 확인
- [ ] 첫 주 실측 후 임계값 조정 일정 잡기
