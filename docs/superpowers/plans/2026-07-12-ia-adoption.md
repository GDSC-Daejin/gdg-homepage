# IA 반영 구현 플랜 — Phase 1·2·3 (2026-07-12)

기획: docs/PRD/ia-adoption-plan.md. 리크루팅 축 흡수, 새 권한 등급·새 라우트 최소화.
§2.7 회원 역할 필터는 이미 구현돼 있음(src/app/admin/members/MemberFilters.tsx) → 제외.

## Global Constraints

- Next.js **16.2.10** App Router. `params`/`searchParams`는 **Promise** — 반드시 `await`. 컨벤션이 낯설면 `node_modules/next/dist/docs/`의 해당 가이드를 먼저 읽을 것.
- TypeScript strict. 패키지 매니저 **pnpm**. 새 의존성 추가 금지(Resend도 REST fetch로).
- 기존 패턴 재사용:
  - 인증: `requireAdmin()` / `requireProfile()` / `getProfile()` (src/lib/auth.ts)
  - 어드민 mutation 액션: `requireAdmin()` → `if (await isDemoMode()) return {};` → zod parse → supabase/RPC → `toKoreanError` → `revalidatePath` → `return {}` (src/actions/budget.ts 참고)
  - 감사 로그가 필요한 어드민 mutation은 **security definer RPC + `public.is_admin()` 체크 + `perform public.log_audit(...)`** 패턴 (supabase/migrations/0016 참고). RPC는 `revoke ... from public, anon; grant ... to authenticated;`
  - 새 감사 action을 추가하면 src/app/admin/audit/page.tsx의 `ACTION_LABEL`에 한글 라벨도 추가
  - 어드민 페이지의 demo 모드: `isDemoMode()`가 true면 DB를 치지 않고 데모 데이터 렌더 (lib/demoData.ts는 **Task 1만** 수정, 이후 태스크는 데모 상수를 해당 페이지 파일에 인라인 정의)
- UI: 기존 공용 컴포넌트(PageHeader, Card, Badge, StatCard, EmptyState, Input, Select, Textarea, Button) 재사용. 어카피는 한국어 "~해요" 톤. 색은 기존 토큰(primary, gray-*, danger 등).
- 포지션은 `Position` 타입·`POSITION_LABELS` 재사용(frontend/backend/designer 3개 고정). 새 권한 등급 금지 — 전부 ADMIN_ROLES 공통.
- 검증: `pnpm test`(vitest), `npx tsc --noEmit`. 마지막 통합 태스크에서 `pnpm build`.
- 커밋: 태스크당 1커밋, 메시지는 기존 스타일(`feat: ...` 한글). 말미에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Task 1: 모집 코어 파운데이션 (마이그레이션 0017 + lib 타입/스키마/헬퍼)

**Files:**
- Create: `supabase/migrations/0017_recruiting.sql`, `src/lib/recruiting.ts`
- Edit: `src/lib/types.ts`, `src/lib/schemas.ts`, `src/lib/demoData.ts`, `tests/schemas.test.ts`

**0017_recruiting.sql:**
1. `recruiting_settings` 단일 행 테이블:
   ```sql
   create table public.recruiting_settings (
     id int primary key default 1 check (id = 1),
     season text not null,
     is_open boolean not null default false,
     open_positions text[] not null default '{frontend,backend,designer}',
     updated_at timestamptz not null default now()
   );
   alter table public.recruiting_settings enable row level security;
   create policy "recruiting: public read" on public.recruiting_settings for select using (true);
   insert into public.recruiting_settings (id, season) values (1, '2026-2');
   ```
   쓰기 정책은 만들지 않음(쓰기는 RPC로만).
2. RPC `admin_update_recruiting_settings(p_season text, p_is_open boolean, p_open_positions text[])`:
   security definer, `is_admin()` 체크(아니면 `raise exception 'FORBIDDEN'`), `p_season = ''`이거나 `p_open_positions`에 3파트 외 값이 있으면 `raise exception 'INVALID_INPUT'`, `update recruiting_settings set season=..., is_open=..., open_positions=..., updated_at=now() where id=1`, `perform public.log_audit('update_recruiting_settings', 'recruiting', jsonb_build_object('season', p_season, 'is_open', p_is_open, 'open_positions', p_open_positions));` revoke/grant 패턴 적용.
