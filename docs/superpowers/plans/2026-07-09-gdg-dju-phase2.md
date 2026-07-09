# GDG DJU Phase 2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 공지+슬랙, 출석 미달 크론 알림, 노션 자료실, 설문, 문의, 포인트/뱃지, 예산, 감사 로그, 통계 확장.

**Architecture:** 1차 기반 위에 증축. 새 테이블은 0004 마이그레이션, admin 변경은 전부 audit 로깅 경유. 슬랙/노션은 lib 유틸로 격리.

**Tech Stack:** 기존 + `@notionhq/client`. env 추가: SLACK_WEBHOOK_URL, NOTION_API_KEY, NOTION_DATABASE_ID, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY.

## Global Constraints (1차와 동일 + 추가)

- 유료 금지. Server Action 첫 줄 가드. 한국어 문구. 토큰 클래스만. TS strict + `pnpm build` 게이트.
- **신규 SQL 함수는 반드시 `revoke execute ... from public, anon; grant ... to authenticated;` (또는 service_role) 동반** — 1차 최종 리뷰에서 잡힌 회귀 패턴.
- admin의 상태 변경 행위는 전부 audit_logs에 남긴다 (RPC 내부 log_audit 호출).
- env 미설정 시 기능은 crash 대신 한국어 안내로 degrade.
- ActionResult/toKoreanError/useTransition 폼 패턴 등 1차 계약 유지.

## 신규 라우트

```
/notices, /notices/[id]          회원 공지
/materials                       자료실 (노션 읽기 전용)
/surveys, /surveys/[id]          회원 설문 목록/응답
/inquiries                       회원 문의 제출/내역
/admin/notices/**                공지 관리 (+발행=슬랙)
/admin/surveys/** (+[id]/results) 설문 관리/결과
/admin/inquiries                 문의 답변
/admin/points                    포인트/뱃지 부여
/admin/budget                    예산/후원
/admin/audit                     감사 로그
/api/cron/attendance-warning     크론 (Bearer CRON_SECRET)
```

---

### Task P1: 마이그레이션 0004 (스키마+RLS+트리거+audit 통합)

**Files:** Create `supabase/migrations/0004_phase2.sql`

**Produces (계약):** 아래 SQL 전문. RPC — `admin_answer_inquiry(p_inquiry uuid, p_answer text)`, `admin_grant_points(p_user uuid, p_amount int, p_reason text, p_event uuid default null)`, `admin_award_badge(p_user uuid, p_badge uuid)`, `log_audit(p_action text, p_target text, p_detail jsonb)`. 에러코드 추가 없음(FORBIDDEN/INVALID_INPUT/NOT_FOUND 재사용).

