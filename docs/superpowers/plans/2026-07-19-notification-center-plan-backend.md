# 구현계획서 — 인앱 알림 센터 · 백엔드/DB 트랙

> 상위 문서: `docs/superpowers/specs/2026-07-19-notification-center-design.md` (승인된 설계, 권위 있음).
> 이 계획서는 **백엔드/DB 트랙만** 다룬다. 프론트(벨/드롭다운/read 액션)는 다른 에이전트 담당 — 여기서 계획하지 않는다.
> 실행자: Codex. 이 문서만 보고 실행 가능하도록 구체화했다.

---

## 관찰한 리포지토리 SQL 컨벤션 (인용)

`supabase/migrations/`를 읽고 확인한 스타일 — 새 마이그레이션은 이걸 그대로 따른다.

- **UUID PK**: 전 테이블 `id uuid primary key default gen_random_uuid()` — `uuid_generate_v4()`는 쓰지 않는다.
  (`0021_member_board.sql:13`, `0004_phase2.sql:42`, `0001_init.sql:15` 모두 `gen_random_uuid()`.)
- **스키마 접두사**: 항상 `public.` 명시 — `create table public.posts (...)`, `references public.profiles(id)`.
- **FK 삭제 정책**: 사람 소유 row는 `references public.profiles(id) on delete cascade` (`0021:15,27`, `0004:43`).
- **타임스탬프**: `created_at timestamptz not null default now()` (`0001:11`, `0004:50`).
- **RLS 활성화**: `alter table public.<t> enable row level security;` (`0021:33-34`).
- **정책 네이밍**: 큰따옴표 문자열 `"테이블: 설명"` 형식.
  예: `create policy "posts: member read" on public.posts for select using (...)` (`0021:36-43`).
  select은 `using (...)`, insert은 `with check (...)`, update은 `using (...)`.
- **RPC 헤더**: `create or replace function public.<fn>(...) returns <t> language plpgsql security definer set search_path = public as $$ ... $$;` (`0004:191-192`, `0021:55-56`).
- **RPC 권한 봉인**: `revoke execute on function public.<fn>(<argtypes>) from public, anon;` 후 `grant execute ... to authenticated;` (`0004:220-229`, `0024:32-33`).
- **감사 로그**: admin RPC는 `perform public.log_audit('<action>', <target>::text, <detail jsonb>);` 호출 (`0004:198,208,216`).

### SECURITY DEFINER의 RLS 우회 — 확인됨

기존 `admin_award_badge`(`0004:211-217`)는 `user_badges` 테이블(RLS 활성, `0004:80` 근방)에
스태프가 **다른 회원(`p_user`)** 앞으로 `insert`한다. 이게 동작하는 이유는 함수가
`security definer`라 **함수 소유자(postgres/서비스 롤) 권한으로 실행되어 RLS를 우회**하기 때문이다.
이 리포는 `alter table ... force row level security`를 어디에도 쓰지 않으므로 definer 함수는 RLS를 우회한다.
→ **결론**: `notifications`에 INSERT 정책을 두지 않아도, 3개 SECURITY DEFINER RPC 안의 `insert into notifications`는 정상 동작한다. 스펙의 "INSERT 정책 없음" 결정과 일치.

---

## A. 마이그레이션 `supabase/migrations/0025_notifications.sql`

### A-1. 테이블 DDL

스펙 §데이터 모델(46-57행)의 컬럼 그대로. `type` CHECK, `recipient_id` FK 포함.

```sql
-- 인앱 알림 센터: 1:1 타겟 알림 (수신자 1명, fan-out 없음).
-- insert는 아래 3개 SECURITY DEFINER RPC 경유로만 (직접 insert 정책 없음).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('registration_promoted', 'inquiry_answered', 'badge_awarded')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

### A-2. 인덱스 (스펙 59-61행)

```sql
-- 목록 조회 (수신자별 최신순)
create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

-- 안 읽음 카운트 (부분 인덱스)
create index notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;
```

### A-3. RLS (스펙 63-67행)

INSERT/DELETE 정책 없음 — 의도적. INSERT는 definer RPC 경유, DELETE는 MVP 불필요.

```sql
alter table public.notifications enable row level security;

