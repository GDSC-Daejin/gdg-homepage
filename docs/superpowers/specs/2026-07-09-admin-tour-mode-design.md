# 어드민 둘러보기 모드 (Tour Mode) 설계

## 배경
어드민 계정으로 로그인했을 때, 사이드바의 라이트/다크/자동 토글 위에 "둘러보기 모드" 컴포넌트를 추가한다. 켜면 모든 어드민 화면(11개 페이지)이 실제 DB 대신 더미데이터로 꽉 찬 상태로 보인다. 데모/스크린샷/온보딩 시연 목적.

## 범위
- 대상: `/admin` 하위 11개 페이지 전체 (대시보드, 회원, 지원서, 이벤트, 출석, 공지, 설문, 문의, 포인트, 예산, 감사 로그)
- 대상 밖: 회원(`/member`)용 페이지, 회원용 서버 액션(`submitApplication`, `submitInquiry`, `submitSurveyResponse` 등)

## 1) 토글 & 상태 저장
- 쿠키 `demo_mode=1`로 온/오프 관리 (탭 이동·새로고침에도 유지).
- `src/lib/demo.ts`
  - `isDemoMode(): Promise<boolean>` — `cookies()`에서 읽기.
- `src/actions/demo.ts`
  - `"use server"` — `setDemoMode(on: boolean)`: 쿠키 set/delete.
- `src/app/admin/TourModeToggle.tsx` (client component)
  - 스위치 형태. 클릭 시 `setDemoMode` 호출 → `router.refresh()`로 현재 화면을 즉시 재렌더링.
  - `admin/layout.tsx`에서 `<ThemeToggle />` 바로 위에 배치.
- 둘러보기 모드가 켜져 있는 동안 어드민 레이아웃 상단(사이드바 or 페이지 상단)에 배너 표시: "둘러보기 모드 · 모든 데이터는 예시입니다" + 즉시 끌 수 있는 버튼.

## 2) 더미데이터 소스
- `src/lib/demoData.ts` 한 파일에 도메인별 하드코딩 더미 데이터셋을 정의:
  - 회원 프로필(활동/휴면/탈퇴 섞어서 ~12명), 지원서(~6건), 이벤트(과거/예정 섞어 ~8개) + 등록/출석, 공지(~5건, 발행/미발행 섞음), 설문(~3개) + 응답, 문의(~5건, 답변/미답변), 포인트 로그 + 뱃지, 예산 항목 + 후원사, 감사 로그(~10건).
  - 값은 고정(하드코딩)이라 매 요청 동일 — 랜덤 불필요.
- 각 어드민 페이지 서버 컴포넌트 최상단에서:
  ```ts
  const demo = await isDemoMode();
  ```
  기존 Supabase 조회 블록을 `if (demo) { ...더미 데이터 대입... } else { ...기존 supabase 쿼리... }`로 분기. 이후 JSX 렌더링 코드는 그대로 재사용(변수명 유지).
- 예시 (`admin/page.tsx` 대시보드): `totalMembers`, `activeMembers`, `upcomingEvents`, `rows`(최근 이벤트), `months`/`joinCountByMonth`(월별 가입 추이), `satisfactionRows`, `rankingRows`를 데모일 때 `demoData.ts`의 고정 값으로 채움.

## 3) 쓰기 액션(폼/버튼) 처리
- 어드민 전용 mutation 함수에서 `requireAdmin()` 직후 데모 체크 추가:
  ```ts
  await requireAdmin();
  if (await isDemoMode()) return {}; // 또는 해당 함수의 성공 형태
  ```
- 실제 DB 호출·`revalidatePath` 생략, 폼은 성공한 것처럼 동작(에러 없이 종료). 페이지는 리로드해도 계속 고정 더미데이터를 보여주므로 "방금 입력한 값이 반영"되지는 않음 — 이건 의도된 단순화.
- 대상 함수 (파일별):
  - `member.ts`: `setMemberRole`, `setMemberStatus`
  - `application.ts`: `reviewApplication`
  - `event.ts`: `createEvent`, `updateEvent`, `deleteEvent`
  - `attendance-admin.ts`: `issueAttendanceCode` → 데모 시 `{ code: "DEMO1234" }`
  - `attendance-warning.ts`: 해당 admin mutation 함수
  - `notice.ts`: `createNotice`, `updateNotice`, `deleteNotice`, `publishNotice` → 데모 시 `{ slack: "슬랙 전송 완료 (예시)" }`
  - `survey.ts`: `createSurvey`, `toggleSurveyOpen`, `deleteSurvey` (`submitSurveyResponse` 제외)
  - `inquiry.ts`: `answerInquiry` (`submitInquiry` 제외)
  - `points.ts`: `grantPoints`, `createBadge`, `deleteBadge`, `awardBadge`
  - `budget.ts`: `createBudgetEntry`, `deleteBudgetEntry`, `createSponsor`, `deleteSponsor`

## 4) 검토했으나 채택하지 않은 방식
- Supabase 클라이언트 자체를 mock(체이닝 흉내)하는 방식: 페이지마다 쿼리 형태(`select`/`count`/`join` 조합)가 제각각이라 범용 mock이 더 복잡해짐. 페이지별 명시적 `if (demo)` 분기가 더 단순하고 예측 가능해 채택하지 않음.

## 테스트/검증
- 어드민으로 로그인 → 둘러보기 모드 On → 11개 페이지 각각 방문해 더미데이터로 채워지는지, 폼 제출이 에러 없이 "성공" 처리되는지 확인.
- 둘러보기 모드 Off → 원래 실제 데이터로 돌아오는지 확인.
- 일반 회원 페이지는 영향 없는지 확인.