```sql
-- 공지
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
create policy "notices: read published" on public.notices for select using (auth.uid() is not null and (published or public.is_admin()));
create policy "notices: admin all" on public.notices for all using (public.is_admin()) with check (public.is_admin());

-- 설문
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_id uuid references public.events(id) on delete set null,
  questions jsonb not null default '[]'::jsonb, -- [{id:text, type:'rating'|'text', label:text}]
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,   -- {qid: number|string}
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);
alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
create policy "surveys: read" on public.surveys for select using (auth.uid() is not null);
create policy "surveys: admin all" on public.surveys for all using (public.is_admin()) with check (public.is_admin());
create policy "responses: own insert" on public.survey_responses for insert
  with check (user_id = auth.uid() and exists (select 1 from public.surveys s where s.id = survey_id and s.is_open));
create policy "responses: own or admin" on public.survey_responses for select using (user_id = auth.uid() or public.is_admin());

-- 문의/건의
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  status text not null default 'pending' check (status in ('pending','answered')),
  answer text,
  answered_by uuid references public.profiles(id),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
create policy "inquiries: own insert" on public.inquiries for insert with check (user_id = auth.uid());
create policy "inquiries: own or admin" on public.inquiries for select using (user_id = auth.uid() or public.is_admin());

-- 포인트/뱃지
create table public.point_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text not null,
  ref_event uuid references public.events(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  icon text not null default '🏅'
);
create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  awarded_by uuid references public.profiles(id),
  awarded_at timestamptz not null default now(),
  unique (badge_id, user_id)
);
alter table public.point_logs enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
create policy "points: own or admin" on public.point_logs for select using (user_id = auth.uid() or public.is_admin());
create policy "badges: read" on public.badges for select using (auth.uid() is not null);
create policy "badges: admin all" on public.badges for all using (public.is_admin()) with check (public.is_admin());
create policy "user_badges: own or admin" on public.user_badges for select using (user_id = auth.uid() or public.is_admin());
-- 쓰기는 트리거/RPC로만

-- 출석 자동 포인트 (+10)
create or replace function public.grant_attendance_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into point_logs (user_id, amount, reason, ref_event)
  values (new.user_id, 10, '출석', new.event_id);
  return new;
end $$;
create trigger on_attendance_points after insert on public.attendances
  for each row execute function public.grant_attendance_points();

-- 예산/후원 (admin only)
create table public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  amount int not null check (amount > 0),
  memo text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount int not null default 0,
  season text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.budget_entries enable row level security;
alter table public.sponsors enable row level security;
create policy "budget: admin only" on public.budget_entries for all using (public.is_admin()) with check (public.is_admin());
create policy "sponsors: admin only" on public.sponsors for all using (public.is_admin()) with check (public.is_admin());

-- 감사 로그
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles(id),
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "audit: admin read" on public.audit_logs for select using (public.is_admin());

create or replace function public.log_audit(p_action text, p_target text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor, action, target, detail) values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
end $$;

-- 기존 admin RPC에 audit 추가 (create or replace, 본문은 0001과 동일 + log_audit 한 줄)
-- admin_set_role: log_audit('set_role', p_user::text, jsonb_build_object('role', p_role));
-- admin_set_status: log_audit('set_status', p_user::text, jsonb_build_object('status', p_status));
-- admin_review_application: log_audit('review_application', p_application::text, jsonb_build_object('status', p_status));
-- admin_set_event_code: log_audit('issue_code', p_event_id::text, '{}'::jsonb);
-- (0001의 최신 본문을 그대로 복사하고 성공 경로 끝에 log_audit 호출만 추가할 것)

-- 신규 admin RPC
create or replace function public.admin_answer_inquiry(p_inquiry uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update inquiries set status = 'answered', answer = p_answer, answered_by = auth.uid(), answered_at = now()
    where id = p_inquiry;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('answer_inquiry', p_inquiry::text, '{}'::jsonb);
end $$;

create or replace function public.admin_grant_points(p_user uuid, p_amount int, p_reason text, p_event uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_amount = 0 or p_reason = '' then raise exception 'INVALID_INPUT'; end if;
  insert into point_logs (user_id, amount, reason, ref_event, created_by)
    values (p_user, p_amount, p_reason, p_event, auth.uid());
  perform public.log_audit('grant_points', p_user::text, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end $$;

create or replace function public.admin_award_badge(p_user uuid, p_badge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into user_badges (badge_id, user_id, awarded_by) values (p_badge, p_user, auth.uid());
  perform public.log_audit('award_badge', p_user::text, jsonb_build_object('badge', p_badge));
end $$;

-- EXECUTE 봉인 (Global Constraint)
revoke execute on function public.log_audit(text, text, jsonb) from public, anon;
revoke execute on function public.grant_attendance_points() from public, anon;
revoke execute on function public.admin_answer_inquiry(uuid, text) from public, anon;
revoke execute on function public.admin_grant_points(uuid, int, text, uuid) from public, anon;
revoke execute on function public.admin_award_badge(uuid, uuid) from public, anon;
grant execute on function
  public.admin_answer_inquiry(uuid, text),
  public.admin_grant_points(uuid, int, text, uuid),
  public.admin_award_badge(uuid, uuid)
to authenticated;
-- log_audit/grant_attendance_points는 definer 내부/트리거 전용 — authenticated grant 불필요
-- 단, log_audit는 다른 definer 함수가 호출(함수 소유자 권한)이므로 grant 없이 동작
```

- [ ] SQL 작성 (위 전문 + 기존 admin RPC 4종 create or replace with audit)
- [ ] 정적 점검 (괄호/따옴표/참조 무결성, 기존 RPC 본문이 0001 최신본과 일치+log_audit만 추가인지)
- [ ] 커밋 "feat: Phase2 스키마 (공지/설문/문의/포인트/예산/감사로그)"
- [ ] (컨트롤러) 실 DB 적용 + 스모크 검증

### Task P2: lib 확장 (슬랙/노션/타입/스키마)

**Files:** Create `src/lib/slack.ts`, `src/lib/notion.ts`. Modify `src/lib/types.ts`, `src/lib/schemas.ts`, `tests/schemas.test.ts`. `pnpm add @notionhq/client`.

**Produces:**
- `postSlack(text: string): Promise<{ error?: string }>` — SLACK_WEBHOOK_URL 미설정 시 `{error: '슬랙 웹훅이 설정되지 않았어요 (SLACK_WEBHOOK_URL)'}`, fetch 실패 시 한국어 에러. 서버 전용.
- `fetchMaterials(): Promise<{ materials: Material[]; error?: string }>` — Notion DB query (`@notionhq/client`), env 미설정 시 `{materials: [], error: '노션 연동이 설정되지 않았어요'}`. `Material = { id, title, type, event, url, date, notionUrl }`. 프로퍼티명: 제목(title)/유형(select)/이벤트(rich_text)/링크(url)/날짜(date).
- types: `Notice, SurveyQuestion({id,type:'rating'|'text',label}), Survey, SurveyResponse, Inquiry, PointLog, Badge, UserBadge, BudgetEntry, Sponsor, AuditLog, Material`
- schemas: `noticeSchema(title 1+, body)`, `surveySchema(title, questions 1개+)`, `surveyResponseSchema`, `inquirySchema(title, body)`, `pointGrantSchema(amount ≠0 정수, reason 1+)`, `budgetSchema(entry_date, type, category, amount 양수)`
- [ ] 스키마 테스트 RED → 구현 GREEN → 커밋 "feat: Phase2 lib (슬랙/노션/타입/스키마)"

