# 면접 일정 시스템 Implementation Plan

> **For agentic workers (Codex 등):** 이 계획은 이 대화 맥락 없이 자립 실행 가능하도록 작성됨. 설계 근거는 [../specs/2026-07-19-interview-scheduling-design.md](../specs/2026-07-19-interview-scheduling-design.md) 참조. 각 Task는 독립적으로 테스트 가능한 산출물로 끝난다. 체크박스(`- [ ]`)로 진행 추적.

**Goal:** 서류 통과 지원자에게 이메일 매직링크로 면접 슬롯을 셀프 예약시키고, 예약 시 지원자별 Google Meet 링크를 자동생성해 저장한다.

**Architecture:** Supabase Postgres에 `interview_slots` 테이블 + RPC(원자적 슬롯 claim, 토큰 검증). 익명 지원자는 `/interview?token=` 공개 페이지에서 예약. 예약 성공 후 Next.js 서버 액션이 Google Meet REST API(`spaces.create`)를 호출해 링크 생성. 어드민은 `/admin/interviews`에서 슬롯 생성·링크 발송·면접관 배정.

**Tech Stack:** Next.js App Router (breaking changes 있음 — `node_modules/next/dist/docs/` 확인), TypeScript strict, Supabase(@supabase/ssr + @supabase/supabase-js), Resend(이메일), vitest(테스트, node env).

## Global Constraints

- Next.js 버전이 학습 데이터와 다름 — 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드 확인 (AGENTS.md).
- 응답·UI 문구는 **한국어**. 존댓말 톤은 기존 문구("~해요") 따름.
- 서버 전용 시크릿(`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MEET_*`, `RESEND_API_KEY`)은 **클라이언트 컴포넌트에서 import 금지**.
- DB 쓰기는 RLS 직접 열지 말고 **SECURITY DEFINER RPC**로. 어드민 RPC는 `is_admin()` 가드 + `log_audit(...)` 호출. `revoke execute ... from public, anon` 후 필요한 롤에만 `grant`.
- 커밋 메시지에 `Co-Authored-By` 트레일러 **금지**(이 워크트리 훅이 거부함). 이모지 prefix 컨벤션 사용(`feat:`, `📝` 등 기존 로그 스타일).
- **주의: 이 워크트리는 병행 세션과 공유될 수 있음.** 커밋은 항상 `git commit <명시 경로> -m ...` (pathspec)로 — bare `git commit`/`git add -A` 금지(다른 세션 스테이징을 쓸어담음).
- 현재 최신 마이그레이션: `0028_profile_avatars.sql`. 신규는 `0029`.
- 기존 `applications`: `id, applicant_id(nullable), season, answers jsonb, status('pending'|'accepted'|'rejected'|'waiting'), applicant_name, student_no, major, phone, email, position, review_note, reviewed_by, reviewed_at`. 지원은 **완전 익명**(applicant_id null).

---

## 파일 구조

**생성:**
- `supabase/migrations/0029_interview_scheduling.sql` — 테이블 + 토큰 컬럼 + RPC 전부
- `src/lib/google-meet.ts` — Meet API 모듈 (`createMeetSpace`)
- `tests/google-meet.test.ts` — Meet 모듈 단위 테스트(fetch mock)
- `src/actions/interview.ts` — 서버 액션(어드민 4종 + 지원자 예약)
- `src/app/interview/page.tsx` — 지원자 예약 페이지(공개)
- `src/app/interview/BookingForm.tsx` — 슬롯 선택 클라이언트 컴포넌트
- `src/app/admin/interviews/page.tsx` — 어드민 페이지
- `src/app/admin/interviews/SlotCreator.tsx` / `InviteSender.tsx` / `BookingList.tsx` — 어드민 서브 컴포넌트
- `scripts/get-google-meet-token.mjs` — refresh token 1회 획득 스크립트

**수정:**
- `.env.example` — `GOOGLE_MEET_CLIENT_ID/_CLIENT_SECRET/_REFRESH_TOKEN` 3개 추가
- `src/lib/schemas.ts` — 슬롯 생성 zod 스키마
- `src/lib/types.ts` — `InterviewSlot` 타입
- `src/lib/email.ts` — `sendInterviewInviteEmail`, `sendInterviewConfirmEmail`
- `src/app/admin/AdminSidebarNav.tsx` — "면접 일정" 항목 추가

**테스트 현실:** 이 리포엔 DB 통합 테스트 하네스가 없다(모든 `tests/*.test.ts`는 순수 TS 단위 테스트, node env). 따라서 **순수 로직(Meet 모듈, zod 스키마)은 vitest TDD**, **마이그레이션·RPC·서버액션·UI는 수동 검증**(로컬 supabase 적용 + 스모크 쿼리 / 브라우저)으로 간다. 없는 하네스를 지어내지 말 것(YAGNI).

