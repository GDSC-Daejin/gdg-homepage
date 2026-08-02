# Codex 지시서 — 회원가입 승인 게이트

작성: 2026-07-22 · 모든 파일/라인은 실측 확인됨. **이 문서에 적힌 것만 구현한다. DoD 밖 리팩터·정리·개선 금지.**

---

## 목표

구글 로그인 신규 가입자를 "승인 대기" 상태로 만든다. 지금은 로그인 즉시 `role='member'`가 되어 회원 영역이 열리지만, 앞으로는 **Staff(팀 멤버 이상 = `is_admin()`)가 승인해야** 회원 영역이 열린다. 흐름:

```
로그인 → 온보딩(프로필 입력) → /pending(승인 대기 화면) → [Staff 승인] → 회원 영역
admin_emails 가입자는 자동 승인되어 대기 없이 통과한다.
```

승인 상태는 **전용 플래그**로 표현한다: `profiles.approved_at`(null = 대기). `role`/`status` 의미는 건드리지 않는다. 게이트는 앱 레이어 + RLS 양쪽에 건다(미승인 유저가 직접 API로 member 데이터를 읽지 못하도록).

---

## 대상 파일 + 현재 상태 (실측)

### DB (Supabase 마이그레이션)
- 최신 마이그레이션 = `supabase/migrations/0039_disable_audit_logging.sql`. **신규 파일 `0040_member_approval.sql`을 추가**한다.
- `profiles` 테이블: `0001_init.sql`에 정의. `status`(active/dormant/withdrawn), `joined_at` 있음. `approved_at` 컬럼 **없음**.
- 현재 `handle_new_user()` = `supabase/migrations/0022_default_member_role.sql:4-19`:
  ```sql
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when exists (select 1 from admin_emails where lower(email)=lower(new.email))
      then 'team_member' else 'member' end);
  ```
- `is_member()` = `supabase/migrations/0021_member_board.sql:4-10`:
  ```sql
  select exists (select 1 from profiles
    where id = auth.uid() and role in ('member','team_member','organizer'));
  ```
- `is_admin()` = `0009_roles_positions.sql:22-28` (organizer ∪ team_member). **변경 없음.**
- `log_audit(action, target, payload)` 존재 (`admin_set_role`가 `0009`에서 사용). 재사용.
- `admin_set_role()` = `0009_roles_positions.sql:49-63`.
- `register_for_event()` = `0001_init.sql:106-125`. 현재 멤버십 가드:
  ```sql
  select role into v_role from profiles where id = auth.uid() and status = 'active';
  if v_role is null or v_role = 'applicant' then raise exception 'NOT_MEMBER'; end if;
  ```

**pending 유저에게 새는(=`auth.uid() is not null`만 요구하는) read 정책 — 전수:**
- `0001_init.sql:96` `events: read all` → `using (auth.uid() is not null)`
- `0004_phase2.sql:12` `notices: read published` → `using (auth.uid() is not null and (published or public.is_admin()))`
- `0004_phase2.sql:34` `surveys: read` → `using (auth.uid() is not null)`
- `0004_phase2.sql:84` `badges: read` → `using (auth.uid() is not null)`
- `0026_places.sql:28` `places: read all` → `using (auth.uid() is not null)`
- `0031_meetings.sql:16` `meetings: read` → `using (auth.uid() is not null)`
- `0030_groups.sql:27` `groups: member read` → `for select to authenticated using (true)`
- `0030_groups.sql:35` `group_members: member read` → `for select to authenticated using (true)`

**pending 유저가 쓸 수 있는 member write 경로 — 전수:**
- `0004_phase2.sql:36-37` `responses: own insert` → `with check (user_id = auth.uid() and exists(...surveys is_open...))`
- `0004_phase2.sql:53` `inquiries: own insert` → `with check (user_id = auth.uid())`
- `register_for_event()` RPC (위 참조)
- (board `posts`/`comments` insert는 `0021`에서 이미 `is_member()` 사용 → `is_member()` 재정의로 자동 하드닝됨. **개별 수정 불필요.**)
- (group 가입은 member write 경로 없음 — `group_members`는 `self leave`(delete)와 `admin all`뿐. 수정 불필요.)

