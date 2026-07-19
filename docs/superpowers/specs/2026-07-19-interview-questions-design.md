# 포지션별 면접 질문 은행 — 설계

작성일: 2026-07-19

## 배경 / 목적

면접 시 활용할 **포지션별 면접 질문**을 미리 만들어두고, 자유롭게 추가·수정·삭제할 수 있게 한다. 지원자를 면접할 때 해당 포지션의 질문과 공통 질문을 참고용으로 조회한다.

## 범위 (Scope)

- **포함**: 포지션별 질문 은행 CRUD(관리) + 지원자 상세에서 읽기전용 조회
- **제외**:
  - 지원자별 답변/점수/평가 기록 (질문 은행만)
  - 수동 드래그 재정렬 (초기엔 `created_at` 순, 필요해지면 `sort_order` 추가)

## 데이터 모델

포지션은 기존 `Position` 타입(`frontend | backend | designer | beginner`)을 재사용한다. **공통 질문**은 `position IS NULL`로 표현한다.

### 마이그레이션: `supabase/migrations/0028_interview_questions.sql`

```
interview_questions
  id          uuid    pk default gen_random_uuid()
  position    text    null            -- 'frontend'|'backend'|'designer'|'beginner'|null(공통)
  body        text    not null
  created_by  uuid    references profiles(id)
  created_at  timestamptz default now()
  updated_at  timestamptz default now()

  check (position is null or position in ('frontend','backend','designer','beginner'))
```

- **정렬**: `created_at` 오름차순
- **RLS**: admin 역할만 select/insert/update/delete (기존 admin 정책 패턴 재사용)

## 컴포넌트 / 데이터 흐름

각 단위는 기존 공지(notice) 기능의 구조를 그대로 따른다.

### 1. 서버 액션 — `src/actions/interview-question.ts`

- `createInterviewQuestion(formData)` → insert
- `updateInterviewQuestion(id, formData)` → update
- `deleteInterviewQuestion(id)` → delete
- 모든 액션: `requireAdmin()` + `isDemoMode()` 가드, `toKoreanError`, `revalidatePath("/admin/interview-questions")`
- **입력**: `interviewQuestionSchema` (zod) 신설 — `position`은 4개 enum 또는 null, `body`는 필수(공백 불가)

### 2. 스키마 / 타입

- `src/lib/schemas.ts`: `interviewQuestionSchema` 추가
- `src/lib/types.ts`: `InterviewQuestion` 타입 추가 (`{ id, position: Position | null, body, created_by, created_at, updated_at }`)

### 3. 조회 헬퍼 — `src/lib/interview-questions.ts`

- `getInterviewQuestions(position: Position | null)` → 해당 포지션 + 공통(`position IS NULL`) 질문을 `created_at` 순으로 반환. demo 모드면 `demoData`에서 반환.
- 관리 페이지용으로 전체를 포지션별로 묶어서 반환하는 쿼리도 이 파일에 둔다.

### 4. 관리 페이지 — `src/app/admin/interview-questions/`

- `page.tsx`: 서버 컴포넌트. 전체 질문을 조회해 클라이언트 매니저에 전달.
- `InterviewQuestionManager.tsx`: 클라이언트 컴포넌트 (기존 `BadgeManager` 스타일 참고)
  - 포지션 탭 5개: **프론트엔드 / 백엔드 / 디자이너 / 비기너 / 공통**
  - 탭별: 질문 리스트 + 하단 추가 입력창 + 각 항목 인라인 수정·삭제
- 사이드바(`AdminSidebarNav.tsx`) "운영" 그룹에서 지원자(applications) 인근에 nav 항목 추가

### 5. 지원자 상세 조회 — `src/app/admin/applications/[id]/page.tsx`

- 기존 답변 섹션 아래에 **"면접 질문"** 읽기전용 섹션 추가
- `getInterviewQuestions(app.position)` 결과 표시. `app.position`이 null이면 공통 질문만.
- 편집 불가 — 편집은 관리 페이지에서만.

### 6. Demo 모드

- `src/lib/demoData.ts`에 샘플 질문 배열(`DEMO_INTERVIEW_QUESTIONS`) 추가 — 포지션별 + 공통 몇 개
- mutation 액션은 demo에서 no-op (기존 패턴과 동일)

## 에러 처리

- 폼 검증 실패 → zod 첫 메시지 반환 (기존 `parsed.error.issues[0]?.message` 패턴)
- Supabase 에러 → `toKoreanError`
- 관리 UI: 액션 결과의 `error`를 인라인 표시

## 테스트

- `interviewQuestionSchema` 단위 테스트: 빈 body 거부, position enum/null 허용, 잘못된 position 거부 (기존 `tests/` 스타일)

## 의도적 단순화 (ponytail)

- `sort_order` 없이 `created_at` 순 — 면접관이 재정렬을 원하면 그때 `sort_order` 컬럼 + 위/아래 버튼 추가
- 답변/점수 기록 없음 — 순수 질문 은행