---

## Task 1: DB 마이그레이션 (테이블 + 토큰 + RPC)

**Files:**
- Create: `supabase/migrations/0029_interview_scheduling.sql`

**Interfaces (Produces — 이후 Task가 호출):**
- RPC `admin_create_interview_slots(p_season text, p_starts_at timestamptz[], p_duration_min int) returns void`
- RPC `admin_assign_interviewer(p_slot uuid, p_interviewer uuid) returns void`
- RPC `admin_send_interview_invites(p_application_ids uuid[]) returns table(application_id uuid, token uuid, email text, applicant_name text)`
- RPC `admin_regenerate_meet_link` 는 불필요 — 링크 write는 서버액션이 service-role로 직접(아래 Task 5). 대신 슬롯 조회만.
- RPC `get_interview_context(p_token uuid) returns jsonb` — `{ application_id, applicant_name, season, booked_slot: {...}|null, open_slots: [...] }`
- RPC `book_interview_slot(p_token uuid, p_slot uuid) returns uuid` — claim된 slot id 반환. 실패 시 `INVALID_TOKEN`/`ALREADY_BOOKED`/`SLOT_TAKEN` raise.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0029_interview_scheduling.sql`:

```sql
-- 면접 일정 시스템: interview_slots + applications.interview_token + RPC

-- 1) 매직링크 토큰
alter table public.applications
  add column interview_token uuid unique;

-- 2) 슬롯 테이블 (슬롯=예약 통합)
create table public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  starts_at timestamptz not null,
  duration_min int not null default 30 check (duration_min > 0),
  application_id uuid references public.applications(id) on delete set null,
  interviewer_id uuid references public.profiles(id) on delete set null,
  meet_uri text,
  meet_code text,
  status text not null default 'open'
    check (status in ('open','booked','completed','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_slots_season_status on public.interview_slots (season, status);
create index interview_slots_application on public.interview_slots (application_id);
-- 한 지원자는 슬롯 하나만 예약
create unique index interview_slots_one_per_application
  on public.interview_slots (application_id) where application_id is not null;

alter table public.interview_slots enable row level security;
-- 공개 read 정책 없음 — 노출은 get_interview_context RPC로만. 쓰기도 RPC로만.

-- 3) 어드민: 슬롯 일괄 생성
create or replace function public.admin_create_interview_slots(
  p_season text, p_starts_at timestamptz[], p_duration_min int
) returns void language plpgsql security definer set search_path = public as $$
declare v_ts timestamptz;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_season = '' or coalesce(array_length(p_starts_at,1),0) = 0
     or p_duration_min <= 0 then
    raise exception 'INVALID_INPUT';
  end if;
  foreach v_ts in array p_starts_at loop
    insert into interview_slots (season, starts_at, duration_min)
    values (p_season, v_ts, p_duration_min);
  end loop;
  perform public.log_audit('create_interview_slots', 'interview',
    jsonb_build_object('season', p_season, 'count', array_length(p_starts_at,1)));
end $$;
revoke execute on function public.admin_create_interview_slots(text, timestamptz[], int) from public, anon;
grant execute on function public.admin_create_interview_slots(text, timestamptz[], int) to authenticated;

-- 4) 어드민: 면접관 배정
create or replace function public.admin_assign_interviewer(
  p_slot uuid, p_interviewer uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update interview_slots set interviewer_id = p_interviewer, updated_at = now()
    where id = p_slot;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('assign_interviewer', p_slot::text,
    jsonb_build_object('interviewer', p_interviewer));
end $$;
revoke execute on function public.admin_assign_interviewer(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_interviewer(uuid, uuid) to authenticated;

-- 5) 어드민: 면접 링크 토큰 발급 (선택 지원자에게, 없으면 생성)
create or replace function public.admin_send_interview_invites(
  p_application_ids uuid[]
) returns table(application_id uuid, token uuid, email text, applicant_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update applications a
    set interview_token = coalesce(a.interview_token, gen_random_uuid())
    where a.id = any(p_application_ids) and a.status = 'pending';
  perform public.log_audit('send_interview_invites', 'interview',
    jsonb_build_object('count', array_length(p_application_ids,1)));
  return query
    select a.id, a.interview_token, a.email, a.applicant_name
    from applications a
    where a.id = any(p_application_ids) and a.interview_token is not null;
end $$;
revoke execute on function public.admin_send_interview_invites(uuid[]) from public, anon;
grant execute on function public.admin_send_interview_invites(uuid[]) to authenticated;

-- 6) 지원자: 면접 컨텍스트 조회 (익명, 토큰 기반)
create or replace function public.get_interview_context(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_app applications%rowtype;
  v_booked jsonb;
  v_open jsonb;
begin
  select * into v_app from applications where interview_token = p_token;
  if v_app.id is null then raise exception 'INVALID_TOKEN'; end if;

  select to_jsonb(s) into v_booked
    from (select id, starts_at, duration_min, meet_uri
          from interview_slots where application_id = v_app.id) s;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at), '[]'::jsonb) into v_open
    from (select id, starts_at, duration_min
          from interview_slots
          where season = v_app.season and status = 'open') s;

  return jsonb_build_object(
    'application_id', v_app.id,
    'applicant_name', v_app.applicant_name,
    'season', v_app.season,
    'booked_slot', v_booked,
    'open_slots', v_open
  );
