# 회원 커뮤니티 게시판 (v1) — 설계

## 배경 / 문제

현재 서비스의 모든 소통은 단방향·수직이다: 공지(운영→회원), 설문(운영→회원),
문의(회원→운영). 회원끼리 수평으로 오가는 채널이 하나도 없다. 회원 간 소통 공간을
추가한다.

## 목표 (v1)

세 가지 소통 목적을 **글+댓글이라는 하나의 뼈대**로 덮는다:

1. **자유게시판** — 잡담·정보공유·질문 등 범용
2. **질문답변(Q&A)** — 질문에 회원이 답하고 작성자가 채택
3. **이벤트 중심 대화** — 글을 이벤트에 선택적으로 붙여 이벤트 상세에서 관련 글 노출

## 비목표 (v1에서 제외)

DM/쪽지, 신고 UI, 알림, 포인트 연동, 좋아요·조회수, 첨부·이미지·리치텍스트,
페이지네이션(최신순 + limit로 시작).

## 접근 범위

**회원 전용.** 로그인한 member·team_member·organizer만 읽기/쓰기. applicant 제외,
비로그인 제외.

---

## 화면 (메뉴 2개, 컴포넌트 1세트 공유)

- `(member)/board` — 자유게시판 (`board='free'`)
- `(member)/qna` — 질문답변 (`board='qna'`, 채택 UI 추가)

두 라우트는 동일한 목록/상세/작성 컴포넌트를 공유하고 `board` 값으로만 분기한다.
Q&A 갈래에서만 상세에 "채택" 버튼과 목록의 "해결됨" 뱃지가 추가로 나타난다.

- 이벤트 상세(`(member)/events/[id]`)에 "이 이벤트 관련 글" 섹션 추가
  = `posts where event_id = ?` 조회.
- 사이드바(`(member)/SidebarNav.tsx`)에 메뉴 2개 추가.

### 중복 최소화 방식

목록 행/상세/작성 폼은 `board` prop을 받는 공유 컴포넌트로 구현한다. 라우트 파일은
얇은 래퍼로 각각 `board="free"` / `board="qna"`만 전달한다. Q&A 전용 UI(채택 버튼,
해결됨 뱃지)는 `board === 'qna'` 조건부 렌더로 같은 파일 안에서 처리한다.

---

## 데이터 모델 (테이블 2개)

기존 컨벤션(`gen_random_uuid()`, `timestamptz not null default now()`,
`on delete cascade`, text + check 제약)을 따른다.

```sql
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('free','qna')),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  event_id uuid references public.events(id) on delete set null,
  accepted_comment_id uuid,          -- QnA 채택 답변 (nullable)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `accepted_comment_id`는 FK 순환(posts↔comments)을 피하려고 제약 없는 uuid로 두고,
  값 검증은 채택 RPC 안에서 수행한다. (comment 삭제 시 dangling 가능성은 RPC/조회에서
  방어; v1에선 채택된 답변 삭제를 막는 것으로 충분.)
- body는 plain text + 줄바꿈. 마크다운/HTML 렌더 없음.

---

## 권한 (RLS)

신규 헬퍼:

```sql
create or replace function public.is_member() returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('member','team_member','organizer')
  );
$$ language sql security definer stable;
```

정책:

| 대상 | 동작 | 규칙 |
|---|---|---|
| posts / comments | select | `is_member()` |
| posts / comments | insert | `author_id = auth.uid() and is_member()` |
| posts / comments | update | `author_id = auth.uid()` |
| posts / comments | delete | `author_id = auth.uid() or is_admin()` |

- **staff 강제삭제**: delete에 `is_admin()` 포함 — 신고 UI 없이도 부적절 글/댓글을
  내릴 최소 안전망.
- **채택**: `accepted_comment_id` 직접 update는 허용하지 않고 RPC로만 처리(아래).

### 채택 RPC

```sql
create or replace function public.accept_answer(p_post_id uuid, p_comment_id uuid)
returns void as $$
begin
  update public.posts
    set accepted_comment_id = p_comment_id, updated_at = now()
  where id = p_post_id
    and author_id = auth.uid()          -- 질문 작성자만
    and board = 'qna'
    and exists (select 1 from public.comments
                where id = p_comment_id and post_id = p_post_id);
  if not found then
    raise exception 'accept_answer: not permitted or invalid comment';
  end if;
end;
$$ language plpgsql security definer;
```

채택 해제는 동일 RPC에 `p_comment_id = null` 허용(작성자 본인 검증만) 또는 별도
호출. v1에선 재채택으로 덮어쓰기만 지원하고 명시적 해제는 미룬다.

---

## 서버 액션 / 타입

- **서버 액션** (기존 패턴대로 `use server`, 본인 검증은 RLS에 위임):
  `createPost`, `updatePost`, `deletePost`,
  `createComment`, `deleteComment`,
  `acceptAnswer`(RPC 호출).
- **types.ts**: `BoardType = 'free' | 'qna'`, `Post`, `Comment` 인터페이스 추가.
- **schemas.ts**: zod 스키마 `postSchema`(title/body/board/event_id?),
  `commentSchema`(body) 추가. 기존 스키마·테스트 컨벤션을 따른다.
- **demoData.ts**: 데모용 posts/comments 시드 추가(다른 엔티티와 동일 방식).

---

## 마이그레이션

`supabase/migrations/0021_member_board.sql` 단일 파일:
`is_member()` 함수 → posts/comments 테이블 → RLS enable + 정책 →
`accept_answer` RPC.

---

## 성공 기준

1. 회원이 자유게시판에 글을 쓰고 다른 회원이 댓글을 단다.
2. Q&A에서 질문 작성자가 답변 하나를 채택하면 해결됨으로 표시된다.
3. 이벤트에 연결한 글이 해당 이벤트 상세의 "관련 글" 섹션에 나타난다.
4. applicant/비로그인은 목록·상세에 접근할 수 없다(RLS로 차단).
5. staff가 임의 글/댓글을 삭제할 수 있다.

## 열린 항목 (다음 버전)

신고·모더레이션 UI, 알림, 포인트 연동, 좋아요/조회수, 페이지네이션, 채택 명시 해제.