3. `applications` 컬럼 추가:
   ```sql
   alter table public.applications
     add column position text check (position in ('frontend','backend','designer')),
     add column review_note text not null default '';
   ```
   (position은 null 허용 — 기존 데이터 "미지정")
4. RPC `admin_set_application_note(p_application uuid, p_note text)`: definer, is_admin 체크, `update applications set review_note = p_note where id = p_application`, not found면 `raise exception 'NOT_FOUND'`, `log_audit('note_application', p_application::text, jsonb_build_object('note', left(p_note, 300)))`. revoke/grant.
5. `admin_set_application_status` 재정의(0016 본문 유지 + position 승계): `returning applicant_id, position into v_applicant, v_position;` 합격 시 기존 role 승격에 더해 `if v_position is not null then update profiles set position = v_position where id = v_applicant; end if;` (v_applicant not null인 경우만).

**src/lib/types.ts:** `Application`에 `position: Position | null;`과 `review_note: string;` 추가. 새 인터페이스:
```ts
export interface RecruitingSettings {
  season: string;
  is_open: boolean;
  open_positions: Position[];
}
```

**src/lib/schemas.ts:**
- `applicationSchema`에 `position: z.enum(["frontend","backend","designer"], { message: "지원 파트를 선택해주세요" })` 추가.
- 신규 `recruitingSettingsSchema`: `{ season: z.string().min(1, "시즌명을 입력해주세요"), is_open: z.boolean(), open_positions: z.array(z.enum(["frontend","backend","designer"])).min(1, "모집 파트를 1개 이상 선택해주세요") }`.

**src/lib/recruiting.ts:** 서버 헬퍼:
```ts
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import type { RecruitingSettings } from "@/lib/types";

const DEFAULT_SETTINGS: RecruitingSettings = {
  season: CURRENT_SEASON,
  is_open: false,
  open_positions: ["frontend", "backend", "designer"],
};

export async function getRecruitingSettings(): Promise<RecruitingSettings> { ... }
```
row가 없거나 에러면 `DEFAULT_SETTINGS` 반환(fail-closed: 기본 is_open=false). `DEFAULT_SETTINGS`도 export (demo용).

**src/lib/demoData.ts:** `DEMO_APPLICATIONS`의 각 행에 `position`(frontend/backend/designer/null 섞어서)과 `review_note`(대부분 "", 한두 개만 짧은 메모) 추가 — Application 타입 변경으로 인한 컴파일 에러 해소가 목적.

**tests/schemas.test.ts:** 기존 파일에 append — applicationSchema position 누락/잘못된 값 reject + 정상 통과 1건, recruitingSettingsSchema 빈 open_positions reject + 정상 1건.

**Verify:** `pnpm test` 전체 통과, `npx tsc --noEmit` 클린. (이 시점에 /apply 폼은 position을 아직 안 보내 런타임상 제출 불가 상태가 되지만 Task 3이 바로 해소 — 의도된 중간 상태)

## Task 2: /admin/settings 모집 설정 페이지 + 사이드바 메뉴

**Files:**
- Create: `src/actions/recruiting.ts`, `src/app/admin/settings/page.tsx`, `src/app/admin/settings/SettingsForm.tsx`
- Edit: `src/app/admin/AdminSidebarNav.tsx`, `src/app/admin/audit/page.tsx`(ACTION_LABEL에 `update_recruiting_settings: "모집 설정 변경"` 추가)

**actions/recruiting.ts** — `updateRecruitingSettings(formData: FormData): Promise<ActionResult>`:
표준 어드민 액션 패턴. `is_open`은 `formData.get("is_open") === "on"`(체크박스), `open_positions`는 `formData.getAll("open_positions").map(String)`. `recruitingSettingsSchema.safeParse` → `supabase.rpc("admin_update_recruiting_settings", {...})` → 에러 시 `toKoreanError` → `revalidatePath("/admin/settings")`, `revalidatePath("/admin")`, `revalidatePath("/apply")`, `revalidatePath("/")`.

**page.tsx:** `requireAdmin()`, demo면 `DEFAULT_SETTINGS`(lib/recruiting.ts에서 import), 아니면 `getRecruitingSettings()`. PageHeader(title "설정", description "모집 시즌과 지원 파트를 관리해요") + Card 안에 SettingsForm. `export const dynamic = "force-dynamic";`

