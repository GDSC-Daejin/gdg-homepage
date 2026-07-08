# GDG DJU 관리 시스템 MVP 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GDG DJU 동아리의 회원·지원서·이벤트·출석을 관리하는 웹앱 (운영진 어드민 + 회원 화면), 완전 무료 배포(Vercel + Supabase).

**Architecture:** Next.js App Router 풀스택. 읽기는 Server Component, 쓰기는 Server Action에서 role 검사 후 처리. 정원/대기열/출석 검증 같은 원자성 필요한 로직은 Postgres function(security definer)으로. RLS는 2차 방어선.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · Tailwind CSS v4 · Supabase (@supabase/ssr) · zod · Vitest · pnpm

**Design:** AXHub-v2 디자인 시스템(DesignSync projectId `6dda173b-49f8-488f-b63f-12dfa542f7cc`)의 토큰을 Tailwind v4 `@theme`으로 이식. 토큰 값은 Task 1에 인라인되어 있음.

## Global Constraints

- 유료 서비스·유료 티어 절대 금지. Vercel Hobby + Supabase Free만 사용.
- 모든 사용자 대면 문구는 한국어.
- 클라이언트에서 supabase-js로 DB 직접 쓰기 금지 — 쓰기는 전부 Server Action 경유.
- `attendance_code`는 회원에게 절대 노출 금지 (별도 `event_codes` 테이블, admin RLS only).
- 권한 검사는 모든 Server Action 첫 줄에서 수행 (`requireProfile` / `requireAdmin`).
- 폼 입력은 zod로 검증. DB 에러 코드는 한국어 메시지로 매핑해 반환.
- 주석 최소화, TS strict 통과 필수, `pnpm build` 성공이 각 태스크의 최종 게이트.
- 서브에이전트 모델: 코드 작성 태스크는 **Sonnet** (`model: "sonnet"`), 설계 검토/코드 리뷰는 **Opus** (`model: "opus"`, 사용자 명시 지시).

## 라우트 맵

```
/                      회원 홈 = 이벤트 목록 (로그인 필요)
/login                 Google 로그인
/auth/callback         OAuth 콜백 (route handler)
/onboarding            첫 로그인 프로필 입력
/profile               내 프로필 조회/편집
/events/[id]           이벤트 상세 + 신청/취소
/attend                출석 코드 입력
/apply                 지원서 작성/제출 + 결과 확인 (applicant)
/admin                 대시보드
/admin/members         회원 목록 (+ /admin/members/[id] 상세)
/admin/applications    지원서 심사
/admin/events          이벤트 목록 (+ new, [id] 관리)
/admin/attendance      회원별 출석률
```

## 파일 구조 (전체)

```
src/
  middleware.ts                     세션 리프레시
  app/
    layout.tsx  globals.css         루트 레이아웃 + 디자인 토큰
    (member)/                       회원 셸 (상단 네비)
      page.tsx  profile/  events/[id]/  attend/  apply/  onboarding/
    login/page.tsx
    auth/callback/route.ts
    admin/
      layout.tsx                    requireAdmin + AdminShell(사이드바)
      page.tsx  members/  applications/  events/  attendance/
  lib/
    supabase/server.ts  client.ts   Supabase 클라이언트 팩토리
    auth.ts                         getProfile / requireProfile / requireAdmin
    types.ts                        도메인 타입
    errors.ts                       DB 에러코드 → 한국어 매핑
    schemas.ts                      zod 스키마 (프로필/이벤트/지원서/출석코드)
  components/                       Button, Input, Select, Badge, Card, StatCard, EmptyState 등
  actions/
    profile.ts  application.ts  event.ts  registration.ts  attendance.ts  member.ts
supabase/
  migrations/0001_init.sql
  seed.sql
tests/schemas.test.ts
```

---

### Task 1: 스캐폴드 + 디자인 토큰 + UI 컴포넌트

**Files:**
- Create: Next.js 15 스캐폴드 전체, `src/app/globals.css`, `src/components/{Button,Input,Select,Badge,Card,StatCard,EmptyState,PageHeader}.tsx`
- Test: `pnpm build` 통과