### 앱 레이어
- `src/lib/types.ts:48-62` — `Profile` 인터페이스. `approved_at` **없음**. `isStaff(profile)` = `ADMIN_ROLES.includes(profile.role)` (`types.ts:4-6`) 존재.
- `src/lib/auth.ts` — `getProfile()`(profiles `select("*")`), `requireProfile()`(`:22-27`: `!profile→"/"`, `student_no===""→"/onboarding"`), `requireAdmin()`(`:29-33`).
- `src/app/page.tsx:31-61` — 루트 "/". 로그인 유저면 `student_no===""→/onboarding`, 아니면 `MemberShell + HomeDashboard`를 **직접 렌더**(이 파일은 `(member)` 그룹 밖이라 아래 layout 게이트가 안 걸림).
- `src/app/(member)/layout.tsx:9-18` — `!profile→"/"` 후 `MemberShell` 렌더.
- `src/app/(member)/onboarding/page.tsx` — getProfile 사용, `student_no!=="" → "/"`. **pending 유저가 온보딩하는 화면 — 게이트 걸면 안 됨.**
- `src/actions/profile.ts:63-67` — `signOut()`(server action, `redirect("/")`).
- `src/lib/demoData.ts` — `DEMO_MEMBERS` 16개 항목, 각 `Profile` 리터럴에 `joined_at` 있음. `approved_at` 없음.
- `src/app/admin/members/page.tsx` — Staff 회원 목록. `searchParams`로 `q/role/status/academicStatus` 필터, `profiles.select("*")`. 데모 분기 `DEMO_MEMBERS`.
- `src/app/admin/members/MemberFilters.tsx` — 필터 UI.
- `src/app/admin/members/[id]/MemberRoleStatusForm.tsx` — 역할·포지션·상태 수정 client form. `src/actions/member.ts`의 `setMemberRole` 등 사용.
- `src/app/admin/members/[id]/page.tsx` — 회원 상세. `MemberRoleStatusForm` 렌더.
- `src/actions/member.ts` — `requireAdmin()` + RPC 호출 + `isDemoMode()` no-op + `revalidatePath` 패턴. 새 액션은 이 패턴을 그대로 따른다.

---

## 정확한 변경

### 1. `supabase/migrations/0040_member_approval.sql` (신규)

정확히 아래 순서로 작성:

```sql
-- 회원가입 승인 게이트: 신규 가입자는 Staff 승인 전까지 대기(approved_at is null)

-- 1) 승인 플래그 컬럼
alter table public.profiles
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null;

-- 2) 기존 회원 전원 grandfather (락아웃 방지 — 반드시)
update public.profiles set approved_at = joined_at where approved_at is null;

-- 3) 신규 가입 트리거: admin_emails → team_member + 자동승인, 그 외 → member + 대기
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  v_is_admin := exists (select 1 from admin_emails where lower(email) = lower(new.email));
  insert into public.profiles (id, name, role, approved_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when v_is_admin then 'team_member' else 'member' end,
    case when v_is_admin then now() else null end
  );
  return new;
end $$;

-- 4) is_member(): 승인 조건 추가 (board posts/comments RLS가 이걸 씀 → 한 곳에서 하드닝)
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid()
      and role in ('member','team_member','organizer')
      and approved_at is not null);
$$;

-- 5) broad-authenticated read 정책을 is_member()로 교체
drop policy "events: read all" on public.events;
create policy "events: read all" on public.events
  for select using (public.is_member());

drop policy "notices: read published" on public.notices;
create policy "notices: read published" on public.notices
  for select using (public.is_member() and (published or public.is_admin()));

drop policy "surveys: read" on public.surveys;
create policy "surveys: read" on public.surveys
  for select using (public.is_member());

drop policy "badges: read" on public.badges;
create policy "badges: read" on public.badges
  for select using (public.is_member());

drop policy "places: read all" on public.places;
create policy "places: read all" on public.places
  for select using (public.is_member());

drop policy "meetings: read" on public.meetings;
create policy "meetings: read" on public.meetings
  for select using (public.is_member());

drop policy "groups: member read" on public.groups;
create policy "groups: member read" on public.groups
  for select to authenticated using (public.is_member());

drop policy "group_members: member read" on public.group_members;
create policy "group_members: member read" on public.group_members
  for select to authenticated using (public.is_member());

-- 6) member write 하드닝
drop policy "responses: own insert" on public.survey_responses;
create policy "responses: own insert" on public.survey_responses
  for insert with check (
    user_id = auth.uid() and public.is_member()
    and exists (select 1 from public.surveys s where s.id = survey_id and s.is_open)
  );

drop policy "inquiries: own insert" on public.inquiries;
create policy "inquiries: own insert" on public.inquiries
  for insert with check (user_id = auth.uid() and public.is_member());

-- register_for_event: 승인 조건 추가 (나머지 로직 원문 유지)
create or replace function public.register_for_event(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_confirmed int;
  v_status text;
  v_role text;
  v_approved timestamptz;
begin
  select role, approved_at into v_role, v_approved
    from profiles where id = auth.uid() and status = 'active';
  if v_role is null or v_role = 'applicant' or v_approved is null then
    raise exception 'NOT_MEMBER';
  end if;
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

-- 7) 승인 RPC (Staff 전용)
create or replace function public.admin_approve_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update profiles set approved_at = now(), approved_by = auth.uid()
    where id = p_user and approved_at is null;
  perform public.log_audit('approve_member', p_user::text, '{}'::jsonb);
end $$;
revoke execute on function public.admin_approve_member(uuid) from public, anon;
grant execute on function public.admin_approve_member(uuid) to authenticated;

-- 8) 방어: staff로 승격되면 자동 승인 (admin_set_role 재정의 — 원문 + approved_at 보정)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('organizer', 'team_member', 'member', 'applicant') then
    raise exception 'INVALID_INPUT';
  end if;
  if p_role = 'organizer' and exists (
    select 1 from profiles where role = 'organizer' and id <> p_user
  ) then
    raise exception 'ORGANIZER_EXISTS';
  end if;
  update profiles set role = p_role where id = p_user;
  if p_role in ('team_member','organizer') then
    update profiles set approved_at = coalesce(approved_at, now()) where id = p_user;
  end if;
  perform public.log_audit('set_role', p_user::text, jsonb_build_object('role', p_role));
end $$;
```