**SettingsForm.tsx** ("use client"): 초기값 props로 받아 `useTransition` + 액션 호출(기존 ApplyForm 패턴). 필드: 시즌명 Input(name="season"), 모집 상태 체크박스(name="is_open", 라벨 "모집 열기 — 켜면 /apply에서 지원을 받아요"), 모집 파트 체크박스 3개(name="open_positions", value=각 Position, 라벨은 POSITION_LABELS). 저장 성공 시 "저장했어요" 문구, 실패 시 에러 문구.

**AdminSidebarNav.tsx:** "관리" 그룹 마지막에 `{ href: "/admin/settings", label: "설정", icon: "settings" }` 추가 + icons에 기어 아이콘 path 추가 (기존 아이콘과 같은 24px stroke 스타일, 예: `"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z"` 수준이면 충분).

**Verify:** `npx tsc --noEmit` 클린. `pnpm test` 통과.

## Task 3: /apply 모집 상태 연동 + 지원 파트 선택 + 절차 안내

**Files:**
- Edit: `src/actions/application.ts`(submitApplication만), `src/app/apply/page.tsx`, `src/app/apply/ApplyForm.tsx`

**page.tsx:** `getRecruitingSettings()` 호출, `export const dynamic = "force-dynamic";` 추가.
- 시즌 표기를 `CURRENT_SEASON` 대신 `settings.season`으로.
- **마감 시**: 폼 대신 Card에 "지금은 모집 기간이 아니에요" 안내 + "모집이 열리면 이 페이지에서 바로 지원할 수 있어요" 설명 + `/events`로 가는 "활동 둘러보기" 링크 버튼.
- **모집 중**: 폼 위에 "지원 절차" 안내(IA Join 흡수) — ①서류 접수 ②운영진 심사 ③결과 이메일 안내 3단계를 간단한 가로/세로 스텝 UI로. 그 아래 `<ApplyForm openPositions={settings.open_positions} />`.

**ApplyForm.tsx:** prop `openPositions: Position[]` 추가. 이메일 필드 아래에 "지원 파트" 라디오 그룹(name="position", openPositions만 노출, 라벨 POSITION_LABELS, required). 기존 스타일과 어울리는 선택 카드형 라디오(테두리 + 선택 시 primary 강조)면 충분.

**submitApplication:** 맨 앞에서 `getRecruitingSettings()` 호출:
- `!settings.is_open` → `return { error: "지금은 모집 기간이 아니에요" };` (신뢰 경계 — 서버에서도 차단)
- `position = String(formData.get("position") ?? "")`을 schema로 검증하고, 통과해도 `settings.open_positions`에 없으면 `return { error: "지금은 모집하지 않는 파트예요" };`
- insert에 `position` 포함, `season`은 `CURRENT_SEASON` 대신 `settings.season` 사용 (import 정리).

**Verify:** `npx tsc --noEmit`, `pnpm test`.

## Task 4: 지원서 심사 — 이름/학번 검색·파트 필터·심사 메모

**Files:**
- Edit: `src/app/admin/applications/page.tsx`, `src/app/admin/applications/ApplicationCard.tsx`, `src/app/admin/applications/[id]/page.tsx`, `src/actions/application.ts`(setApplicationNote 추가)
- Create: `src/app/admin/applications/SearchFilter.tsx`, `src/app/admin/applications/[id]/ReviewNoteForm.tsx`
- Edit: `src/app/admin/audit/page.tsx`(ACTION_LABEL에 `note_application: "심사 메모 작성"` 추가)

**리스트(page.tsx):** searchParams에 `q`(이름/학번 검색), `position`(all|frontend|backend|designer|none) 추가.
- 필터링은 기존처럼 시즌 조회 결과(seasonApplications)에 대해 **메모리에서** 적용(데모 모드와 로직 공유, 시즌당 지원서 수십 건 규모라 충분): `q`는 `applicant_name`/`student_no`에 소문자 includes, `position`은 일치(`none`은 null만).
- 파트별 카운트: 상태 탭 아래(또는 옆)에 파트 필터 — "전체 / 프론트엔드 N / 백엔드 N / 디자이너 N / 미지정 N" 링크형 필터(기존 상태 탭과 같은 pill 스타일, 활성 시 primary). 카운트는 status 필터 적용 전 seasonApplications 기준.
- 검색: `SearchFilter.tsx` 클라이언트 컴포넌트 — Input + 검색 버튼, submit 시 `router.push`로 q/season/status/position 쿼리 조합(기존 MemberFilters.tsx 패턴 참고). SeasonFilter 옆 배치.
- 기존 상태 탭·시즌 필터 링크들이 q/position 파라미터를 잃지 않게 URL 생성부에 포함할 것.