### Task P3: 공지 (P1,P2 이후 병렬)

**Files:** `src/app/admin/notices/**`, `src/app/(member)/notices/**`, `src/actions/notice.ts`
**Produces:** `createNotice/updateNotice/deleteNotice/publishNotice` — publish는 published=true+published_at 설정 후 `postSlack("[공지] 제목\n요약(100자)\n<링크>")`. 슬랙 실패해도 발행 자체는 성공 처리, 결과 메시지에 슬랙 상태 표기. 회원: 발행된 공지 목록/상세.

### Task P4: 설문 (병렬)

**Files:** `src/app/admin/surveys/**`(목록/생성/[id]/results), `src/app/(member)/surveys/**`(목록/[id] 응답), `src/actions/survey.ts`
**Produces:** `createSurvey(질문 빌더: rating/text 동적 추가)`, `toggleSurveyOpen`, `deleteSurvey`, `submitSurveyResponse(surveyId, formData)` — 중복 응답은 23505→"이미 응답한 설문이에요". 결과: rating 평균+분포 바, text 응답 목록, 응답 수.

### Task P5: 문의/건의 (병렬)

**Files:** `src/app/(member)/inquiries/**`, `src/app/admin/inquiries/**`, `src/actions/inquiry.ts`
**Produces:** `submitInquiry`, `answerInquiry(id, answer)` (RPC admin_answer_inquiry). 회원: 제출 폼+내 문의 내역(상태/답변 표시). 어드민: 상태 탭, 답변 작성.

### Task P6: 포인트/뱃지 (병렬)

**Files:** `src/app/admin/points/**`, `src/actions/points.ts`, Modify `src/app/(member)/profile/page.tsx`
**Produces:** `grantPoints(userId, amount, reason, eventId?)`, `createBadge`, `awardBadge(userId, badgeId)` (RPC 경유). 어드민: 회원 선택+부여 폼, 뱃지 관리, 최근 포인트 로그. 프로필: 내 포인트 합계+내역, 내 뱃지.

### Task P7: 예산/후원 (병렬)

**Files:** `src/app/admin/budget/**`, `src/actions/budget.ts`
**Produces:** `createBudgetEntry/deleteBudgetEntry`, `createSponsor/deleteSponsor`. 화면: 수입/지출 테이블+잔액 요약, 스폰서 목록.

### Task P8: 자료실(노션) + 출석 미달 슬랙 (병렬)

**Files:** `src/app/(member)/materials/page.tsx`, `src/app/api/cron/attendance-warning/route.ts`, `src/lib/attendance-stats.ts`, `src/actions/attendance-warning.ts`, `vercel.json`, Modify `src/app/admin/attendance/page.tsx`(수동 발송 버튼)
**Produces:**
- /materials: fetchMaterials 렌더(유형 Badge, 노션 링크), env 미설정 시 안내.
- `computeAttendanceWarnings(supabase): Promise<{name, rate}[]>` (attendance-stats.ts — admin/attendance 페이지의 페어링 로직과 동일 기준, threshold 0.5)
- cron route: `Authorization: Bearer ${CRON_SECRET}` 검증 → service-role 클라이언트(`SUPABASE_SERVICE_ROLE_KEY`)로 집계 → postSlack("[출석 경고] ..."). vercel.json: `{"crons":[{"path":"/api/cron/attendance-warning","schedule":"0 0 * * 1"}]}`
- `sendAttendanceWarning()` server action (requireAdmin, 사용자 세션으로 집계) + 버튼.

### Task P9: 통계 확장 + 감사 로그 + 네비 통합 (마지막)

**Files:** Modify `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/(member)/layout.tsx`, `src/app/(member)/page.tsx`, `README.md`, `.env.example`. Create `src/app/admin/audit/page.tsx`
**Produces:** 대시보드에 월별 가입 추이(최근 6개월, CSS 바), 세션별 만족도(설문 rating 평균), 활동 랭킹 Top 10(point_logs 합). 감사 로그 테이블(최근 100건, actor 이름 조인). 네비: admin 사이드바에 공지/설문/문의/포인트/예산/감사로그, member 네비에 공지/자료실/설문/문의. 회원 홈 상단 최근 공지 1건 배너. README/.env.example에 신규 env 5종.

## 실행 순서

```
Wave 0: P1 ∥ P2 → (컨트롤러: 실 DB 적용 + 노션 DB 생성)
Wave 1: P3 ∥ P4 ∥ P5 ∥ P6 ∥ P7 ∥ P8   (파일 겹침 없음, pnpm build 금지·tsc 게이트)
Wave 2: P9 → 통합 게이트 → 최종 whole-branch 리뷰(Opus)
```

## Self-Review

- 스펙 9항목 ↔ P1~P9 전부 매핑 ✔ (자동알림=P8, 통계=P9, 감사로그=P1+P9)
- RPC 시그니처 P1↔P5/P6 일치, EXECUTE revoke 포함 ✔
- 파일 소유 겹침: profile(P6), admin/attendance(P8), layout/홈/대시보드(P9) — 단독 소유 ✔