end $$;
revoke execute on function public.get_interview_context(uuid) from public;
grant execute on function public.get_interview_context(uuid) to anon, authenticated;

-- 7) 지원자: 슬롯 원자적 예약 (익명)
create or replace function public.book_interview_slot(p_token uuid, p_slot uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_application uuid;
  v_season text;
  v_booked uuid;
begin
  select id, season into v_application, v_season
    from applications where interview_token = p_token;
  if v_application is null then raise exception 'INVALID_TOKEN'; end if;
  if exists (select 1 from interview_slots where application_id = v_application) then
    raise exception 'ALREADY_BOOKED';
  end if;
  update interview_slots
    set application_id = v_application, status = 'booked', updated_at = now()
    where id = p_slot and status = 'open' and season = v_season
    returning id into v_booked;
  if v_booked is null then raise exception 'SLOT_TAKEN'; end if;
  return v_booked;
end $$;
revoke execute on function public.book_interview_slot(uuid, uuid) from public;
grant execute on function public.book_interview_slot(uuid, uuid) to anon, authenticated;
```

- [ ] **Step 2: 로컬 적용 + 스모크 검증**

Run(로컬 supabase 기준):
```bash
supabase db reset   # 또는 supabase migration up
```
Expected: 에러 없이 적용. 이후 psql/Studio에서 수동 확인:
- `select * from interview_slots;` — 테이블 존재, 빈 결과.
- `\df admin_create_interview_slots` 등 RPC 6종 존재.
- 어드민 세션으로 `select admin_create_interview_slots('2026-2', array[now()+interval '1 day']::timestamptz[], 30);` → 슬롯 1행.
- 비-어드민으로 같은 호출 → `FORBIDDEN`.

- [ ] **Step 3: 커밋**

```bash
git commit supabase/migrations/0029_interview_scheduling.sql -m "feat: 면접 일정 슬롯 테이블·RPC 추가"
```

---

## Task 2: Google Meet API 모듈

**Files:**
- Create: `src/lib/google-meet.ts`
- Test: `tests/google-meet.test.ts`
- Modify: `.env.example`

**Interfaces (Produces):**
- `createMeetSpace(): Promise<{ meetingUri: string; meetingCode: string; name: string }>` — env 미설정 시 `throw new Error("GOOGLE_MEET_ENV_MISSING")`.

**참고:** 외부 HTTP + fetch mock 테스트 패턴은 기존 `tests/geocode.test.ts` 스타일을 따른다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/google-meet.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMeetSpace } from "@/lib/google-meet";

describe("createMeetSpace", () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = {
      ...OLD,
      GOOGLE_MEET_CLIENT_ID: "cid",
      GOOGLE_MEET_CLIENT_SECRET: "secret",
      GOOGLE_MEET_REFRESH_TOKEN: "rtoken",
    };
  });
  afterEach(() => {
    process.env = OLD;
    vi.restoreAllMocks();
  });

  it("refresh token으로 access token 교환 후 space 생성", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "atoken" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "spaces/abc",
            meetingUri: "https://meet.google.com/xyz-abcd-efg",
            meetingCode: "xyz-abcd-efg",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await createMeetSpace();
    expect(res.meetingUri).toBe("https://meet.google.com/xyz-abcd-efg");
    expect(res.meetingCode).toBe("xyz-abcd-efg");
    // 1st call = token endpoint, 2nd = spaces endpoint w/ Bearer atoken
    expect(fetchMock.mock.calls[0][0]).toContain("oauth2.googleapis.com/token");
    expect(fetchMock.mock.calls[1][0]).toContain("meet.googleapis.com/v2/spaces");
    const authHeader = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(authHeader.Authorization).toBe("Bearer atoken");
  });

  it("env 없으면 throw", async () => {
    delete process.env.GOOGLE_MEET_REFRESH_TOKEN;
    await expect(createMeetSpace()).rejects.toThrow("GOOGLE_MEET_ENV_MISSING");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/google-meet.test.ts`
Expected: FAIL — `createMeetSpace` 모듈 없음.

- [ ] **Step 3: 모듈 구현**

`src/lib/google-meet.ts`:
```ts
// 서버 전용: GOOGLE_MEET_* 는 서버 시크릿. 클라이언트에서 import 금지.
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_MEET_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GOOGLE_MEET_ENV_MISSING");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("GOOGLE_MEET_TOKEN_FAILED");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("GOOGLE_MEET_TOKEN_FAILED");
  return json.access_token;
}

export async function createMeetSpace(): Promise<{
  meetingUri: string;
  meetingCode: string;
  name: string;
}> {
  const accessToken = await getAccessToken();
  const res = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("GOOGLE_MEET_SPACE_FAILED");
  const json = (await res.json()) as {
    name?: string;
    meetingUri?: string;
    meetingCode?: string;
  };
  if (!json.meetingUri || !json.meetingCode || !json.name) {
    throw new Error("GOOGLE_MEET_SPACE_FAILED");
  }
  return { meetingUri: json.meetingUri, meetingCode: json.meetingCode, name: json.name };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/google-meet.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: .env.example 추가**

`.env.example` 끝에 추가:
```
# Google Meet 링크 자동생성 (서버 전용 — 별도 GCP 프로젝트, meetings.space.created 스코프)
# refresh token은 scripts/get-google-meet-token.mjs 로 1회 획득
GOOGLE_MEET_CLIENT_ID=
GOOGLE_MEET_CLIENT_SECRET=
GOOGLE_MEET_REFRESH_TOKEN=
```

- [ ] **Step 6: 커밋**

```bash
git commit src/lib/google-meet.ts tests/google-meet.test.ts .env.example -m "feat: Google Meet 링크 생성 모듈 추가"
```

---

## Task 3: 슬롯 생성 스키마 + 타입

**Files:**
- Modify: `src/lib/schemas.ts`, `src/lib/types.ts`
- Test: `tests/schemas.test.ts` (기존 파일에 케이스 추가)

**Interfaces (Produces):**
- `interviewSlotsSchema` (zod) — `{ starts_at: string[]; duration_min: number }` 검증. 빈 배열·과거시각·잘못된 duration 거부.
- 타입 `InterviewSlot` — DB 행 형태.

- [ ] **Step 1: 실패 테스트 추가**

`tests/schemas.test.ts` 에 추가:
```ts
import { interviewSlotsSchema } from "@/lib/schemas";

describe("interviewSlotsSchema", () => {
  it("유효한 슬롯 입력 통과", () => {
    const r = interviewSlotsSchema.safeParse({
      starts_at: ["2026-09-05T14:00:00+09:00"],
      duration_min: 30,
    });
    expect(r.success).toBe(true);
  });
  it("빈 배열 거부", () => {
    const r = interviewSlotsSchema.safeParse({ starts_at: [], duration_min: 30 });
    expect(r.success).toBe(false);
  });
  it("duration 0 이하 거부", () => {
    const r = interviewSlotsSchema.safeParse({
      starts_at: ["2026-09-05T14:00:00+09:00"],
      duration_min: 0,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — `interviewSlotsSchema` export 없음.

- [ ] **Step 3: 스키마·타입 구현**

`src/lib/schemas.ts` 에 추가(기존 zod import 재사용):
```ts
export const interviewSlotsSchema = z.object({
  starts_at: z
    .array(z.string().refine((s) => !Number.isNaN(Date.parse(s)), "날짜 형식이 올바르지 않아요"))
    .min(1, "슬롯을 하나 이상 추가해주세요"),
  duration_min: z.number().int().positive("소요 시간이 올바르지 않아요"),
});
```

`src/lib/types.ts` 에 추가:
```ts
export type InterviewSlot = {
  id: string;
  season: string;
  starts_at: string;
  duration_min: number;
  application_id: string | null;
  interviewer_id: string | null;
  meet_uri: string | null;
  meet_code: string | null;
  status: "open" | "booked" | "completed" | "canceled";
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git commit src/lib/schemas.ts src/lib/types.ts tests/schemas.test.ts -m "feat: 면접 슬롯 스키마·타입 추가"
```

---

## Task 4: 이메일 헬퍼 (초대 + 확정)

**Files:**
- Modify: `src/lib/email.ts`

**Interfaces (Produces):**
- `sendInterviewInviteEmail(params: { to: string; name: string; season: string; bookingUrl: string }): Promise<{ sent: boolean; skipped?: boolean; error?: string }>`
- `sendInterviewConfirmEmail(params: { to: string; name: string; startsAt: string; meetUri: string }): Promise<{ sent: boolean; skipped?: boolean; error?: string }>`

기존 `sendResultEmail`의 Resend fetch 패턴(`RESEND_API_KEY` 없으면 `{ sent:false, skipped:true }`, `escapeHtml`, `AbortSignal.timeout(5000)`)을 그대로 재사용한다.

- [ ] **Step 1: 함수 추가**

`src/lib/email.ts` 에 추가(기존 `escapeHtml` 재사용). 공통 발송 로직은 내부 헬퍼로 DRY하게:
```ts
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skipped: true };
  const from = process.env.RESEND_FROM ?? "GDG DJU <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { sent: false, error: "이메일 전송에 실패했어요" };
    return { sent: true };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError")
      return { sent: false, error: "이메일 응답이 시간 초과됐어요" };
    return { sent: false, error: "이메일 전송에 실패했어요" };
  }
}

export async function sendInterviewInviteEmail(params: {
  to: string; name: string; season: string; bookingUrl: string;
}) {
  const html = `<div style="font-family:sans-serif;line-height:1.6;">
    <p>${escapeHtml(params.name)}님, GDG DJU ${escapeHtml(params.season)} 서류 전형에 통과하셨어요. 축하드려요!</p>
    <p>아래 링크에서 면접 시간을 선택해주세요.</p>
    <p><a href="${params.bookingUrl}">면접 시간 예약하기</a></p>
  </div>`;
  return sendEmail(params.to, `[GDG DJU] ${params.season} 면접 일정 예약 안내`, html);
}

export async function sendInterviewConfirmEmail(params: {
  to: string; name: string; startsAt: string; meetUri: string;
}) {
  const when = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "full", timeStyle: "short",
  }).format(new Date(params.startsAt));
  const html = `<div style="font-family:sans-serif;line-height:1.6;">
    <p>${escapeHtml(params.name)}님, 면접 예약이 확정됐어요.</p>
    <p><b>일시:</b> ${escapeHtml(when)} (KST)</p>
    <p><b>Google Meet:</b> <a href="${params.meetUri}">${escapeHtml(params.meetUri)}</a></p>
  </div>`;
  return sendEmail(params.to, "[GDG DJU] 면접 예약이 확정됐어요", html);
}
```

> 참고: 기존 `sendResultEmail`도 이 `sendEmail` 헬퍼로 리팩터할 수 있으나 **범위 밖**(건드리지 말 것 — surgical).

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git commit src/lib/email.ts -m "feat: 면접 초대·확정 이메일 헬퍼 추가"
```

---

## Task 5: 서버 액션

**Files:**
- Create: `src/actions/interview.ts`

**Interfaces:**
- Consumes: Task1 RPC들, Task2 `createMeetSpace`, Task3 `interviewSlotsSchema`, Task4 이메일 헬퍼.
- Produces (UI가 호출):
  - `createSlots(formData: FormData): Promise<ActionResult>` — 어드민, `interviewSlotsSchema` 검증 → `admin_create_interview_slots` RPC.
  - `assignInterviewer(slotId: string, interviewerId: string): Promise<ActionResult>` — 어드민.
  - `sendInvites(applicationIds: string[]): Promise<ActionResult>` — 어드민, RPC로 토큰 발급 → 각 행에 `sendInterviewInviteEmail`.
  - `bookSlot(token: string, slotId: string): Promise<ActionResult & { meetUri?: string }>` — 익명. RPC `book_interview_slot` → service-role 클라이언트로 Meet 링크 생성·저장 → 확정 이메일.
  - `regenerateMeetLink(slotId: string): Promise<ActionResult>` — 어드민, meet_uri null 슬롯 재생성.

`ActionResult` 타입과 `requireAdmin`(`@/lib/auth`), `toKoreanError`(`@/lib/errors`), `createClient`(`@/lib/supabase/server`)는 기존 `src/actions/application.ts` 참고.

**service-role 클라이언트:** Meet 링크 write는 RLS 우회가 필요하므로 크론 라우트(`src/app/api/cron/attendance-warning/route.ts`)와 동일하게 `@supabase/supabase-js`의 `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`로 생성. 이 액션은 서버에서만 실행되므로 안전.

- [ ] **Step 1: 액션 파일 작성**

`src/actions/interview.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { interviewSlotsSchema } from "@/lib/schemas";
import { createMeetSpace } from "@/lib/google-meet";
import { sendInterviewInviteEmail, sendInterviewConfirmEmail } from "@/lib/email";
import { getRecruitingSettings } from "@/lib/recruiting";
import type { ActionResult } from "@/lib/types";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const BOOK_ERRORS: Record<string, string> = {
  INVALID_TOKEN: "유효하지 않은 링크예요",
  ALREADY_BOOKED: "이미 예약한 면접이 있어요",
  SLOT_TAKEN: "방금 마감된 시간이에요. 다른 시간을 선택해주세요",
};

export async function createSlots(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const settings = await getRecruitingSettings();
  const parsed = interviewSlotsSchema.safeParse({
    starts_at: formData.getAll("starts_at").map(String),
    duration_min: Number(formData.get("duration_min") ?? 30),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_interview_slots", {
    p_season: settings.season,
    p_starts_at: parsed.data.starts_at,
    p_duration_min: parsed.data.duration_min,
  });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/interviews");
  return { ok: true };
}

export async function assignInterviewer(slotId: string, interviewerId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_interviewer", {
    p_slot: slotId, p_interviewer: interviewerId,
  });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/interviews");
  return { ok: true };
}

export async function sendInvites(applicationIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (applicationIds.length === 0) return { error: "지원자를 선택해주세요" };
  const settings = await getRecruitingSettings();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_send_interview_invites", {
    p_application_ids: applicationIds,
  });
  if (error) return { error: toKoreanError(error) };
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const rows = (data ?? []) as { token: string; email: string; applicant_name: string }[];
  await Promise.all(
    rows
      .filter((r) => r.email)
      .map((r) =>
        sendInterviewInviteEmail({
          to: r.email, name: r.applicant_name, season: settings.season,
          bookingUrl: `${origin}/interview?token=${r.token}`,
        }),
      ),
  );
  revalidatePath("/admin/interviews");
  return { ok: true };
}

export async function bookSlot(
  token: string, slotId: string,
): Promise<ActionResult & { meetUri?: string }> {
  const supabase = await createClient();
  const { data: bookedId, error } = await supabase.rpc("book_interview_slot", {
    p_token: token, p_slot: slotId,
  });
  if (error) {
    const code = String(error.message ?? "");
    const key = Object.keys(BOOK_ERRORS).find((k) => code.includes(k));
    return { error: key ? BOOK_ERRORS[key] : toKoreanError(error) };
  }

  // 슬롯 claim 성공 → Meet 링크 생성 (실패해도 예약 유지)
  const svc = serviceClient();
  try {
    const space = await createMeetSpace();
    await svc.from("interview_slots").update({
      meet_uri: space.meetingUri, meet_code: space.meetingCode,
    }).eq("id", bookedId);

    // 확정 이메일 (이메일 대상 조회)
    const { data: slot } = await svc
      .from("interview_slots")
      .select("starts_at, application_id")
      .eq("id", bookedId).single();
    if (slot?.application_id) {
      const { data: app } = await svc
        .from("applications")
        .select("email, applicant_name")
        .eq("id", slot.application_id).single();
      if (app?.email) {
        await sendInterviewConfirmEmail({
          to: app.email, name: app.applicant_name,
          startsAt: slot.starts_at, meetUri: space.meetingUri,
        });
      }
    }
    return { ok: true, meetUri: space.meetingUri };
  } catch {
    // Meet 생성 실패 — 예약은 유지, 링크는 어드민이 재생성
    return { ok: true };
  }
}

export async function regenerateMeetLink(slotId: string): Promise<ActionResult> {
  await requireAdmin();
  const svc = serviceClient();
  try {
    const space = await createMeetSpace();
    await svc.from("interview_slots").update({
      meet_uri: space.meetingUri, meet_code: space.meetingCode,
    }).eq("id", slotId);
    revalidatePath("/admin/interviews");
    return { ok: true };
  } catch {
    return { error: "Meet 링크 생성에 실패했어요. 잠시 후 다시 시도해주세요" };
  }
}
```

> `ActionResult`에 `ok?: true`/`error?: string` 형태가 기존과 다르면 기존 정의에 맞춰 조정. `NEXT_PUBLIC_SITE_URL` 미존재 시 `.env.example`에 추가하거나 요청 origin 사용.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`ActionResult` 형태·`toKoreanError` 시그니처를 기존 파일과 대조해 맞출 것)

- [ ] **Step 3: 커밋**

```bash
git commit src/actions/interview.ts -m "feat: 면접 예약·슬롯 서버 액션 추가"
```

---

## Task 6: 지원자 예약 페이지 `/interview`

**Files:**
- Create: `src/app/interview/page.tsx`, `src/app/interview/BookingForm.tsx`

**Interfaces:**
- Consumes: `get_interview_context` RPC(익명), Task5 `bookSlot`.

- [ ] **Step 1: 서버 페이지 작성**

`src/app/interview/page.tsx` — `searchParams`의 `token`으로 `get_interview_context` RPC 호출(익명 `createClient`), 결과에 따라 분기:
- 토큰 없음/`INVALID_TOKEN` → "유효하지 않은 링크예요" 안내.
- `booked_slot` 있음 → 예약 확정 화면(시간 + Meet 링크).
- 아니면 `<BookingForm token=... openSlots=... />` 렌더.

App Router 규약(`searchParams`가 Promise일 수 있음 — 이 Next 버전 가이드 `node_modules/next/dist/docs/` 확인). 페이지는 공개(로그인 불필요) — 미들웨어/`proxy.ts`에서 `/interview`가 인증 리다이렉트에 안 걸리는지 확인하고, 걸리면 공개 경로로 예외 추가.

- [ ] **Step 2: 예약 폼 클라이언트 컴포넌트**

`src/app/interview/BookingForm.tsx` — `"use client"`. 빈 슬롯을 라디오/버튼 리스트로, 시각은 `Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul"})` 포맷. 선택 후 "예약하기" → `bookSlot(token, slotId)` 호출. 결과:
- `error` → 인라인 에러(특히 `SLOT_TAKEN`이면 목록 새로고침 안내).
- 성공 → 확정 메시지 + `meetUri` 표시.

기존 폼 컴포넌트(`src/app/apply/ApplyForm.tsx`)의 `useState`/pending/에러 표시 패턴을 미러링.

- [ ] **Step 3: 브라우저 검증**

로컬 dev 서버 기동 후:
- DB에 `pending` 지원서 1건 + `admin_send_interview_invites`로 토큰 발급 → `/interview?token=<uuid>` 접속.
- 빈 슬롯 몇 개 생성해두고 하나 예약 → (Meet env 세팅돼 있으면) Meet 링크 표시, 없으면 예약만 확정.
- 같은 토큰 재접속 → 예약 확정 화면.
- 잘못된 토큰 → 에러 안내.

- [ ] **Step 4: 커밋**

```bash
git commit src/app/interview/page.tsx src/app/interview/BookingForm.tsx -m "feat: 지원자 면접 예약 페이지 추가"
```

---

## Task 7: 어드민 페이지 `/admin/interviews`

**Files:**
- Create: `src/app/admin/interviews/page.tsx`, `.../SlotCreator.tsx`, `.../InviteSender.tsx`, `.../BookingList.tsx`
- Modify: `src/app/admin/AdminSidebarNav.tsx`

**Interfaces:**
- Consumes: Task5 액션 전부. 데이터 조회는 어드민 `createClient`(RLS는 어드민이면 슬롯 read 가능해야 함 — Task1에서 read 정책 없이 뒀으므로, **어드민 조회용으로 슬롯/지원자 데이터를 페이지 서버 컴포넌트에서 service-role 또는 admin RPC로 로드**. 간단히 `interview_slots`에 어드민 read 정책을 0029에 추가하는 것도 방법 — 아래 노트 참조).

> **Task1 보완 결정:** 어드민 페이지가 슬롯 목록을 읽어야 하므로, `0029` 마이그레이션에 어드민 read 정책을 추가한다:
> ```sql
> create policy "interview_slots: admin read" on public.interview_slots
>   for select using (public.is_admin());
> ```
> (Task1 Step1에 이 정책을 포함시킬 것. get_interview_context는 SECURITY DEFINER라 익명 조회엔 영향 없음.)

- [ ] **Step 1: 서버 페이지 + 데이터 로드**

`src/app/admin/interviews/page.tsx` — `requireAdmin()` 후:
- 현재 시즌의 `interview_slots` 전체 로드(open/booked).
- `pending` 지원서 목록 로드(초대 발송 대상).
- `member`/`admin` 프로필 목록 로드(면접관 배정 드롭다운).
- 세 서브 컴포넌트에 props 전달.

기존 어드민 페이지(`src/app/admin/applications/page.tsx` 또는 `src/app/admin/page.tsx`)의 레이아웃·데이터 로드 패턴 미러링.

- [ ] **Step 2: SlotCreator** — `"use client"`. `datetime-local` 인풋을 동적으로 추가/삭제, `duration_min` 입력, 제출 시 `createSlots(formData)`. 각 인풋 name=`starts_at`.

- [ ] **Step 3: InviteSender** — `"use client"`. pending 지원자 체크박스 다중선택 → `sendInvites(selectedIds)`. 성공 토스트/메시지.

- [ ] **Step 4: BookingList** — booked 슬롯 리스트: 지원자명(→`/admin/applications` 링크) · 시각 · 면접관 배정 `<select>`(변경 시 `assignInterviewer`) · Meet 링크(있으면 링크, 없으면 "재생성" 버튼→`regenerateMeetLink`) · 상태 뱃지.

- [ ] **Step 5: 사이드바 항목 추가**

`src/app/admin/AdminSidebarNav.tsx` — 기존 항목 배열에 `{ href: "/admin/interviews", label: "면접 일정" }` 추가(기존 구조에 맞춰). 아이콘 쓰는 구조면 적절한 아이콘 지정.

- [ ] **Step 6: 브라우저 검증**

어드민 로그인 → `/admin/interviews`:
- 슬롯 3개 생성 → 목록에 open 표시.
- pending 지원자 선택 → 링크 발송(RESEND 미설정이면 skip이지만 토큰은 생성됨 — DB `interview_token` 확인).
- Task6에서 예약한 건이 BookingList에 booked로 표시 → 면접관 배정 → 반영 확인.
- Meet 링크 null인 건에 "재생성" 동작 확인(env 세팅 시).

- [ ] **Step 7: 커밋**

```bash
git commit src/app/admin/interviews/ src/app/admin/AdminSidebarNav.tsx -m "feat: 어드민 면접 일정 관리 페이지 추가"
```

---

## Task 8: refresh token 획득 스크립트 + 선행 세팅 문서화

**Files:**
- Create: `scripts/get-google-meet-token.mjs`

이 Task는 **코드 배포 전 1회성 세팅**을 돕는다. Google Cloud 콘솔 작업(동의화면 Production, OAuth 클라이언트 생성)은 사람이 해야 하며, 그 후 이 스크립트로 refresh token을 얻는다.

- [ ] **Step 1: 토큰 획득 스크립트 작성**

`scripts/get-google-meet-token.mjs` — 로컬에서 `node scripts/get-google-meet-token.mjs` 실행 시:
1. `GOOGLE_MEET_CLIENT_ID`/`_CLIENT_SECRET` 를 env나 인자로 받음.
2. `https://accounts.google.com/o/oauth2/v2/auth?...&scope=https://www.googleapis.com/auth/meetings.space.created&access_type=offline&prompt=consent&redirect_uri=http://localhost:53682&response_type=code` URL을 출력/오픈.
3. 로컬 `http://localhost:53682`에 임시 HTTP 서버를 띄워 `code` 콜백 수신.
4. code를 `https://oauth2.googleapis.com/token`에 교환 → **refresh_token 출력**.
5. 사용자가 그 값을 `.env`의 `GOOGLE_MEET_REFRESH_TOKEN`에 저장.

표준 라이브러리(`node:http`, `fetch`)만 사용, 의존성 추가 없음. OAuth 클라이언트는 "데스크톱 앱" 또는 redirect_uri `http://localhost:53682` 등록된 "웹" 타입.

- [ ] **Step 2: 수동 실행 검증**

Google 콘솔 선행 세팅(동의화면 Production + `meetings.space.created` 스코프 + OAuth 클라이언트) 완료 후 스크립트 실행 → 브라우저 승인(미확인 앱 경고는 "고급→이동") → refresh_token 획득 → `.env` 저장 → `npx vitest run tests/google-meet.test.ts`는 이미 통과하므로, 실제 `createMeetSpace()` 스모크는 Task6/7 예약 흐름에서 링크가 실제 생성되는지로 확인.

- [ ] **Step 3: 커밋**

```bash
git commit scripts/get-google-meet-token.mjs -m "feat: Google Meet refresh token 획득 스크립트 추가"
```

---

## 최종 통합 검증 (E2E 스모크)

모든 Task 후, 실제 흐름 1회 완주:
1. 어드민: 슬롯 생성 → pending 지원자에게 링크 발송.
2. 지원자(매직링크): 슬롯 예약 → Meet 링크 자동생성 확인 → 확정 이메일 수신.
3. 어드민: 예약 현황에서 면접관 배정 확인.
4. `interview_slots` 행에 `meet_uri`/`meet_code` 채워졌는지 DB 확인(후속 녹음 시스템 매칭 키).

## 범위 밖 (구현하지 말 것)
- 면접 녹음·요약 자동 적재 (후속 spec — `meet_code`가 매칭 키).
- 모집 단계별 날짜 기간 관리.
- Google Calendar 이벤트/알림 생성.
- 기존 `sendResultEmail` 리팩터(surgical 유지).