create policy "notifications: own read" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "notifications: own update" on public.notifications
  for update using (recipient_id = auth.uid());
```

> 주의: UPDATE 정책의 `using`만으로 read_at 갱신은 허용된다. `with check`를 생략하면 update 후
> 행이 여전히 정책을 만족하는지 재검증하지 않는데, `recipient_id`는 프론트에서 건드리지 않고 `read_at`만
> 바꾸므로 안전하다. 방어적으로 하려면 `with check (recipient_id = auth.uid())`를 추가해도 무방(선택).
> 기존 리포 패턴(`0021:40-41` `posts: own update`)은 `using`만 쓰므로 그 스타일을 따라 `using`만으로 둔다.

### A-4. 이 마이그레이션 파일에 이어서 A-B의 3개 RPC 재정의(아래 B)를 같은 `0025` 파일에 넣는다

스펙 파일영향요약(94행)이 "테이블 + RLS + 3개 RPC 수정"을 하나의 `0025_notifications.sql`로 명시.
→ 위 A-1~A-3 다음에 B-1~B-3의 `create or replace` / `drop+create`를 이어 붙인다.

---

## B. 기존 3개 RPC 수정 — 알림 row insert 추가

각 RPC는 **본연의 쓰기(승급/답변/수여)를 먼저 수행**하고, 그 다음 대상 user_id 앞으로
`notifications` row **하나**를 insert 한다. 문구는 생성 시점에 확정(denormalize).

TypeScript 액션 변경 필요성 결론(공통): **없음.**
- `cancel_registration`: `registration.ts:32`에서 반환값(text = 승급자 이름)을 Slack 용으로 계속 소비 — 반환 타입 안 바뀜.
- `admin_answer_inquiry` / `admin_award_badge`: `inquiry.ts:48`, `points.ts:101`에서 반환값을 쓰지 않음(`returns void` 유지) — 시그니처/반환 안 바뀜.
- 셋 다 인자 이름·타입 동일 유지. 따라서 `src/actions/*.ts`는 **한 줄도 수정하지 않는다.**

---

### B-1. `cancel_registration` (정원 승급)

**현재 정의** — `supabase/migrations/0024_cancel_returns_promoted.sql:6-30`:

```sql
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
    where id = ( ... waitlisted 1명 ... )
    returning user_id into v_promoted_user;
    if v_promoted_user is not null then
      select name into v_promoted_name from profiles where id = v_promoted_user;
    end if;
  end if;
  return v_promoted_name;
end $$;
```

- **수신자 user_id**: `v_promoted_user` (이미 스코프에 있음 — 24행 `returning user_id into v_promoted_user`).
- **가드 조건 (스펙 89행: 승급자 없으면 알림 없음)**: 이미 존재하는 `if v_promoted_user is not null then` 블록(25행) **안에** insert를 넣는다. 이 블록은 ① 취소자가 `confirmed`였고 ② 대기자가 실제로 존재해 승급된 경우에만 진입 → 정확히 "승급 발생 시에만".
- **link**: `/events/{event_id}` = `'/events/' || p_event_id::text`.
- **event title (body용)**: 별도 변수로 select. `v_promoted_name` 옆에 `v_event_title text` 선언 추가.

**변경 방법**: 반환 타입(text) 그대로이므로 `drop + create`가 필요 없다 —
하지만 이 함수는 `0024`에서 `drop` 후 재생성된 형태다. `0025`에서는 **`create or replace`가 가능**(반환 타입 불변).
`0025_notifications.sql`에 아래 전체 함수 본문을 `create or replace function public.cancel_registration(p_event_id uuid) returns text ...`로 다시 쓴다.

```sql
create or replace function public.cancel_registration(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_was text;
  v_promoted_user uuid;
  v_promoted_name text;
  v_event_title text;
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
      select title into v_event_title from events where id = p_event_id;
      insert into notifications (recipient_id, type, title, body, link)
      values (
        v_promoted_user,
        'registration_promoted',
        '대기 신청이 확정되었어요',
        coalesce(v_event_title, '이벤트') || ' 참가가 확정되었습니다.',
        '/events/' || p_event_id::text
      );
    end if;
  end if;
  return v_promoted_name;
end $$;
```

> grant/revoke는 이미 `0024:32-33`에서 설정됨. `create or replace`는 권한을 보존하므로 재선언 불필요.
> (방어적으로 `0025`에도 revoke/grant를 반복해도 무해하지만, 리포는 함수 정의를 옮길 때만 재선언하는 패턴이라 생략 가능.)

---

### B-2. `admin_answer_inquiry` (문의 답변 완료)

**현재 정의** — `supabase/migrations/0004_phase2.sql:191-199`:

```sql
create or replace function public.admin_answer_inquiry(p_inquiry uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update inquiries set status = 'answered', answer = p_answer, answered_by = auth.uid(), answered_at = now()
    where id = p_inquiry;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('answer_inquiry', p_inquiry::text, '{}'::jsonb);
end $$;
```

- **수신자 user_id**: `inquiries.user_id` (`0004:43`). ⚠️ **현재 스코프에 없다** — 함수에 `declare`도 없고, UPDATE가 user_id를 돌려주지 않는다. → **플래그: 이 값을 확보하는 게 이 RPC 변경의 핵심**.
- **확보 방법 (제안한 정확한 수정)**: `declare` 절을 추가하고, 기존 `update ... where id = p_inquiry`에 `returning user_id, title into v_user, v_title`를 붙여 한 번의 쓰기로 수신자와 제목을 함께 확보한다. (별도 select 불필요 — UPDATE ... RETURNING로 원자적·1쿼리.)
- **가드 조건**: 기존 `if not found then raise exception 'NOT_FOUND'` 이후는 항상 답변 성공이므로 추가 가드 불필요. insert를 `if not found` 체크 **다음**에 둔다.
- **link**: `/inquiries` (스펙 41행).
- **body**: 문의 제목 인용.

**변경 방법**: `returns void` 불변 → `create or replace` 그대로 사용. `declare` 절 신설.

```sql
create or replace function public.admin_answer_inquiry(p_inquiry uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_title text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update inquiries set status = 'answered', answer = p_answer, answered_by = auth.uid(), answered_at = now()
    where id = p_inquiry
    returning user_id, title into v_user, v_title;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into notifications (recipient_id, type, title, body, link)
  values (
    v_user,
    'inquiry_answered',
    '문의에 답변이 등록되었어요',
    coalesce(nullif(v_title, ''), '문의') || '에 답변이 달렸습니다.',
    '/inquiries'
  );
  perform public.log_audit('answer_inquiry', p_inquiry::text, '{}'::jsonb);
end $$;
```

> 참고: `inquiries.status` CHECK은 `('pending','answered')`(`0004:46`)라 상태 전이는 그대로. `title`은 `not null default ''`(`0004:44`)라 빈 문자열 가능 → `nullif(...,'')`로 방어.

---

### B-3. `admin_award_badge` (배지 수여)

**현재 정의** — `supabase/migrations/0004_phase2.sql:211-217`:

```sql
create or replace function public.admin_award_badge(p_user uuid, p_badge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into user_badges (badge_id, user_id, awarded_by) values (p_badge, p_user, auth.uid());
  perform public.log_audit('award_badge', p_user::text, jsonb_build_object('badge', p_badge));
end $$;
```

- **수신자 user_id**: `p_user` (인자로 직접 주어짐 — 확보 문제 없음).
- **배지 이름 (body용)**: `badges.name`(`0004:68`)을 `select ... into v_badge_name from badges where id = p_badge`로 확보. `declare` 절 신설.
- **가드 조건**: `user_badges`에 `unique (badge_id, user_id)`(`0004:78`)가 있어 중복 수여는 insert에서 예외(→ 액션이 `points.ts:107`에서 23505를 잡아 "이미 보유한 뱃지"). 즉 **알림 insert에 도달했다면 실제 신규 수여**가 확정 → 추가 가드 불필요. insert into user_badges **다음**에 알림 insert를 둔다.
- **link**: `/profile` (스펙 42행).

**변경 방법**: `returns void` 불변 → `create or replace` 그대로.

```sql
create or replace function public.admin_award_badge(p_user uuid, p_badge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_badge_name text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into user_badges (badge_id, user_id, awarded_by) values (p_badge, p_user, auth.uid());
  select name into v_badge_name from badges where id = p_badge;
  insert into notifications (recipient_id, type, title, body, link)
  values (
    p_user,
    'badge_awarded',
    '새 뱃지를 획득했어요',
    coalesce(v_badge_name, '뱃지') || ' 뱃지를 받았습니다.',
    '/profile'
  );
  perform public.log_audit('award_badge', p_user::text, jsonb_build_object('badge', p_badge));
end $$;
```

> 중복 수여 시엔 첫 `insert into user_badges`가 23505로 실패하며 트랜잭션이 롤백 → 알림도 안 생김(스펙 89행 "수여가 실제로 안 일어난 경로에선 알림 없음" 충족). 별도 처리 불필요.

---

## C. TypeScript 타입

`src/lib/types.ts`에 아래 추가(기존 `Notice` 인터페이스 근처, 예: 92행 뒤 어디든 파일 스타일에 맞게).

```ts
export type NotificationType =
  | "registration_promoted"
  | "inquiry_answered"
  | "badge_awarded";

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
```

> 컬럼명·nullable은 A-1 DDL과 1:1 대응. `type` union은 CHECK 제약의 세 리터럴과 정확히 일치.

---

## D. 테스트/검증 계획

이 리포 테스트는 **vitest**(`npm test` = `vitest run`, `vitest.config.ts` `environment: "node"`)이고,
DB에 붙는 통합 테스트 하네스가 **없다** — 기존 테스트는 (a) 순수 함수 단위(`points.test.ts`, `notify-slack.test.ts`)
또는 (b) 소스/파일 내용을 `readFile`로 읽어 문자열 단언(`member-notices.test.ts`)하는 두 패턴뿐이다.
따라서 검증은 **정적(파일 단언) + 수동 SQL** 조합으로 한다. 새 DB 인프라는 도입하지 않는다(YAGNI).

### D-1. 정적 검증 — 신규 파일 `tests/notifications-migration.test.ts` (vitest, readFile 패턴)

`member-notices.test.ts` 스타일 그대로. `supabase/migrations/0025_notifications.sql`을 읽어:
- `create table public.notifications` 포함, `check (type in ('registration_promoted', 'inquiry_answered', 'badge_awarded'))` 포함.
- `references public.profiles(id) on delete cascade` 포함.
- 두 인덱스: `notifications_recipient_created_idx`, `notifications_unread_idx` + `where read_at is null` 포함.
- `enable row level security` + `"notifications: own read"` + `"notifications: own update"` 포함.
- 3개 RPC 각각에 `insert into notifications` 문자열이 등장(정확히 3회 등장 단언 → 각 RPC 1회).
- 가드: `cancel_registration` 블록의 `insert into notifications`가 `if v_promoted_user is not null` 뒤에 오는지(문자열 순서 인덱스 비교).
- 링크 리터럴 `'/inquiries'`, `'/profile'`, `'/events/'` 각 존재.

`src/lib/types.ts`를 읽어 `NotificationType` union 3개 리터럴 + `interface Notification` 존재 단언(선택).

### D-2. 수동 SQL 검증 (로컬 Supabase, 스펙 성공기준 83-89행)

로컬 `supabase db reset`(0001~0025 전부 적용) 후 psql/SQL editor로:

1. **각 RPC가 정확히 1 row 생성**:
   - 대기자 있는 이벤트에서 confirmed 취소자가 `select cancel_registration('<event>')` →
     `select count(*) from notifications where recipient_id = '<승급자>' and type = 'registration_promoted'` = 1.
   - admin으로 `select admin_answer_inquiry('<inq>', '답변')` →
     `notifications where recipient_id = '<문의작성자>' and type='inquiry_answered'` = 1, `link='/inquiries'`.
   - `select admin_award_badge('<user>','<badge>')` →
     `notifications where recipient_id='<user>' and type='badge_awarded'` = 1, `link='/profile'`.
2. **가드 경로 = 0 row**:
   - 대기자 **없는** 이벤트에서 confirmed 취소 → 알림 0.
   - waitlisted 상태(즉 v_was != 'confirmed') 취소 → 승급 자체 없음 → 알림 0.
   - 이미 보유한 배지 재수여 시도 → 23505 예외/롤백 → 알림 0.
3. **안 읽음 카운트** = `select count(*) from notifications where recipient_id = auth.uid() and read_at is null`가 read_at null 개수와 일치.
4. **RLS 교차 접근 차단**: 회원 A 세션(`set request.jwt.claims`/anon key)에서 `select * from notifications where recipient_id = '<B>'` → 0 rows. B 알림 `update ... set read_at = now()` 시도 → 0 rows affected(정책 `using` 불통과).

---

## E. 순서화된 실행 스텝 (Codex 체크리스트)

1. **`supabase/migrations/0025_notifications.sql` 생성** — A-1 테이블 DDL 작성.
   → 검증: 파일 존재, `create table public.notifications` + `type` CHECK 3리터럴 포함.
2. **같은 파일에 A-2 인덱스 2개 추가.**
   → 검증: `notifications_recipient_created_idx`, `notifications_unread_idx (... where read_at is null)` 존재.
3. **같은 파일에 A-3 RLS(enable + own read + own update) 추가.**
   → 검증: `enable row level security` + 정책 2개, INSERT/DELETE 정책 없음.
4. **같은 파일에 B-1 `cancel_registration` `create or replace` 추가** — 승급 블록 안(`if v_promoted_user is not null`)에 `insert into notifications` + `v_event_title` 선언.
   → 검증: insert가 가드 블록 내부에 위치, `type='registration_promoted'`, `link '/events/' || p_event_id`.
5. **같은 파일에 B-2 `admin_answer_inquiry` `create or replace` 추가** — `declare v_user/v_title`, `update ... returning user_id, title into ...`, `if not found` 뒤 insert.
   → 검증: `returning user_id, title` 존재, `type='inquiry_answered'`, `link='/inquiries'`.
6. **같은 파일에 B-3 `admin_award_badge` `create or replace` 추가** — `declare v_badge_name`, user_badges insert 뒤 badges name select + notifications insert.
   → 검증: `type='badge_awarded'`, `link='/profile'`.
7. **`src/lib/types.ts`에 C의 `NotificationType` + `Notification` 추가.**
   → 검증: `npx tsc --noEmit`(또는 `npm run build`) 통과.
8. **`src/actions/*.ts` 무변경 확인** — registration/inquiry/points 액션을 건드리지 않았는지 `git diff --stat`로 확인.
   → 검증: 변경 파일 목록에 `src/actions/` 없음.
9. **D-1 정적 테스트 `tests/notifications-migration.test.ts` 작성.**
   → 검증: `npm test` 통과(신규 + 기존 전부 green).
10. **로컬 DB에 마이그레이션 적용 후 D-2 수동 SQL 검증 실행.**
    → 검증: `supabase db reset` 오류 없이 완료, D-2 1~4 항목 각 SQL 단언 통과.

---

## 플래그·리스크 요약

- **[플래그] `admin_answer_inquiry`의 수신자 user_id가 원 스코프에 없음** (`0004:191-199`, `declare`도 UPDATE RETURNING도 없음).
  → 해결: `declare v_user/v_title` 신설 + `update ... returning user_id, title into v_user, v_title` (B-2). 별도 select 불필요, 원자적.
- **[리스크 낮음] `cancel_registration` 승급 없을 때 알림 미생성**은 기존 `if v_promoted_user is not null` 블록에 insert를 넣는 것으로 자연 충족 — 새 가드 코드 불필요.
- **[리스크 낮음] 배지 중복 수여**는 `unique (badge_id, user_id)` 제약이 트랜잭션을 롤백시켜 알림도 롤백 — definer 함수 원자성 덕분. 추가 처리 불필요.
- **[확인됨] SECURITY DEFINER가 RLS 우회** → INSERT 정책 부재로도 3개 RPC의 알림 insert 정상. `force row level security` 미사용 확인.
- **[확인됨] TypeScript 액션 무변경** — 세 RPC 모두 시그니처/반환 타입 불변, 반환값 소비 방식도 유지.
- **테스트 인프라 한계**: 라이브 DB 통합 테스트 하네스가 없어 RPC 동작은 수동 SQL로만 검증. CI 자동화가 필요하면 후속 과제(스펙 스코프 밖).