> ⚠️ 이 마이그레이션은 이 태스크에서 **DB에 적용하지 않는다**(수동 배포 · CI 없음). SQL은 위 기존 패턴과 문법적으로 일관되게만 작성하고, 배포는 사용자가 직접 한다.

### 2. 앱 게이트

**`src/lib/types.ts`** — `Profile` 인터페이스에 두 필드 추가 (`joined_at` 근처):
```ts
approved_at: string | null;
approved_by?: string | null;
```

**`src/lib/auth.ts`** — 승인 게이트 헬퍼 추가 + 3곳에서 호출. 파일 상단 import에 `isStaff`는 이미 있음. 추가:
```ts
export function assertApproved(profile: Profile): void {
  if (!profile.approved_at && !isStaff(profile)) redirect("/pending");
}
```
그리고 `requireProfile()`의 `student_no` 체크 **다음 줄**에 `assertApproved(profile);` 추가:
```ts
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.student_no === "") redirect("/onboarding");
  assertApproved(profile);              // 추가
  return profile;
}
```

**`src/app/page.tsx`** — `if (profile.student_no === "") redirect("/onboarding");`(`:44`) **다음 줄**에 추가:
```ts
assertApproved(profile);
```
(`import { getProfile } from "@/lib/auth";` 를 `import { getProfile, assertApproved } from "@/lib/auth";`로.)

**`src/app/(member)/layout.tsx`** — `if (!profile) redirect("/");` 다음에 추가:
```ts
assertApproved(profile);
```
(import에 `assertApproved` 추가. `student_no===""` 체크는 이 파일에 없으니 넣지 말 것 — 기존 동작 유지.)

**`src/app/pending/page.tsx`** (신규, `(member)` 그룹 밖 = 게이트 없음):
```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isStaff } from "@/lib/types";
import { signOut } from "@/actions/profile";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.approved_at || isStaff(profile)) redirect("/");
  return (
    <div className="mx-auto w-full max-w-md">
      <PageHeader
        title="승인 대기 중"
        description="가입 신청이 접수되었어요. 운영진 승인 후 회원 기능을 이용할 수 있어요."
      />
      <form action={signOut}>
        <Button type="submit" variant="secondary">로그아웃</Button>
      </form>
    </div>
  );
}
```
> `Button`의 실제 props(`variant` 등)는 `src/components/Button.tsx`를 읽고 맞춘다. 존재하지 않는 prop을 추측하지 말 것. `PageHeader`도 실제 시그니처(`title`/`description`) 확인 후 사용(다른 페이지에서 이미 이 형태로 씀).

**`src/lib/demoData.ts`** — `DEMO_MEMBERS` 16개 항목 각각에 `approved_at`를 추가한다. 값은 **그 항목의 `joined_at`과 동일한 문자열**(전원 승인 상태). `approved_by`는 optional이므로 생략.

### 3. Staff 승인 UI

**`src/actions/member.ts`** — 기존 `setMemberRole` 패턴 그대로 새 액션 추가:
```ts
export async function approveMember(userId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_approve_member", { p_user: userId });
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  return {};
}
```