**Interfaces:**
- Produces: Tailwind 토큰 클래스(아래 `@theme`), 컴포넌트 props — `Button({variant: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md', ...ButtonHTMLAttributes})`, `Badge({tone: 'primary'|'success'|'warning'|'danger'|'neutral', children})`, `Card`, `StatCard({label, value, hint?})`, `Input/Select`(label, error 지원), `EmptyState({title, description?})`, `PageHeader({title, description?, action?})`

- [ ] **Step 1: 스캐폴드**

```bash
pnpm create next-app@latest . --ts --tailwind --app --src-dir --no-eslint --import-alias "@/*" --turbopack
pnpm add @supabase/ssr @supabase/supabase-js zod
pnpm add -D vitest
```

- [ ] **Step 2: `globals.css`에 AXHub-v2 토큰 이식 (Tailwind v4 `@theme`)**

```css
@import "tailwindcss";

@theme {
  --color-primary: #2d64fa;
  --color-primary-bright: #5985fb;
  --color-primary-hover: #1f54d6;
  --color-primary-soft: #eaf0fe;
  --color-primary-soft-hover: #d6e2fd;
  --color-gray-50: #f6f7f9; --color-gray-100: #eff1f4; --color-gray-200: #e4e5e8;
  --color-gray-300: #d1d3d8; --color-gray-400: #9ca0ab; --color-gray-500: #6d717e;
  --color-gray-600: #4f535d; --color-gray-700: #3c3f47; --color-gray-800: #25272d;
  --color-gray-900: #16171b;
  --color-success: #1aa463; --color-success-soft: #e4f6ed;
  --color-warning: #f5a623; --color-warning-soft: #fdf1dc;
  --color-danger: #e5484d;  --color-danger-soft: #fce8e9;
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, system-ui,
    "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
  --shadow-card: 0 1px 3px rgba(22,23,27,0.06), 0 6px 16px rgba(22,23,27,0.05);
}
```

Pretendard는 CDN 대신 `pnpm add pretendard` 후 `@import "pretendard/dist/web/variable/pretendardvariable.css";` (무료, 셀프호스팅).

- [ ] **Step 3: 공용 컴포넌트 작성** — 위 Interfaces의 props대로. 토큰 클래스만 사용(임의 hex 금지). 버튼 기본: `rounded-lg bg-primary text-white hover:bg-primary-hover h-10 px-4 text-sm font-semibold`.
- [ ] **Step 4: `pnpm build` 통과 확인 후 커밋** — `feat: 스캐폴드 + 디자인 토큰 + 공용 UI`

---

### Task 2: DB 마이그레이션 (스키마 + RLS + 함수)

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `supabase/config.toml`(`supabase init`)

