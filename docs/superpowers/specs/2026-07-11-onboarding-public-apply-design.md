# 온보딩 필수화 & 공개 지원 설계

작성일: 2026-07-11

## 배경

- 최초 로그인 사용자의 프로필 등록(온보딩)은 이미 구현되어 있으나 이름·포지션만 필수이고 학번·전공·전화번호는 선택이다. 개인정보 4개를 필수로 만든다.
- 지원(apply)은 현재 `(member)` 그룹 안에 있어 OAuth 로그인 후 `applicant` 역할이어야만 가능하다. 로그인 없이 지원 가능한 공개 폼으로 바꾼다.

## 결정 사항 (확정)

1. 온보딩 필수 필드: **이름·학번·전공·전화번호·포지션** 5개. 관심분야는 선택 유지.
2. 지원 구조: **공개 지원만 유지**. 기존 로그인 기반 `applicant` 지원 흐름은 제거.
3. 공개 폼 신원 필드: **이름·학번·전공·전화번호·이메일** + 기존 서술형(자기소개·지원동기·관심분야).
4. 신원 정보 저장: **`applications` 테이블 전용 컬럼**.
5. `profileSchema`: 온보딩·프로필 수정 **공유 유지** (프로필 수정에도 세 필드 필수 적용됨 — 의도된 동작).

---

## 1. 온보딩 필수화

기존 트리거/라우트/리다이렉트는 유지. 필드 필수화만 변경.

- `src/lib/schemas.ts` — `profileSchema`의 `student_no`, `major`, `phone`를 `z.string().min(1, "…")`로 변경. 메시지 예: "학번을 입력해주세요" / "전공을 입력해주세요" / "전화번호를 입력해주세요". `name`·`position`은 이미 필수.
- `src/app/(member)/onboarding/OnboardingForm.tsx` — 학번·전공·전화번호 `Input`에 `required` 추가.
- `tests/schemas.test.ts` — 세 필드 빈 값 거부 케이스 반영.

새 파일 없음. `profileSchema` 공유로 인해 프로필 수정 페이지에서도 세 필드가 필수가 된다(의도).

## 2. 공개 지원

### 2.1 라우트 이동
- `src/app/(member)/apply/` → `src/app/apply/`로 이동. `(member)` 레이아웃(`requireProfile`) 밖으로 나와 로그인 불필요.
- 공개 페이지는 인증을 확인하지 않고 항상 지원 폼을 렌더. 익명이라 "이미 지원함" 추적 불가 → 제출 성공 후 "지원 완료" 상태 화면 표시.

### 2.2 DB 마이그레이션 (`supabase/migrations/0010_public_application.sql`)
- `applications.applicant_id` → **nullable** (`drop not null`).
- 컬럼 추가: `applicant_name text`, `student_no text`, `major text`, `phone text`, `email text`.
- 기존 `unique (applicant_id, season)` 제거, `unique (email, season)` 추가 (같은 이메일 시즌 중복 지원 차단).
- RLS: `anon` 역할에 insert 허용. 조건 `applicant_id is null` (익명 제출만 허용, 회원 사칭 방지). 기존 select 정책(`applicant_id = auth.uid() or is_admin()`)은 admin이 계속 전체 조회 가능하므로 유지.

### 2.3 서버 액션 (`src/actions/application.ts`)
- `submitApplication`: 인증/역할 체크 제거. `applicationSchema`로 신원 5필드 + 답변 3필드 파싱. `applicant_id: null`로 insert. 이메일 중복(`23505`) 시 "이미 지원한 이메일이에요" 반환.
- `reviewApplication`은 변경 없음.

### 2.4 스키마 (`src/lib/schemas.ts`)
- `applicationSchema`에 신원 필드 추가: `applicant_name`(min 1), `student_no`(min 1), `major`(min 1), `phone`(min 1), `email`(z.email 또는 min 1 + 형식), `season`, `answers`.

### 2.5 폼 (`src/app/apply/ApplyForm.tsx`)
- 상단에 이름·학번·전공·전화번호·이메일 `Input` 추가(모두 required), 이어서 기존 서술형 3개 `Textarea`.
- 제출 성공 시 폼을 "지원 완료" 메시지로 교체.

### 2.6 관리자 심사 페이지 (`src/app/admin/applications/`)
- 지원자 정보를 `profiles` 조인 대신 `applications` 행의 신규 컬럼에서 읽도록 수정.
- `page.tsx`의 applicant_id → profiles 조회 블록 제거, 컬럼 직접 사용.
- `ApplicationCard`에서 이름·학번·전공·전화·이메일을 행 컬럼 기준으로 표시.
- 데모 데이터(`DEMO_APPLICATIONS`/`DEMO_APPLICANTS`)도 새 형태에 맞게 조정.

### 2.7 제거
- 기존 `(member)/apply` 디렉토리.
- 사이드바(`SidebarNav`)의 지원 링크(회원용).
- `submitApplication`의 `applicant` 역할 분기.

---

## 스코프 밖

- **합격→멤버 전환**: 익명 지원 합격 후 계정 생성/초대 흐름은 이번 범위 밖. 관리자가 지원서 이메일로 개별 안내.
- **가입 정책 정리**: `handle_new_user`의 기본 `applicant` 역할은 DB에 남지만 앱에서 더는 지원에 쓰이지 않음. 누가 OAuth 가입 가능한지 정리는 별도 작업.

## 검증 기준

- 온보딩: 학번·전공·전화 중 하나라도 비우면 저장 실패(서버 검증 + 브라우저 required).
- 공개 지원: 비로그인 상태로 `/apply` 접근·제출 성공. 같은 이메일 재제출 시 차단.
- 관리자: `/admin/applications`에서 익명 지원자의 이름·이메일·학번·전공·전화 표시.
- `tests/schemas.test.ts` 통과.