**ApplicationCard.tsx:** position 뱃지 추가(`POSITION_LABELS[app.position]`, null이면 "미지정" neutral 뱃지).

**상세([id]/page.tsx):** 연락처/이메일 아래에 "지원 파트" 표시(미지정 처리). 페이지 하단(심사 상태 위)에 "심사 메모" 섹션 — `<ReviewNoteForm id={app.id} note={app.review_note} />`.

**ReviewNoteForm.tsx** ("use client"): Textarea(초기값 note) + 저장 버튼, useTransition으로 `setApplicationNote(id, value)` 호출, 성공 시 "저장했어요", 실패 시 에러 표시. 작성자·시각은 audit log가 남기므로 UI에 별도 표기 없음.

**setApplicationNote(id: string, note: string): Promise<ActionResult>** (actions/application.ts): 표준 패턴 — `requireAdmin()`, demo 단락, `supabase.rpc("admin_set_application_note", { p_application: id, p_note: note.trim() })`, `toKoreanError`, `revalidatePath("/admin/applications/" + id)`.

**Verify:** `npx tsc --noEmit`, `pnpm test`.

## Task 5: 어드민 대시보드 리크루팅 위젯

**Files:**
- Edit: `src/app/admin/page.tsx`
- Create(권장): `src/app/admin/RecruitingWidget.tsx` (서버 컴포넌트, page가 데이터를 넘김 — page.tsx 비대화 방지)

**동작:** `getRecruitingSettings()` 조회. **`is_open`일 때만** PageHeader 바로 아래에 리크루팅 섹션 렌더(마감이면 기존 대시보드 그대로, 아무것도 추가 안 함). demo 모드면 인라인 데모 상수(설정 open + 지원서 카운트 몇 개)로 위젯을 보여줌(파일 내 정의, demoData.ts 수정 금지).

**데이터(!demo && is_open일 때):** `applications`에서 `select("status, position").eq("season", settings.season)` 1회 → 메모리 집계. 오늘 이벤트: KST 기준 오늘 00:00~24:00 사이 `starts_at` 이벤트 `select("id, title, starts_at")` (KST 경계는 `new Date()`에 +9h 보정한 날짜로 UTC 범위 계산).

**UI 구성(Card 1~2장, 기존 그리드 스타일):**
1. **Overview**: "리크루팅" 제목 + `{season}` 시즌 라벨 + "모집 중" success 뱃지. StatCard 스타일 숫자 4개: 전체 지원자 / 심사 대기(waiting) / 심사 중(pending) / 합격·불합격(accepted+rejected). 각 숫자는 `/admin/applications?season={season}&status={...}` 링크. 그 아래 파트별 카운트 한 줄(프론트엔드 N · 백엔드 N · 디자이너 N · 미지정 N).
2. **Today & Quick Actions**: 오늘 시작하는 이벤트 리스트(없으면 "오늘 일정이 없어요") + "심사 대기 N건" 할 일 카드(waiting>0일 때, 지원서 리스트 waiting 필터 링크). Quick Actions 링크 3개: 지원자 관리(/admin/applications) · 공지 작성(/admin/notices/new) · 이벤트 생성(/admin/events/new) — 아이콘+라벨 버튼형 링크.

면접 관련 요소는 넣지 않는다(면접 미운영 확정).

**Verify:** `npx tsc --noEmit`, `pnpm test`.

## Task 6: 랜딩 홈 분기 (`/` 비로그인=랜딩 / 로그인=대시보드) + 퍼블릭 헤더

**Files:**
- Create: `src/app/page.tsx`(루트), `src/app/Landing.tsx`, `src/components/PublicHeader.tsx`, `src/app/(member)/MemberShell.tsx`, `src/app/(member)/HomeDashboard.tsx`
- Edit: `src/app/(member)/layout.tsx`
- Delete: `src/app/(member)/page.tsx`