**Interfaces:**
- Produces: 아래 스키마 전체, RPC — `register_for_event(p_event_id uuid) returns text`('confirmed'|'waitlisted'), `cancel_registration(p_event_id uuid)`, `check_attendance(p_event_id uuid, p_code text)`, `admin_set_role(p_user uuid, p_role text)`, `admin_set_status(p_user uuid, p_status text)`, `admin_review_application(p_application uuid, p_status text)`, `admin_set_event_code(p_event_id uuid) returns text`, `is_admin() returns boolean`. 실패는 `raise exception using errcode='P0001', message='<에러코드>'` — 에러코드: `NOT_MEMBER`, `ALREADY_REGISTERED`, `NOT_REGISTERED`, `INVALID_CODE`, `ALREADY_CHECKED`, `EVENT_NOT_FOUND`, `NO_CODE_ISSUED`.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 테이블
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  student_no text not null default '',
  major text not null default '',
  phone text not null default '',
  interests text[] not null default '{}',
  role text not null default 'applicant' check (role in ('admin','member','applicant')),
  status text not null default 'active' check (status in ('active','dormant','withdrawn')),
  joined_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  season text not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (applicant_id, season)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('session','study','devfest')),
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  location text not null default '',
  speaker text not null default '',
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 출석 코드는 회원에게 숨겨야 하므로 별도 테이블 (admin RLS only)
create table public.event_codes (
  event_id uuid primary key references public.events(id) on delete cascade,
  code text not null,
  updated_at timestamptz not null default now()
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('confirmed','waitlisted')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS: 전 테이블 enable
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.events enable row level security;
alter table public.event_codes enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendances enable row level security;

create policy "profiles: self read"  on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- role/status는 컬럼 권한으로 봉인: 본인이어도 못 바꿈 (admin은 RPC 경유)
revoke update on public.profiles from authenticated;
grant update (name, student_no, major, phone, interests) on public.profiles to authenticated;

create policy "applications: own"        on public.applications for select using (applicant_id = auth.uid() or public.is_admin());
create policy "applications: own insert" on public.applications for insert with check (applicant_id = auth.uid());

create policy "events: read all"   on public.events for select using (auth.uid() is not null);
create policy "events: admin all"  on public.events for all using (public.is_admin()) with check (public.is_admin());

create policy "event_codes: admin only" on public.event_codes for all using (public.is_admin()) with check (public.is_admin());

create policy "registrations: own or admin" on public.event_registrations for select using (user_id = auth.uid() or public.is_admin());
create policy "attendances: own or admin"   on public.attendances for select using (user_id = auth.uid() or public.is_admin());
-- registrations/attendances 쓰기는 아래 security definer 함수로만 수행

-- 이벤트 신청 (정원 경합 원자 처리)
create or replace function public.register_for_event(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_confirmed int;
  v_status text;
  v_role text;
begin
  select role into v_role from profiles where id = auth.uid() and status = 'active';
  if v_role is null or v_role = 'applicant' then raise exception 'NOT_MEMBER'; end if;
  select capacity into v_capacity from events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if exists (select 1 from event_registrations where event_id = p_event_id and user_id = auth.uid()) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  select count(*) into v_confirmed from event_registrations where event_id = p_event_id and status = 'confirmed';
  v_status := case when v_capacity is null or v_confirmed < v_capacity then 'confirmed' else 'waitlisted' end;
  insert into event_registrations (event_id, user_id, status) values (p_event_id, auth.uid(), v_status);
  return v_status;
end $$;

-- 신청 취소 + 대기열 자동 승격
create or replace function public.cancel_registration(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was text;
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
    );
  end if;
end $$;

-- 출석 체크
create or replace function public.check_attendance(p_event_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  select code into v_code from event_codes where event_id = p_event_id;
  if v_code is null then raise exception 'NO_CODE_ISSUED'; end if;
  if v_code <> upper(trim(p_code)) then raise exception 'INVALID_CODE'; end if;
  if not exists (select 1 from event_registrations
                 where event_id = p_event_id and user_id = auth.uid() and status = 'confirmed') then
    raise exception 'NOT_REGISTERED';
  end if;
  if exists (select 1 from attendances where event_id = p_event_id and user_id = auth.uid()) then
    raise exception 'ALREADY_CHECKED';
  end if;
  insert into attendances (event_id, user_id) values (p_event_id, auth.uid());
end $$;

-- admin 전용 RPC (전부 첫 줄에서 is_admin() 검사, 아니면 raise exception 'FORBIDDEN')
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('admin','member','applicant') then raise exception 'INVALID_INPUT'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active','dormant','withdrawn') then raise exception 'INVALID_INPUT'; end if;
  update profiles set status = p_status where id = p_user;
end $$;

create or replace function public.admin_review_application(p_application uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_applicant uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('accepted','rejected') then raise exception 'INVALID_INPUT'; end if;
  update applications set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_application returning applicant_id into v_applicant;
  if v_applicant is null then raise exception 'NOT_FOUND'; end if;
  if p_status = 'accepted' then
    update profiles set role = 'member' where id = v_applicant and role = 'applicant';
  end if;
end $$;

create or replace function public.admin_set_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into event_codes (event_id, code) values (p_event_id, v_code)
    on conflict (event_id) do update set code = excluded.code, updated_at = now();
  return v_code;
end $$;
```

- [ ] **Step 2: `seed.sql`** — 이벤트 3건(session/study, 정원 2짜리 1건 포함) insert. 프로필은 auth 연동이라 seed 불가 — 로컬 검증 시 Supabase Studio에서 유저 생성 후 role 수동 변경 절차를 README에 기재.
- [ ] **Step 3: 로컬 검증(도커 가능 시)** — `supabase start && supabase db reset` 후 psql로: 신청 2건 → 3번째 waitlisted, confirmed 취소 → 승격, 잘못된 코드 → INVALID_CODE 확인. 도커 불가 시 이 검증은 Task 9 배포 후 실 프로젝트에서 수행.
- [ ] **Step 4: 커밋** — `feat: DB 스키마 + RLS + 도메인 함수`

---

### Task 3: 인증 기반 (클라이언트 팩토리 · 가드 · 로그인 · 온보딩)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/auth.ts`, `src/lib/types.ts`, `src/lib/errors.ts`, `src/lib/schemas.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/(member)/onboarding/page.tsx`, `src/app/(member)/layout.tsx`, `src/app/admin/layout.tsx`, `src/actions/profile.ts`
- Test: `tests/schemas.test.ts`

**Interfaces:**
- Consumes: Task 1 컴포넌트, Task 2 스키마
- Produces:
  - `createClient(): Promise<SupabaseClient>` (server, cookies 기반 — @supabase/ssr 공식 패턴)
  - `getProfile(): Promise<Profile | null>` — 미로그인 null
  - `requireProfile(): Promise<Profile>` — 미로그인 시 `redirect('/login')`, 프로필 미완성(name==='') 시 `redirect('/onboarding')`
  - `requireAdmin(): Promise<Profile>` — role!=='admin'이면 `redirect('/')`
  - `types.ts`: `Profile`, `Application`, `Event`, `Registration`, `Attendance` (DB 컬럼 그대로, role/status는 union literal)
  - `errors.ts`: `toKoreanError(e: unknown): string` — Task 2 에러코드 매핑 (`INVALID_CODE`→'출석 코드가 올바르지 않아요' 등, 미지 코드는 '요청을 처리하지 못했어요')
  - `schemas.ts`: `profileSchema`(name 1자+, student_no, major, phone, interests), `eventSchema`, `applicationSchema`(answers), `attendCodeSchema`(6자 영숫자)
  - `actions/profile.ts`: `updateProfile(formData): Promise<{error?: string}>`
  - `ActionResult = { error?: string }` — 이후 모든 액션의 반환 규약

- [ ] **Step 1: zod 스키마 + 실패 테스트 작성** (`tests/schemas.test.ts` — 빈 이름 reject, 잘못된 코드 형식 reject, 정상 통과) → `pnpm vitest run` FAIL 확인
- [ ] **Step 2: lib 구현** → vitest PASS
- [ ] **Step 3: 로그인 페이지(구글 버튼 → `signInWithOAuth({provider:'google', redirectTo: origin + '/auth/callback'})`), 콜백 라우트(`exchangeCodeForSession` 후 프로필 완성 여부로 `/` 또는 `/onboarding` 리다이렉트), 온보딩 폼, (member) 상단 네비 레이아웃, admin 사이드바 레이아웃(첫 줄 `await requireAdmin()`)**
- [ ] **Step 4: `pnpm build` + vitest 통과 후 커밋** — `feat: 인증 기반 + 온보딩`

---

### Task 4: 회원 관리 (admin) — *Task 3 이후 병렬 가능*

**Files:**
- Create: `src/app/admin/members/page.tsx`, `src/app/admin/members/[id]/page.tsx`, `src/actions/member.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `toKoreanError`, RPC `admin_set_role`/`admin_set_status`, Task 1 컴포넌트
- Produces: `setMemberRole(userId, role): Promise<ActionResult>`, `setMemberStatus(userId, status): Promise<ActionResult>` — 성공 시 `revalidatePath('/admin/members')`

- [ ] 목록: 이름/학번/전공/role/status/가입일 테이블, 이름·학번 검색(searchParams), role·status 필터. Badge로 상태 표시.
- [ ] 상세: 프로필 전체 + role/status 변경 Select + 해당 회원 출석 기록.
- [ ] 액션 2종 구현 (RPC 호출 + 에러 매핑). 마지막 admin의 강등 방지는 하지 않음 (ponytail: 운영진 스스로 주의, README에 명시).
- [ ] `pnpm build` 통과, 커밋 — `feat: 회원 관리`

---

### Task 5: 지원서 (제출 + 심사) — *Task 3 이후 병렬 가능*

**Files:**
- Create: `src/app/(member)/apply/page.tsx`, `src/app/admin/applications/page.tsx`, `src/actions/application.ts`

**Interfaces:**
- Consumes: `requireProfile`, `requireAdmin`, `applicationSchema`, RPC `admin_review_application`
- Produces: `submitApplication(formData): Promise<ActionResult>`, `reviewApplication(id, status: 'accepted'|'rejected'): Promise<ActionResult>`

- [ ] `/apply`: role==='applicant'만 폼 노출(member/admin은 "이미 회원입니다" 안내). 시즌은 상수 `CURRENT_SEASON = '2026-2'` (`src/lib/constants.ts`). 질문 3개 고정: 자기소개/지원동기/관심분야. 제출 후 상태(pending/accepted/rejected) 표시. 시즌당 1회는 DB unique가 보장 — 중복 시 한국어 안내.
- [ ] `/admin/applications`: 시즌 필터 + 상태 탭, 상세 답변 열람, 합격/불합격 버튼(확인 confirm 후). 합격 시 role 자동 승격은 DB 함수가 처리.
- [ ] `pnpm build` 통과, 커밋 — `feat: 지원서 제출/심사`

---

### Task 6: 이벤트 CRUD + 회원 이벤트 화면 — *Task 3 이후 병렬 가능*

**Files:**
- Create: `src/app/admin/events/page.tsx`, `src/app/admin/events/new/page.tsx`, `src/app/admin/events/[id]/page.tsx`, `src/app/(member)/page.tsx`, `src/app/(member)/events/[id]/page.tsx`, `src/actions/event.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `requireProfile`, `eventSchema`
- Produces: `createEvent(formData)`, `updateEvent(id, formData)`, `deleteEvent(id)` — 모두 `Promise<ActionResult>`. 회원 이벤트 상세 페이지는 Task 7의 `<RegistrationPanel eventId={id} />`와 Task 8의 어드민 상세용 `<AttendancePanel eventId={id} />`를 렌더할 자리에 각각 `{/* Task7: RegistrationPanel */}`, `{/* Task8: AttendancePanel */}` placeholder div를 둔다 (통합은 Task 9).
- 조회 쿼리 규약: 회원 홈은 `events` 전체를 `starts_at` 내림차순, 다가오는/지난 구분 표시. confirmed 수는 `event_registrations` count로 병렬 조회.

- [ ] 어드민: 목록(타입 Badge, 일시, 정원, 신청 수) / 생성·수정 폼(zod) / 상세(수정·삭제).
- [ ] 회원: 홈 목록 카드(제목·타입·일시·장소·정원 대비 신청 수), 상세 페이지.
- [ ] `pnpm build` 통과, 커밋 — `feat: 이벤트 CRUD + 회원 이벤트 화면`

---

### Task 7: 신청/대기열 + 출석 체크 (회원측) — *Task 3 이후 병렬 가능*

**Files:**
- Create: `src/actions/registration.ts`, `src/actions/attendance.ts`, `src/components/RegistrationPanel.tsx`, `src/app/(member)/attend/page.tsx`, `src/app/(member)/profile/page.tsx`

**Interfaces:**
- Consumes: RPC `register_for_event`/`cancel_registration`/`check_attendance`, `attendCodeSchema`, `toKoreanError`
- Produces:
  - `registerForEvent(eventId): Promise<ActionResult & {status?: 'confirmed'|'waitlisted'}>`
  - `cancelRegistration(eventId): Promise<ActionResult>`
  - `checkAttendance(eventId, code): Promise<ActionResult>`
  - `<RegistrationPanel eventId profile />` — server component: 내 신청 상태(미신청/확정/대기 N번째) + 신청/취소 버튼. 대기 순번은 `waitlisted` 중 자기보다 `created_at` 빠른 수 + 1.
- [ ] `/attend`: 다가오는 이벤트 Select + 코드 6자 입력 → `checkAttendance`. 성공/실패 한국어 피드백. URL 쿼리 `?event=<id>&code=<code>` 프리필 지원(QR용).
- [ ] `/profile`: 내 정보 편집(Task 3 `updateProfile` 재사용) + 내 신청/출석 이력.
- [ ] `pnpm build` 통과, 커밋 — `feat: 이벤트 신청/대기열 + 출석 체크`

---

### Task 8: 어드민 대시보드 + 출석 관리 — *Task 3 이후 병렬 가능*

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/attendance/page.tsx`, `src/components/AttendancePanel.tsx`, `src/actions/attendance-admin.ts`

**Interfaces:**
- Consumes: `requireAdmin`, RPC `admin_set_event_code`, StatCard
- Produces:
  - `issueAttendanceCode(eventId): Promise<ActionResult & {code?: string}>`
  - `<AttendancePanel eventId />` — server component: 신청자 목록(확정/대기 구분), 출석 현황(n/m), 현재 코드 표시 + 발급/재발급 버튼, 코드 프리필 URL(`/attend?event=..&code=..`)을 QR로 표시 — QR은 외부 API 금지, `pnpm add qrcode` 후 dataURL 렌더 (무료·셀프호스팅 원칙).
- [ ] `/admin`: StatCard 4개 — 전체 회원 수, 활동 회원 수, 다가오는 이벤트 수, 최근 5개 이벤트 평균 출석률. 최근 이벤트 목록 테이블.
- [ ] `/admin/attendance`: 회원별 출석률 테이블(활동 member 대상, 지난 이벤트 중 confirmed 신청 건 기준 출석 %). 출석률 50% 미만 회원에 warning Badge '경고' 표시. 기준치는 `src/lib/constants.ts`의 `ATTENDANCE_WARNING_THRESHOLD = 0.5`.
- [ ] `pnpm build` 통과, 커밋 — `feat: 대시보드 + 출석 관리`

---

### Task 9: 통합 + 시드 + 배포 가이드 (순차, 마지막)

**Files:**
- Modify: `src/app/(member)/events/[id]/page.tsx`, `src/app/admin/events/[id]/page.tsx` (placeholder → 실제 패널 연결)
- Create: `README.md`, `.env.example`

- [ ] Task 6 placeholder를 `RegistrationPanel`/`AttendancePanel`로 교체.
- [ ] 전체 게이트: `pnpm vitest run && pnpm build` 통과.
- [ ] `README.md`: Supabase 무료 프로젝트 생성 → `supabase link` + `supabase db push` → Google Cloud Console OAuth 클라이언트 생성 → Supabase Auth에 Google provider 등록(redirect URL) → Vercel import + env 2개 설정 → 첫 admin 지정(SQL `update profiles set role='admin' where id='...'`) → 무료 한도/7일 일시정지 주의 → 마지막 admin 강등 주의.
- [ ] 커밋 — `feat: 통합 + 배포 가이드`

---

## 실행 순서 (병렬 계획)

```
Wave 0: Task 1 ∥ Task 2      (독립)
Wave 1: Task 3               (1,2 의존)
Wave 2: Task 4 ∥ 5 ∥ 6 ∥ 7 ∥ 8  (3 의존, 파일 겹침 없음)
Wave 3: Task 9               (전부 의존)
```

각 Wave 완료 시 Opus 리뷰(사용자 지시), 코드 작성 서브에이전트는 Sonnet.

## Self-Review 결과

- 스펙 커버리지: 회원(4)·지원서(5)·이벤트(6)·신청/대기열/출석(2,7)·대시보드/경고(8)·배포(9) — 전부 매핑됨. ✔
- 타입/시그니처 일관성: `ActionResult`, RPC 이름, 에러코드 목록 Task 2↔3↔7 일치 확인. ✔
- 미결: 없음.