**`src/app/admin/members/[id]/MemberRoleStatusForm.tsx`** — props에 `approvedAt: string | null` 추가. 렌더 상단 배지 영역에 승인 상태를 표시하고, `approvedAt`이 null일 때만 "승인" 버튼을 노출한다. 버튼은 기존 `useTransition` 패턴으로 `approveMember(userId)` 호출, 에러는 기존 `error` state로 표시. 승인 대기면 `<Badge tone="warning">승인 대기</Badge>`, 승인됨이면 배지 없음(또는 표시 안 함). **역할/포지션/상태/재학여부 기존 select들은 그대로 둔다.**

**`src/app/admin/members/[id]/page.tsx`** — `MemberRoleStatusForm`에 `approvedAt={member.approved_at}` prop 전달. `member`는 이미 `profiles.select("*")` 결과라 `approved_at` 포함됨(데모 분기도 위에서 채움).

**`src/app/admin/members/page.tsx` + `MemberFilters.tsx`** — "승인 대기" 필터 추가:
- `page.tsx`: `searchParams`에 `pending?: string` 추가. `if (pending) query = query.is("approved_at", null);` (실 DB 분기). 데모 분기는 `DEMO_MEMBERS.filter(m => !m.approved_at)` — 데모는 전원 승인이라 빈 목록. `hasFilter` 계산에 `pending` 포함.
- `MemberFilters.tsx`: 기존 필터 UI 컨벤션에 맞춰 "승인 대기만 보기" 옵션/체크 추가. **기존 필터 구조를 실제로 읽고 그 패턴대로** 추가한다(새 UI 컴포넌트 발명 금지).

---

## 완료 정의 (DoD 체크리스트)

- [ ] `supabase/migrations/0040_member_approval.sql` 이 위 SQL대로 존재
- [ ] `Profile`에 `approved_at`/`approved_by` 추가, `DEMO_MEMBERS` 16개 전부 `approved_at` 채움
- [ ] `assertApproved` 헬퍼가 `auth.ts`에 있고 `requireProfile`·`app/page.tsx`·`(member)/layout.tsx` 3곳에서 호출됨
- [ ] `src/app/pending/page.tsx` 존재, 승인/Staff면 `/`로 리다이렉트
- [ ] `/onboarding` 페이지에는 승인 게이트가 **없음**(pending 유저가 온보딩 가능)
- [ ] `approveMember` 액션 + `admin_approve_member` RPC 연결
- [ ] 회원 상세에서 승인 대기 회원에 "승인" 버튼 노출, 승인 시 배지가 대기→해제
- [ ] admin/members에 "승인 대기" 필터 동작
- [ ] `pnpm build` 성공 (타입 체크 포함)
- [ ] `pnpm test` — 아래 지뢰 외 신규 실패 없음

## 검증 커맨드 (green 될 때까지 반복)

```bash
pnpm build
pnpm test
```

`pnpm build`가 타입 체크를 포함한다. 새 필드/시그니처로 인한 타입 에러가 나면 그 호출부까지 맞춘다(단, DoD 범위 내에서만).

## 건드리지 말 것 (스코프 펜스)

- **이 문서 밖 리팩터·정리·포맷팅·주석 개선 전면 금지.** 변경 라인은 전부 위 "정확한 변경"으로 추적돼야 한다.
- `is_admin()`, `requireAdmin()`, 온보딩 로직(`OnboardingForm`, `updateProfile`), 인증 콜백(`auth/callback`), recruiting/`applicant`(`/apply`, applications) — **손대지 말 것.**
- 알림(notifications), 거절(reject) 기능 — **v1 범위 밖. 만들지 말 것.**
- 기존 마이그레이션 파일 편집 금지. 승인 관련은 전부 `0040`에만.
- `pnpm install`이나 새 의존성 추가 금지.

## 알려진 지뢰 (추적 금지)

- 이 레포는 표준 Next.js가 아님 — **먼저 `AGENTS.md`를 읽고**, 필요 시 `node_modules/next/dist/docs/` 확인.
- `tests/accessibility-primitives.test.ts` — eslint 미설치로 **상시 실패**. 회귀 아님. `package.json` 고치지 말 것.
- 마이그레이션은 이 태스크에서 DB에 적용하지 않는다(수동 배포). SQL 문법 일관성만 확보.
- turbopack dev `adapterFn` 반복 에러 = dev 캐시 이슈. 코드 문제 아님.