**구조 (라우트 충돌 주의 — `(member)/page.tsx`가 `/`를 점유 중이므로 반드시 삭제):**
1. `(member)/page.tsx`의 본문 전체를 `(member)/HomeDashboard.tsx`로 이동 — `export async function HomeDashboard({ month }: { month?: string })` 형태로 바꾸고 `requireProfile()` 호출은 제거(루트 page가 인증을 책임짐). 나머지 로직·JSX는 그대로.
2. `(member)/layout.tsx`의 JSX(사이드바 셸)를 `(member)/MemberShell.tsx`로 추출: `export function MemberShell({ profile, children }: { profile: Profile; children: React.ReactNode })` — 프로필 조회 없이 렌더만. layout.tsx는 `getProfile()` → 없으면 `redirect("/login")` → `<MemberShell profile={profile}>{children}</MemberShell>`로 축소.
3. 신규 `src/app/page.tsx`:
   ```tsx
   export default async function RootPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
     const profile = await getProfile();
     if (!profile) return <Landing />;
     if (profile.name === "") redirect("/onboarding");
     const { month } = await searchParams;
     return <MemberShell profile={profile}><HomeDashboard month={month} /></MemberShell>;
   }
   ```
   `export const dynamic = "force-dynamic";` 필수. 로그인 사용자의 기존 대시보드 경험(월 필터 포함)이 그대로여야 한다.

**PublicHeader.tsx** (서버 컴포넌트): `getProfile()`과 `getRecruitingSettings()`를 직접 호출. 로그인 페이지의 다크 미학(bg 투명/블러, 흰 텍스트)과 어울리는 상단 바 — 좌측 Logo+GDG DJU, 중앙/우측 내비: About(/about) · Team(/team) · Activities(/events) · Projects(/projects) · **지원하기(/apply — 모집 중이면 primary 강조 pill, 마감이면 일반 링크)** · 로그인(/login, 비로그인일 때) 또는 대시보드(/, 로그인 시). `ADMIN_ROLES.includes(profile.role)`이면 "어드민"(/admin) 링크 추가. 다크 배경 페이지에서 쓰이는 걸 전제로 스타일링.

