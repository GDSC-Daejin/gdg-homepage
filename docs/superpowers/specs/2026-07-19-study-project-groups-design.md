# 설계: 스터디·프로젝트 소속(groups)

작성 2026-07-19. 브레인스토밍 결과 확정 설계 문서 — 구현 전 단계.

## 문제

회원이 스터디·프로젝트에 **소속**될 수 있어야 하고, 운영진이 그 **명단(로스터)** 을 확인할 수 있어야 한다. 현재 앱에는 소속 개념이 없다. `events` 테이블에 `type='study'`가 있지만 이는 "1회성 모임"(단일 `starts_at`·출석코드·정원)이지 "기수 내내 지속되는 소속"이 아니다. `/projects`·`/team` 공개 페이지는 하드코딩된 가짜 데이터다.

## 확정된 요구사항

브레인스토밍에서 결정된 스코프:

- **핵심 가치 = 명단(소속) 파악.** 진행/성과 관리, 활동→보상 연동은 스코프 밖(YAGNI).
- **생성/배정 = 운영진 생성 + 회원 자가가입.** 회원 개설·리더 승인 없음.
- **수명주기 = 기수(season) 단위.** `applications.season`과 동일 표기.
- **공개 범위 = 회원 전용 기본, 운영진이 개별 그룹을 공개 토글.** 잘된 건을 선별해 공개 `/projects`에 노출.
- **공개 페이지에 멤버 이름/아바타는 숨김.** 멤버 수만 노출.

## 접근 결정

**신규 `groups` + `group_members` 테이블** (events 재사용 아님). events는 "언제 모이나", groups는 "누가 소속되나"로 관심사가 다르다. events에 억지로 끼우면 "1회성 모임"과 "지속 소속" 두 의미가 한 테이블에 섞여 나중에 더 복잡해진다.

## 데이터 모델

```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('study','project')),
  title text not null,
  description text not null default '',
  season text not null,                     -- applications.season과 동일 표기
  status text not null default 'recruiting'
    check (status in ('recruiting','active','archived')),
  is_public boolean not null default false, -- 운영진이 개별 공개 토글
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id  uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
```

규칙:
- **자가가입 게이트**: `status='recruiting'`일 때만 회원이 join. capacity 있으면 정원 초과 차단.
- **팀장(leader) 컬럼 생략** — "명단 파악"엔 불필요. 필요해지면 `group_members`에 `role` 추가. `// ponytail: 팀장 개념 나중에`

## 화면 & 플로우

### 회원 (`/(member)/groups`)
- 이번 기수 그룹 목록. 카드: type 뱃지(스터디/프로젝트) · 제목 · 설명 · 정원(3/6) · 상태.
- `recruiting`이면 **[가입]**, 소속이면 **[탈퇴]**, 정원 참/`active`면 버튼 비활성.
- 상단에 **"내 소속"** 섹션 먼저.
- `HomeDashboard`에 **"내 스터디·프로젝트"** 요약 카드 한 줄 추가 → 목록 링크.

### 운영진 (`/admin/groups`)
- 목록: 기수·type 필터, 각 행에 제목·상태·**멤버수**·공개여부. → 이게 곧 "확인" 대시보드.
- **[+ 그룹 만들기]**: type·제목·설명·season·정원·상태.
- 그룹 상세: 로스터(멤버 아바타+이름, 운영진이 **개별 제거** 가능) · 상태 변경 · **공개 토글**.

### 공개 (`/projects`)
- 하드코딩 `PROJECTS` 배열 제거 → `is_public=true` 그룹만 실데이터로 노출.
- 카드: type·제목·설명·**멤버 수**(이름 숨김).

### 플로우 요약
```
운영진: 그룹 생성(recruiting) → 회원 자가가입 → 운영진 active 전환(모집 마감)
      → 활동 종료 시 archived → 잘된 건 공개 토글 → /projects 노출
```

## RLS

```sql
-- groups
alter table public.groups enable row level security;
create policy groups_read_member on public.groups for select
  to authenticated using (true);                 -- 로그인 회원 전체
create policy groups_read_public on public.groups for select
  to anon using (is_public = true);              -- 공개 그룹만 비로그인 노출
create policy groups_admin_all on public.groups for all
  to authenticated using (is_admin()) with check (is_admin());

-- group_members
alter table public.group_members enable row level security;
create policy gm_read on public.group_members for select
  to authenticated using (true);
create policy gm_self_join on public.group_members for insert
  to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from groups g
                where g.id = group_id and g.status = 'recruiting')
  );
create policy gm_self_leave on public.group_members for delete
  to authenticated using (user_id = auth.uid());
create policy gm_admin_all on public.group_members for all
  to authenticated using (is_admin()) with check (is_admin());
```

- **정원 초과 차단은 RLS로 표현 어려움** → 자가입은 `join_group(p_group uuid)` **RPC**(security definer)로 count 검사 + insert를 원자적으로 처리. `-- ponytail: 경합 있으면 advisory lock, 동아리 규모라 우선 단순 count`
- 공개 페이지는 이름 숨김이라 `group_members`를 읽지 않는다. 공개 카드의 **멤버 수**는 집계 뷰 또는 RPC로 별도 노출(anon이 gm을 직접 못 읽으므로).

## 통합 (기존 패턴 준수)

- **community seam** (`src/lib/community/`)에 `groups` store 추가: `types.ts` 인터페이스 + `supabase.ts`/`demo.ts` 어댑터. demo 어댑터는 예시 그룹 reads + no-op ops.
- **서버 액션** `src/actions/group.ts`:
  - 운영진: `createGroup` / `updateGroup` / `setGroupPublic` / `removeMember`
  - 회원: `joinGroup` / `leaveGroup`
  - 기존 `member.ts`·`event.ts`와 동일하게 `requireAdmin()` / `isDemoMode()` 가드.
- **타입** `src/lib/types.ts`에 `Group`, `GroupMember`.
- **마이그레이션** `supabase/migrations/0030_groups.sql`.

## 테스트

`tests/groups.test.ts` (기존 tests/ 스타일, 프레임워크 최소):
1. `recruiting` 아닐 때 자가입 거부.
2. 정원 초과 시 `join_group` RPC 거부.
3. `is_public=false` 그룹은 anon select 안 됨.
4. 본인 아닌 행 leave 불가.

## 스코프에서 뺀 것 (YAGNI, 필요 시 추가)

- 팀장/그룹 내 역할
- 진행상황 · 산출물 · 마일스톤 (Notion/GitHub 대체 시도 안 함)
- 포인트/뱃지 연동
- 가입 승인(리더 수락/거절) 플로우
- 공개 페이지 멤버 이름/아바타 노출