**Landing.tsx** (서버 컴포넌트): `getRecruitingSettings()` 호출. 로그인 페이지(src/app/login/page.tsx)의 시각 언어(다크 #060608 배경, Google 4색, 큰 타이포)를 차용하되 CSS는 Tailwind로 새로 작성(login.css 재사용 금지). 구성(IA Home 축):
1. PublicHeader
2. 히어로: "GDG on Campus DJU" + 한 줄 소개(대진대학교 구글 개발자 커뮤니티) + CTA 버튼 — **모집 중: "지금 지원하기" → /apply (primary 강조) / 마감: "활동 둘러보기" → /events**. 모집 중이면 "{season} 리크루팅 진행 중" 뱃지.
3. About 프리뷰: 2~3문장 소개 + "더 알아보기 → /about"
4. What We Do: 활동 유형 3종 카드(정기세션 · 스터디 · 모각코) — 각각 한 줄 설명
5. Team 프리뷰: "운영진 소개 → /team" 링크 카드
6. 푸터 수준의 마감 CTA(모집 상태 연동, 히어로와 동일 분기)
콘텐츠는 정적 하드코딩(CMS 없음). 애니메이션·복잡한 이펙트는 넣지 않는다(로그인 페이지 수준의 confetti 재현 금지 — 단정한 정적 랜딩이면 충분).

**metadata:** 루트 page.tsx에 `export const metadata = { title: "GDG on Campus DJU" }` 수준.

**Verify:** `npx tsc --noEmit`, `pnpm test`, `pnpm build`(라우트 충돌이 없는지 이 태스크에서 확인 필수).

## Task 7: About·Team 콘텐츠 보강 (IA 섹션 구조 흡수)

**Files:**
- Edit: `src/app/about/page.tsx`, `src/app/team/page.tsx`

두 페이지 모두: 기존 "← 로그인으로 돌아가기" 링크를 제거하고 상단에 `<PublicHeader />`(src/components/PublicHeader.tsx, Task 6 산출물) 배치. 기존 다크(#060608) 디자인 언어 유지.

**about:** IA 섹션 구조로 재구성 —
1. Introduction(기존 소개 문단 유지)
2. What is GDG on Campus (구글 개발자 그룹 캠퍼스 챕터 설명 2~3문장)
3. Mission & Vision (각 1~2문장)
4. Core Values (3~4개 키워드 카드: 예 — 함께 성장, 실전 빌드, 커뮤니티, 오픈 소스)
5. What We Do (정기세션·스터디·모각코·프로젝트 4개 항목 + 한 줄 설명)
6. HISTORY(기존 연혁 유지)
콘텐츠는 정적 하드코딩. 문구는 기존 about/login 페이지 카피 톤과 일관되게.

**team:** IA 구조로 재구성 —
1. Chapter Lead (1명, 기존 TEAM 데이터의 회장을 승격 배치)
2. Core Team (나머지 운영진)
3. 파트 소개 (프론트엔드·백엔드·디자이너 3파트 — POSITION_LABELS 기준, 각 한 줄 설명. 개별 멤버 나열은 하지 않음)
4. Contact & Links (이메일·GitHub·Instagram 등 2~3개 — 실값이 없으니 `#` placeholder가 아니라 실제 존재하는 것만: 기존 코드에 링크가 없으면 "가입 문의는 지원 페이지를 이용해주세요" + /apply 링크로 대체)

**Verify:** `npx tsc --noEmit`, `pnpm test`.

## Task 8: 합불 통보 이메일 자동 발송 (Phase 3)

**Files:**
- Create: `supabase/migrations/0018_result_email_log.sql`, `src/lib/email.ts`
- Edit: `src/actions/application.ts`(setApplicationStatus), `.env.example`, `src/app/admin/audit/page.tsx`(ACTION_LABEL에 `send_result_email: "합불 이메일 발송"` 추가)

**0018_result_email_log.sql:** RPC `admin_log_result_email(p_application uuid, p_detail jsonb)` — definer, `is_admin()` 체크, `perform public.log_audit('send_result_email', p_application::text, coalesce(p_detail, '{}'::jsonb));` revoke public/anon, grant authenticated. (발송 기록은 기존 audit log 재사용 — 별도 테이블 없음)

**src/lib/email.ts:** Resend REST API 직접 호출(새 의존성 금지, src/lib/slack.ts의 fetch + `AbortSignal.timeout(5000)` 패턴 참고):
```ts
export async function sendResultEmail(params: {
  to: string; name: string; season: string; accepted: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }>
```
- `process.env.RESEND_API_KEY` 없으면 `{ sent: false, skipped: true }` (개발 환경 무해).
- 발신자: `process.env.RESEND_FROM ?? "GDG DJU <onboarding@resend.dev>"`.
- `POST https://api.resend.com/emails`, `Authorization: Bearer`, body `{ from, to, subject, html }`.
- 템플릿 2종 고정(한국어, 간단한 인라인 스타일 html):
  - 합격: 제목 `[GDG DJU] {season} 리크루팅 결과 안내` / 본문 — {name}님 합격 축하 + 추후 안내(오리엔테이션 등)는 별도 연락 예정.
  - 불합격: 같은 제목 / 본문 — 지원 감사 + 아쉽게도 함께하지 못함 + 다음 시즌 재지원 환영.
- 실패(비 2xx·네트워크) 시 `{ sent: false, error: "..." }` — throw 금지.

**setApplicationStatus 확장:** RPC 성공 후, `status === "accepted" || status === "rejected"`이면:
1. `supabase.from("applications").select("applicant_name, email, season").eq("id", id).single()` 조회
2. email이 비어있지 않으면 `sendResultEmail(...)` 호출
3. `skipped`가 아니면 `supabase.rpc("admin_log_result_email", { p_application: id, p_detail: { status, to: email, sent } })`로 발송 기록(실패도 sent:false로 기록)
4. 발송 실패 시 `return { error: "상태는 변경됐지만 결과 이메일 발송에 실패했어요" };` (상태 변경은 이미 완료 — 롤백하지 않음). 성공/스킵이면 기존대로 `return {}`.
demo 모드 단락(기존 첫 줄)은 그대로 유지 — demo에선 발송 없음.

**.env.example** 말미에 추가:
```
# Resend API 키 (합불 통보 이메일 발송용, resend.com에서 발급 — 미설정 시 발송 생략)
RESEND_API_KEY=

# 합불 이메일 발신 주소 (도메인 인증 필요, 예: GDG DJU <noreply@yourdomain.com>)
RESEND_FROM=
```

**Verify:** `npx tsc --noEmit`, `pnpm test`, `pnpm build` (최종 태스크 통합 게이트).

## 실행 웨이브 (파일 겹침 없음 확인 완료)

- Wave A: Task 1 (단독 — 이후 전부가 의존)
- Wave B: Task 2 ∥ Task 3
- Wave C: Task 4 ∥ Task 5
- Wave D: Task 6 (단독 — 라우트 재구성)
- Wave E: Task 7 ∥ Task 8
- 최종: whole-branch 리뷰 (Sonnet)

주의: Task 2·4·8이 모두 audit/page.tsx를 수정하지만 서로 다른 웨이브라 충돌 없음.
