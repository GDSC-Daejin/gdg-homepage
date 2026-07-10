# 어드민 둘러보기 모드 (Tour Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 로그인 시 사이드바 라이트/다크 토글 위에 "둘러보기 모드" 스위치를 추가하고, 켜면 11개 어드민 페이지 전체가 고정 더미데이터로 채워지며 폼 제출도 (실제 DB 반영 없이) 성공한 것처럼 동작하게 만든다.

**Architecture:** 쿠키(`demo_mode=1`)로 온/오프 상태를 저장한다. 서버 컴포넌트 페이지는 `isDemoMode()`를 읽어 데모용 변수 기본값을 먼저 선언하고, 데모가 아닐 때만 기존 Supabase 조회 블록을 실행해 그 변수를 덮어쓴다(JSX 렌더링 코드는 그대로 유지). 어드민 전용 mutation 서버 액션은 `requireAdmin()` 직후 데모 체크를 넣어 실제 DB 호출 없이 성공 응답을 반환한다.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), TypeScript strict, `next/headers` cookies, Vitest(단, 이 기능은 대부분 정적 데이터/서버 컴포넌트라 유닛 테스트 대상이 거의 없음).

## Global Constraints

- 대상 범위는 `/admin` 하위 11개 페이지(대시보드, 회원 목록/상세, 지원서, 이벤트 목록/상세, 출석, 공지 목록/상세, 설문 목록/생성/결과, 문의, 포인트, 예산, 감사 로그) 전체. 회원(`/member`)용 페이지와 회원용 서버 액션(`submitApplication`, `submitInquiry`, `submitSurveyResponse`)은 손대지 않는다.
- 쿠키 이름은 `demo_mode`, 값 `"1"`일 때만 활성. 쿠키 조작은 `src/lib/demo.ts`(읽기)와 `src/actions/demo.ts`(쓰기) 두 곳으로만 한정한다.
- 이 프로젝트는 `vitest run`으로 테스트하며, 기존 테스트는 순수 함수(`src/lib/format.ts`)에만 존재한다(`tests/format.test.ts`). 이 계획의 산출물은 정적 데이터 정의와 서버 컴포넌트/액션 분기라 자동 테스트 대상이 거의 없다 — 각 태스크의 "테스트" 단계는 `npx tsc --noEmit`(타입 체크)와 브라우저 수동 확인으로 대체한다. 새로 순수 로직을 추가하는 태스크(없음)가 생기면 그때만 vitest 테스트를 추가한다.
- 모든 더미데이터는 `src/lib/demoData.ts` 한 파일에 하드코딩한다(랜덤 없음, 매 요청 동일).
- 페이지 파일의 기존 JSX/렌더링 코드는 그대로 두고, 데이터 소스 부분만 `let` 선언 + `if (!demo) { ...기존 코드... }`로 감싼다.

---

### Task 1: 데모 모드 코어 (쿠키 읽기/쓰기)

**Files:**
- Create: `src/lib/demo.ts`
- Create: `src/actions/demo.ts`

**Interfaces:**
- Produces: `isDemoMode(): Promise<boolean>` (모든 페이지·액션이 이걸로 데모 여부 확인), `DEMO_MODE_COOKIE: string`, `setDemoMode(on: boolean): Promise<void>` (서버 액션, 클라이언트 토글이 호출)

- [ ] **Step 1: `src/lib/demo.ts` 작성**

```ts
import { cookies } from "next/headers";

export const DEMO_MODE_COOKIE = "demo_mode";

export async function isDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_MODE_COOKIE)?.value === "1";
}
```

- [ ] **Step 2: `src/actions/demo.ts` 작성**

```ts
"use server";

import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { DEMO_MODE_COOKIE } from "@/lib/demo";

export async function setDemoMode(on: boolean): Promise<void> {
  await requireAdmin();
  const store = await cookies();
  if (on) {
    store.set(DEMO_MODE_COOKIE, "1", { path: "/" });
  } else {
    store.delete(DEMO_MODE_COOKIE);
  }
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (두 파일과 관련된 에러 없음)

- [ ] **Step 4: Commit**

```bash
git add src/lib/demo.ts src/actions/demo.ts
git commit -m "feat: 둘러보기 모드 쿠키 읽기/쓰기 추가"
```

---

### Task 2: 더미데이터 세트 (`demoData.ts`)

**Files:**
- Create: `src/lib/demoData.ts`

**Interfaces:**
- Consumes: `Profile, Event, Application, Notice, Survey, SurveyResponse, Inquiry, PointLog, Badge, BudgetEntry, Sponsor` 타입 (from `@/lib/types`)
- Produces (아래 export들을 이후 모든 페이지 태스크가 그대로 사용한다 — 이름·형태를 바꾸지 말 것):
  - `DEMO_MEMBERS: Profile[]` (10명)
  - `DEMO_EVENTS: Event[]` (8개, `demo-e3`~`demo-e7` 5개가 과거, `demo-e1`~`demo-e2`가 미래)
  - `DEMO_DASHBOARD_STATS: { totalMembers: number; activeMembers: number; upcomingEvents: number }`
  - `DEMO_DASHBOARD_ROWS: { id: string; title: string; type: EventType; starts_at: string; confirmed: number; attended: number; rate: number | null }[]`
  - `DEMO_DASHBOARD_JOIN_COUNTS: number[]` (길이 6)
  - `DEMO_DASHBOARD_SATISFACTION: { id: string; title: string; count: number; avg: number }[]`
  - `DEMO_DASHBOARD_RANKING: { rank: number; id: string; name: string; total: number }[]`
  - `DEMO_MEMBER_ATTENDANCE: Record<string, { id: string; checked_at: string; events: { id: string; title: string; starts_at: string } | null }[]>`
  - `DEMO_APPLICATION_SEASONS: string[]`
  - `DEMO_APPLICATIONS: Application[]`
  - `DEMO_APPLICANTS: Record<string, { id: string; name: string; student_no: string; major: string }>`
  - `DEMO_EVENT_CONFIRMED_COUNTS: Record<string, number>`
  - `DEMO_ATTENDANCE_ROWS: { member: Profile; confirmed: number; attended: number; rate: number | null }[]`
  - `DEMO_NOTICES: Notice[]`
  - `DEMO_SURVEYS: Survey[]`
  - `DEMO_SURVEY_RESPONSE_COUNTS: Record<string, number>`
  - `DEMO_SURVEY_RESPONSES: Record<string, SurveyResponse[]>`
  - `DEMO_SURVEY_EVENT_OPTIONS: Pick<Event, "id" | "title">[]`
  - `DEMO_INQUIRIES: Inquiry[]`
  - `DEMO_INQUIRY_AUTHORS: Record<string, { id: string; name: string }>`
  - `DEMO_BADGES: Badge[]`
  - `DEMO_POINT_LOGS: PointLog[]`
  - `DEMO_BUDGET_ENTRIES: BudgetEntry[]`
  - `DEMO_SPONSORS: Sponsor[]`
  - `DEMO_AUDIT_LOGS: { id: number; actor: string | null; action: string; target: string | null; detail: Record<string, unknown>; created_at: string; profiles: { name: string } | null }[]`

- [ ] **Step 1: `src/lib/demoData.ts` 작성**

```ts
import type {
  Profile,
  Event,
  EventType,
  Application,
  Notice,
  Survey,
  SurveyResponse,
  Inquiry,
  PointLog,
  Badge,
  BudgetEntry,
  Sponsor,
} from "@/lib/types";

export const DEMO_MEMBERS: Profile[] = [
  { id: "demo-m1", name: "김도윤", student_no: "20231234", major: "컴퓨터공학과", phone: "010-1111-1111", interests: ["백엔드", "클라우드"], role: "admin", status: "active", joined_at: "2023-02-01T00:00:00.000Z" },
  { id: "demo-m2", name: "이서연", student_no: "20221111", major: "소프트웨어학과", phone: "010-1111-1112", interests: ["프론트엔드", "디자인"], role: "admin", status: "active", joined_at: "2022-03-01T00:00:00.000Z" },
  { id: "demo-m3", name: "박지훈", student_no: "20241111", major: "정보통신공학과", phone: "010-1111-1113", interests: ["안드로이드"], role: "member", status: "active", joined_at: "2024-03-01T00:00:00.000Z" },
  { id: "demo-m4", name: "최유나", student_no: "20241234", major: "컴퓨터공학과", phone: "010-1111-1114", interests: ["iOS", "UX"], role: "member", status: "active", joined_at: "2024-03-01T00:00:00.000Z" },
  { id: "demo-m5", name: "정민준", student_no: "20241999", major: "산업공학과", phone: "010-1111-1115", interests: ["데이터"], role: "member", status: "active", joined_at: "2024-09-01T00:00:00.000Z" },
  { id: "demo-m6", name: "한소희", student_no: "20251111", major: "컴퓨터공학과", phone: "010-1111-1116", interests: ["AI"], role: "member", status: "active", joined_at: "2025-03-01T00:00:00.000Z" },
  { id: "demo-m7", name: "오지훈", student_no: "20231999", major: "전자공학과", phone: "010-1111-1117", interests: ["임베디드"], role: "member", status: "dormant", joined_at: "2023-09-01T00:00:00.000Z" },
  { id: "demo-m8", name: "배수아", student_no: "20221999", major: "경영학과", phone: "010-1111-1118", interests: ["기획"], role: "member", status: "dormant", joined_at: "2022-09-01T00:00:00.000Z" },
  { id: "demo-m9", name: "강하늘", student_no: "20220111", major: "컴퓨터공학과", phone: "010-1111-1119", interests: [], role: "member", status: "withdrawn", joined_at: "2022-03-01T00:00:00.000Z" },
  { id: "demo-m10", name: "윤태경", student_no: "20230111", major: "수학과", phone: "010-1111-1120", interests: [], role: "member", status: "withdrawn", joined_at: "2023-03-01T00:00:00.000Z" },
];

export const DEMO_EVENTS: Event[] = [
  { id: "demo-e1", type: "devfest", title: "DevFest DJU 2026", description: "연말 데브페스트, 트랙별 세션과 네트워킹", starts_at: "2026-08-20T05:00:00.000Z", location: "대전 컨벤션센터", speaker: "GDG DJU 운영진", capacity: 200, created_by: "demo-m1", created_at: "2026-06-01T00:00:00.000Z" },
  { id: "demo-e2", type: "study", title: "Next.js 스터디 6기", description: "App Router 기반 실전 프로젝트 스터디", starts_at: "2026-07-25T10:00:00.000Z", location: "온라인", speaker: "이서연", capacity: 30, created_by: "demo-m2", created_at: "2026-06-15T00:00:00.000Z" },
  { id: "demo-e3", type: "session", title: "React 19 세션", description: "React 19 신규 기능과 마이그레이션 가이드", starts_at: "2026-06-10T09:00:00.000Z", location: "공학관 401호", speaker: "김도윤", capacity: 60, created_by: "demo-m1", created_at: "2026-05-20T00:00:00.000Z" },
  { id: "demo-e4", type: "study", title: "클라우드 스터디 3기", description: "AWS 기초부터 배포까지", starts_at: "2026-05-15T09:00:00.000Z", location: "공학관 302호", speaker: "박지훈", capacity: 30, created_by: "demo-m1", created_at: "2026-04-20T00:00:00.000Z" },
  { id: "demo-e5", type: "session", title: "AI 세션", description: "LLM 기반 서비스 개발 사례 공유", starts_at: "2026-04-20T09:00:00.000Z", location: "공학관 401호", speaker: "한소희", capacity: 60, created_by: "demo-m2", created_at: "2026-03-25T00:00:00.000Z" },
  { id: "demo-e6", type: "study", title: "알고리즘 스터디 2기", description: "코딩 테스트 대비 알고리즘 스터디", starts_at: "2026-03-10T09:00:00.000Z", location: "공학관 302호", speaker: "정민준", capacity: 25, created_by: "demo-m1", created_at: "2026-02-15T00:00:00.000Z" },
  { id: "demo-e7", type: "session", title: "신입 회원 OT", description: "동아리 소개 및 신입 회원 오리엔테이션", starts_at: "2026-02-15T09:00:00.000Z", location: "학생회관 대강당", speaker: "김도윤", capacity: 100, created_by: "demo-m1", created_at: "2026-01-20T00:00:00.000Z" },
  { id: "demo-e8", type: "session", title: "DevFest 회고 세션", description: "지난 데브페스트 회고 및 다음 시즌 준비", starts_at: "2026-01-10T09:00:00.000Z", location: "공학관 401호", speaker: "이서연", capacity: 60, created_by: "demo-m2", created_at: "2025-12-20T00:00:00.000Z" },
];

export const DEMO_DASHBOARD_STATS = {
  totalMembers: 8,
  activeMembers: 4,
  upcomingEvents: 2,
};

export const DEMO_DASHBOARD_ROWS: {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  confirmed: number;
  attended: number;
  rate: number | null;
}[] = [
  { id: "demo-e3", title: "React 19 세션", type: "session", starts_at: "2026-06-10T09:00:00.000Z", confirmed: 40, attended: 35, rate: 0.875 },
  { id: "demo-e4", title: "클라우드 스터디 3기", type: "study", starts_at: "2026-05-15T09:00:00.000Z", confirmed: 30, attended: 22, rate: 0.7333333333333333 },
  { id: "demo-e5", title: "AI 세션", type: "session", starts_at: "2026-04-20T09:00:00.000Z", confirmed: 50, attended: 44, rate: 0.88 },
  { id: "demo-e6", title: "알고리즘 스터디 2기", type: "study", starts_at: "2026-03-10T09:00:00.000Z", confirmed: 25, attended: 15, rate: 0.6 },
  { id: "demo-e7", title: "신입 회원 OT", type: "session", starts_at: "2026-02-15T09:00:00.000Z", confirmed: 60, attended: 58, rate: 0.9666666666666667 },
];

export const DEMO_DASHBOARD_JOIN_COUNTS = [1, 2, 1, 3, 2, 4];

export const DEMO_DASHBOARD_SATISFACTION = [
  { id: "demo-e7", title: "신입 회원 OT", count: 42, avg: 4.6 },
  { id: "demo-e5", title: "AI 세션", count: 30, avg: 4.3 },
  { id: "demo-e3", title: "React 19 세션", count: 28, avg: 4.1 },
];

export const DEMO_DASHBOARD_RANKING = [
  { rank: 1, id: "demo-m6", name: "한소희", total: 320 },
  { rank: 2, id: "demo-m3", name: "박지훈", total: 280 },
  { rank: 3, id: "demo-m4", name: "최유나", total: 260 },
  { rank: 4, id: "demo-m5", name: "정민준", total: 210 },
  { rank: 5, id: "demo-m1", name: "김도윤", total: 190 },
  { rank: 6, id: "demo-m2", name: "이서연", total: 170 },
  { rank: 7, id: "demo-m7", name: "오지훈", total: 90 },
  { rank: 8, id: "demo-m8", name: "배수아", total: 60 },
];

export const DEMO_MEMBER_ATTENDANCE: Record<
  string,
  { id: string; checked_at: string; events: { id: string; title: string; starts_at: string } | null }[]
> = {
  "demo-m1": [
    { id: "demo-a1", checked_at: "2026-06-10T09:05:00.000Z", events: { id: "demo-e3", title: "React 19 세션", starts_at: "2026-06-10T09:00:00.000Z" } },
    { id: "demo-a2", checked_at: "2026-02-15T09:03:00.000Z", events: { id: "demo-e7", title: "신입 회원 OT", starts_at: "2026-02-15T09:00:00.000Z" } },
  ],
  "demo-m3": [
    { id: "demo-a3", checked_at: "2026-06-10T09:02:00.000Z", events: { id: "demo-e3", title: "React 19 세션", starts_at: "2026-06-10T09:00:00.000Z" } },
    { id: "demo-a4", checked_at: "2026-05-15T09:04:00.000Z", events: { id: "demo-e4", title: "클라우드 스터디 3기", starts_at: "2026-05-15T09:00:00.000Z" } },
    { id: "demo-a5", checked_at: "2026-04-20T09:01:00.000Z", events: { id: "demo-e5", title: "AI 세션", starts_at: "2026-04-20T09:00:00.000Z" } },
  ],
};

export const DEMO_APPLICATION_SEASONS = ["2026-1", "2025-2"];

export const DEMO_APPLICATIONS: Application[] = [
  { id: "demo-ap1", applicant_id: "demo-ap-user-1", season: "2026-1", answers: { intro: "안녕하세요, 컴퓨터공학과 24학번 김하은입니다.", motivation: "웹 개발을 실전 프로젝트로 배우고 싶어 지원했습니다.", interest: "프론트엔드" }, status: "pending", reviewed_by: null, reviewed_at: null, created_at: "2026-07-01T00:00:00.000Z" },
  { id: "demo-ap2", applicant_id: "demo-ap-user-2", season: "2026-1", answers: { intro: "소프트웨어학과 23학번 이준서입니다.", motivation: "백엔드 개발 역량을 키우고 싶습니다.", interest: "백엔드" }, status: "pending", reviewed_by: null, reviewed_at: null, created_at: "2026-07-02T00:00:00.000Z" },
  { id: "demo-ap3", applicant_id: "demo-ap-user-3", season: "2026-1", answers: { intro: "정보통신공학과 24학번 최지우입니다.", motivation: "동아리 활동을 통해 팀 프로젝트 경험을 쌓고 싶습니다.", interest: "안드로이드" }, status: "accepted", reviewed_by: "demo-m1", reviewed_at: "2026-07-03T00:00:00.000Z", created_at: "2026-06-28T00:00:00.000Z" },
  { id: "demo-ap4", applicant_id: "demo-ap-user-4", season: "2026-1", answers: { intro: "전자공학과 22학번 한서준입니다.", motivation: "임베디드와 웹을 함께 다뤄보고 싶습니다.", interest: "임베디드" }, status: "rejected", reviewed_by: "demo-m2", reviewed_at: "2026-07-03T00:00:00.000Z", created_at: "2026-06-29T00:00:00.000Z" },
  { id: "demo-ap5", applicant_id: "demo-ap-user-5", season: "2025-2", answers: { intro: "경영학과 23학번 정예린입니다.", motivation: "IT 동아리 경험을 통해 시야를 넓히고 싶습니다.", interest: "기획" }, status: "accepted", reviewed_by: "demo-m1", reviewed_at: "2025-09-05T00:00:00.000Z", created_at: "2025-09-01T00:00:00.000Z" },
  { id: "demo-ap6", applicant_id: "demo-ap-user-6", season: "2025-2", answers: { intro: "수학과 24학번 임도현입니다.", motivation: "알고리즘 스터디에 참여하고 싶습니다.", interest: "AI" }, status: "rejected", reviewed_by: "demo-m2", reviewed_at: "2025-09-05T00:00:00.000Z", created_at: "2025-09-02T00:00:00.000Z" },
];

export const DEMO_APPLICANTS: Record<
  string,
  { id: string; name: string; student_no: string; major: string }
> = {
  "demo-ap-user-1": { id: "demo-ap-user-1", name: "김하은", student_no: "20241001", major: "컴퓨터공학과" },
  "demo-ap-user-2": { id: "demo-ap-user-2", name: "이준서", student_no: "20231002", major: "소프트웨어학과" },
  "demo-ap-user-3": { id: "demo-ap-user-3", name: "최지우", student_no: "20241003", major: "정보통신공학과" },
  "demo-ap-user-4": { id: "demo-ap-user-4", name: "한서준", student_no: "20221004", major: "전자공학과" },
  "demo-ap-user-5": { id: "demo-ap-user-5", name: "정예린", student_no: "20231005", major: "경영학과" },
  "demo-ap-user-6": { id: "demo-ap-user-6", name: "임도현", student_no: "20241006", major: "수학과" },
};

export const DEMO_EVENT_CONFIRMED_COUNTS: Record<string, number> = {
  "demo-e1": 120,
  "demo-e2": 28,
  "demo-e3": 40,
  "demo-e4": 30,
  "demo-e5": 50,
  "demo-e6": 25,
  "demo-e7": 60,
  "demo-e8": 45,
};

export const DEMO_ATTENDANCE_ROWS: {
  member: Profile;
  confirmed: number;
  attended: number;
  rate: number | null;
}[] = [
  { member: DEMO_MEMBERS[2], confirmed: 5, attended: 5, rate: 1 },
  { member: DEMO_MEMBERS[3], confirmed: 5, attended: 4, rate: 0.8 },
  { member: DEMO_MEMBERS[4], confirmed: 4, attended: 3, rate: 0.75 },
  { member: DEMO_MEMBERS[5], confirmed: 5, attended: 2, rate: 0.4 },
];

export const DEMO_NOTICES: Notice[] = [
  { id: "demo-n1", title: "2026년 하계 정기 모임 안내", body: "안녕하세요, GDG DJU입니다. 하계 정기 모임 일정을 안내드립니다.", published: true, published_at: "2026-07-05T00:00:00.000Z", created_by: "demo-m1", created_at: "2026-07-04T00:00:00.000Z" },
  { id: "demo-n2", title: "DevFest DJU 2026 스태프 모집", body: "8월 데브페스트 운영진을 모집합니다. 관심 있는 분은 신청해주세요.", published: true, published_at: "2026-06-20T00:00:00.000Z", created_by: "demo-m2", created_at: "2026-06-18T00:00:00.000Z" },
  { id: "demo-n3", title: "동아리방 이용 규칙 변경 안내", body: "동아리방 이용 시간이 오전 9시부터 오후 10시로 변경됩니다.", published: true, published_at: "2026-05-01T00:00:00.000Z", created_by: "demo-m1", created_at: "2026-04-28T00:00:00.000Z" },
  { id: "demo-n4", title: "2026-2 시즌 지원서 양식 초안", body: "다음 시즌 지원서 문항 초안입니다. 검토 부탁드립니다.", published: false, published_at: null, created_by: "demo-m2", created_at: "2026-07-08T00:00:00.000Z" },
  { id: "demo-n5", title: "알고리즘 스터디 2기 모집 마감", body: "알고리즘 스터디 2기 모집이 마감되었습니다. 참여해주신 분들 감사합니다.", published: true, published_at: "2026-03-05T00:00:00.000Z", created_by: "demo-m1", created_at: "2026-03-04T00:00:00.000Z" },
];

export const DEMO_SURVEYS: Survey[] = [
  {
    id: "demo-s1",
    title: "React 19 세션 만족도 조사",
    event_id: "demo-e3",
    questions: [
      { id: "q1", type: "rating", label: "세션 전반에 대한 만족도를 평가해주세요" },
      { id: "q2", type: "text", label: "개선했으면 하는 점을 자유롭게 남겨주세요" },
    ],
    is_open: false,
    created_at: "2026-06-10T10:00:00.000Z",
  },
  {
    id: "demo-s2",
    title: "신입 회원 OT 만족도 조사",
    event_id: "demo-e7",
    questions: [
      { id: "q1", type: "rating", label: "OT는 도움이 되었나요?" },
      { id: "q2", type: "text", label: "더 알고 싶은 내용이 있다면 남겨주세요" },
    ],
    is_open: false,
    created_at: "2026-02-15T10:00:00.000Z",
  },
  {
    id: "demo-s3",
    title: "동아리 운영 방식 의견 수렴",
    event_id: null,
    questions: [{ id: "q1", type: "text", label: "동아리 운영에 바라는 점을 자유롭게 적어주세요" }],
    is_open: true,
    created_at: "2026-07-01T00:00:00.000Z",
  },
];

export const DEMO_SURVEY_RESPONSE_COUNTS: Record<string, number> = {
  "demo-s1": 28,
  "demo-s2": 42,
  "demo-s3": 6,
};

export const DEMO_SURVEY_RESPONSES: Record<string, SurveyResponse[]> = {
  "demo-s1": [
    { id: "demo-sr1", survey_id: "demo-s1", user_id: "demo-m3", answers: { q1: 5, q2: "발표 자료가 알차서 좋았어요." }, created_at: "2026-06-11T00:00:00.000Z" },
    { id: "demo-sr2", survey_id: "demo-s1", user_id: "demo-m4", answers: { q1: 4, q2: "질의응답 시간이 조금 더 있었으면 좋겠어요." }, created_at: "2026-06-11T01:00:00.000Z" },
    { id: "demo-sr3", survey_id: "demo-s1", user_id: "demo-m5", answers: { q1: 4, q2: "" }, created_at: "2026-06-11T02:00:00.000Z" },
    { id: "demo-sr4", survey_id: "demo-s1", user_id: "demo-m6", answers: { q1: 3, q2: "속도가 조금 빨랐어요." }, created_at: "2026-06-11T03:00:00.000Z" },
  ],
  "demo-s2": [
    { id: "demo-sr5", survey_id: "demo-s2", user_id: "demo-m3", answers: { q1: 5, q2: "동아리 소개가 명확해서 좋았습니다." }, created_at: "2026-02-16T00:00:00.000Z" },
    { id: "demo-sr6", survey_id: "demo-s2", user_id: "demo-m4", answers: { q1: 5, q2: "" }, created_at: "2026-02-16T01:00:00.000Z" },
    { id: "demo-sr7", survey_id: "demo-s2", user_id: "demo-m5", answers: { q1: 4, q2: "선배들과의 네트워킹 시간이 좋았어요." }, created_at: "2026-02-16T02:00:00.000Z" },
  ],
  "demo-s3": [
    { id: "demo-sr8", survey_id: "demo-s3", user_id: "demo-m7", answers: { q1: "스터디 종류가 더 다양해졌으면 좋겠습니다." }, created_at: "2026-07-02T00:00:00.000Z" },
  ],
};

export const DEMO_SURVEY_EVENT_OPTIONS: Pick<Event, "id" | "title">[] = DEMO_EVENTS.map(
  ({ id, title }) => ({ id, title }),
);

export const DEMO_INQUIRIES: Inquiry[] = [
  { id: "demo-iq1", user_id: "demo-m3", title: "포인트는 어떻게 적립되나요?", body: "세션 참여 외에 포인트를 받을 수 있는 방법이 궁금합니다.", status: "answered", answer: "스터디 발표, 운영 봉사 등에도 포인트가 부여돼요. 자세한 기준은 공지사항을 참고해주세요.", answered_by: "demo-m1", answered_at: "2026-07-03T00:00:00.000Z", created_at: "2026-07-02T00:00:00.000Z" },
  { id: "demo-iq2", user_id: "demo-m5", title: "동아리방 예약은 어떻게 하나요?", body: "스터디 목적으로 동아리방을 예약하고 싶습니다.", status: "pending", answer: null, answered_by: null, answered_at: null, created_at: "2026-07-07T00:00:00.000Z" },
  { id: "demo-iq3", user_id: "demo-m6", title: "휴면 회원 전환 문의", body: "이번 학기 휴학으로 휴면 회원 전환을 요청드립니다.", status: "pending", answer: null, answered_by: null, answered_at: null, created_at: "2026-07-08T00:00:00.000Z" },
  { id: "demo-iq4", user_id: "demo-m4", title: "지난 세션 자료를 다시 받고 싶어요", body: "AI 세션 자료 링크가 만료된 것 같습니다.", status: "answered", answer: "자료 링크를 갱신해서 공지사항에 다시 올려드렸어요.", answered_by: "demo-m2", answered_at: "2026-04-22T00:00:00.000Z", created_at: "2026-04-21T00:00:00.000Z" },
  { id: "demo-iq5", user_id: "demo-m7", title: "복귀 절차가 궁금합니다", body: "휴면 상태인데 다시 활동하고 싶습니다. 어떻게 해야 하나요?", status: "pending", answer: null, answered_by: null, answered_at: null, created_at: "2026-07-09T00:00:00.000Z" },
];

export const DEMO_INQUIRY_AUTHORS: Record<string, { id: string; name: string }> = {
  "demo-m3": { id: "demo-m3", name: "박지훈" },
  "demo-m4": { id: "demo-m4", name: "최유나" },
  "demo-m5": { id: "demo-m5", name: "정민준" },
  "demo-m6": { id: "demo-m6", name: "한소희" },
  "demo-m7": { id: "demo-m7", name: "오지훈" },
};

export const DEMO_BADGES: Badge[] = [
  { id: "demo-b1", name: "개근왕", description: "모든 세션에 출석한 회원", icon: "🏅" },
  { id: "demo-b2", name: "발표왕", description: "스터디 발표를 3회 이상 진행", icon: "🎤" },
  { id: "demo-b3", name: "운영진", description: "동아리 운영에 기여한 회원", icon: "🛠️" },
  { id: "demo-b4", name: "신입 우수상", description: "신입 회원 중 활동이 두드러진 회원", icon: "🌱" },
];

export const DEMO_POINT_LOGS: PointLog[] = [
  { id: "demo-pl1", user_id: "demo-m6", amount: 50, reason: "React 19 세션 발표", ref_event: "demo-e3", created_by: "demo-m1", created_at: "2026-06-10T12:00:00.000Z" },
  { id: "demo-pl2", user_id: "demo-m3", amount: 30, reason: "세션 출석", ref_event: "demo-e3", created_by: "demo-m1", created_at: "2026-06-10T11:00:00.000Z" },
  { id: "demo-pl3", user_id: "demo-m4", amount: 30, reason: "세션 출석", ref_event: "demo-e5", created_by: "demo-m2", created_at: "2026-04-20T11:00:00.000Z" },
  { id: "demo-pl4", user_id: "demo-m5", amount: 40, reason: "스터디 운영", ref_event: "demo-e6", created_by: "demo-m1", created_at: "2026-03-10T11:00:00.000Z" },
  { id: "demo-pl5", user_id: "demo-m1", amount: 60, reason: "OT 진행", ref_event: "demo-e7", created_by: "demo-m1", created_at: "2026-02-15T11:00:00.000Z" },
  { id: "demo-pl6", user_id: "demo-m2", amount: 40, reason: "OT 보조 진행", ref_event: "demo-e7", created_by: "demo-m1", created_at: "2026-02-15T11:30:00.000Z" },
  { id: "demo-pl7", user_id: "demo-m7", amount: -20, reason: "3회 연속 결석", ref_event: null, created_by: "demo-m1", created_at: "2026-05-01T00:00:00.000Z" },
  { id: "demo-pl8", user_id: "demo-m6", amount: 30, reason: "알고리즘 스터디 발표", ref_event: "demo-e6", created_by: "demo-m1", created_at: "2026-03-10T12:00:00.000Z" },
  { id: "demo-pl9", user_id: "demo-m3", amount: 20, reason: "클라우드 스터디 참여", ref_event: "demo-e4", created_by: "demo-m1", created_at: "2026-05-15T12:00:00.000Z" },
  { id: "demo-pl10", user_id: "demo-m8", amount: 10, reason: "설문 응답", ref_event: null, created_by: "demo-m2", created_at: "2026-06-01T00:00:00.000Z" },
];

export const DEMO_BUDGET_ENTRIES: BudgetEntry[] = [
  { id: "demo-be1", entry_date: "2026-07-01", type: "income", category: "회비", amount: 300000, memo: "2026-1 회비 납부", created_by: "demo-m1", created_at: "2026-07-01T00:00:00.000Z" },
  { id: "demo-be2", entry_date: "2026-06-20", type: "expense", category: "간식", amount: 85000, memo: "정기 모임 간식비", created_by: "demo-m2", created_at: "2026-06-20T00:00:00.000Z" },
  { id: "demo-be3", entry_date: "2026-06-10", type: "expense", category: "대관료", amount: 120000, memo: "세션 장소 대관", created_by: "demo-m1", created_at: "2026-06-10T00:00:00.000Z" },
  { id: "demo-be4", entry_date: "2026-05-15", type: "expense", category: "인쇄", amount: 40000, memo: "스터디 자료 인쇄", created_by: "demo-m2", created_at: "2026-05-15T00:00:00.000Z" },
  { id: "demo-be5", entry_date: "2026-04-01", type: "income", category: "후원금", amount: 500000, memo: "스폰서 후원금 입금", created_by: "demo-m1", created_at: "2026-04-01T00:00:00.000Z" },
  { id: "demo-be6", entry_date: "2026-03-20", type: "expense", category: "다과", amount: 60000, memo: "알고리즘 스터디 다과비", created_by: "demo-m2", created_at: "2026-03-20T00:00:00.000Z" },
  { id: "demo-be7", entry_date: "2026-02-10", type: "income", category: "회비", amount: 280000, memo: "2025-2 회비 납부", created_by: "demo-m1", created_at: "2026-02-10T00:00:00.000Z" },
  { id: "demo-be8", entry_date: "2026-01-15", type: "expense", category: "굿즈", amount: 150000, memo: "신입 회원 웰컴 키트", created_by: "demo-m2", created_at: "2026-01-15T00:00:00.000Z" },
];

export const DEMO_SPONSORS: Sponsor[] = [
  { id: "demo-sp1", name: "테크노바 주식회사", amount: 500000, season: "2026-1", note: "데브페스트 메인 스폰서", created_at: "2026-04-01T00:00:00.000Z" },
  { id: "demo-sp2", name: "클라우드베이스", amount: 300000, season: "2026-1", note: "클라우드 스터디 서버 비용 지원", created_at: "2026-03-15T00:00:00.000Z" },
  { id: "demo-sp3", name: "카페드림", amount: 100000, season: "2025-2", note: "정기 모임 다과 지원", created_at: "2025-10-01T00:00:00.000Z" },
  { id: "demo-sp4", name: "북스토어대전", amount: 150000, season: "2025-2", note: "도서 지원", created_at: "2025-09-10T00:00:00.000Z" },
];

export const DEMO_AUDIT_LOGS: {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  profiles: { name: string } | null;
}[] = [
  { id: 1, actor: "demo-m1", action: "set_role", target: "demo-m3", detail: { role: "member" }, created_at: "2026-07-08T00:00:00.000Z", profiles: { name: "김도윤" } },
  { id: 2, actor: "demo-m1", action: "review_application", target: "demo-ap3", detail: { status: "accepted" }, created_at: "2026-07-03T00:00:00.000Z", profiles: { name: "김도윤" } },
  { id: 3, actor: "demo-m2", action: "review_application", target: "demo-ap4", detail: { status: "rejected" }, created_at: "2026-07-03T00:00:00.000Z", profiles: { name: "이서연" } },
  { id: 4, actor: "demo-m1", action: "issue_code", target: "demo-e3", detail: { code: "9F3K2A" }, created_at: "2026-06-10T09:00:00.000Z", profiles: { name: "김도윤" } },
  { id: 5, actor: "demo-m1", action: "answer_inquiry", target: "demo-iq1", detail: {}, created_at: "2026-07-03T00:00:00.000Z", profiles: { name: "김도윤" } },
  { id: 6, actor: "demo-m2", action: "answer_inquiry", target: "demo-iq4", detail: {}, created_at: "2026-04-22T00:00:00.000Z", profiles: { name: "이서연" } },
  { id: 7, actor: "demo-m1", action: "grant_points", target: "demo-m6", detail: { amount: 50 }, created_at: "2026-06-10T12:00:00.000Z", profiles: { name: "김도윤" } },
  { id: 8, actor: "demo-m1", action: "award_badge", target: "demo-m6", detail: { badge: "발표왕" }, created_at: "2026-06-10T12:05:00.000Z", profiles: { name: "김도윤" } },
  { id: 9, actor: "demo-m2", action: "set_status", target: "demo-m7", detail: { status: "dormant" }, created_at: "2026-05-01T00:00:00.000Z", profiles: { name: "이서연" } },
  { id: 10, actor: "demo-m1", action: "grant_points", target: "demo-m7", detail: { amount: -20 }, created_at: "2026-05-01T00:00:00.000Z", profiles: { name: "김도윤" } },
];
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/lib/demoData.ts
git commit -m "feat: 둘러보기 모드 더미데이터 세트 추가"
```

---

### Task 3: 토글 컴포넌트 + 어드민 레이아웃 배치

**Files:**
- Create: `src/app/admin/TourModeToggle.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `isDemoMode()` (Task 1), `setDemoMode()` (Task 1)
- Produces: `TourModeToggle({ active }: { active: boolean })` 컴포넌트 — 이후 태스크 없음(레이아웃에서만 사용)

- [ ] **Step 1: `src/app/admin/TourModeToggle.tsx` 작성**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDemoMode } from "@/actions/demo";

export function TourModeToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setDemoMode(!active);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      <span>둘러보기 모드</span>
      <span
        className={`ml-2 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          active ? "bg-white/30" : "bg-gray-300"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-3" : ""
          }`}
        />
      </span>
    </button>
  );
}
```

- [ ] **Step 2: `src/app/admin/layout.tsx` 수정**

전체 파일을 아래 내용으로 교체한다 (기존 내용에 `isDemoMode` import, `TourModeToggle` 배치, 상단 배너만 추가):

```tsx
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/actions/profile";
import { Badge } from "@/components/Badge";
import { ThemeToggle } from "@/app/(member)/ThemeToggle";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { TourModeToggle } from "./TourModeToggle";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const demo = await isDemoMode();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:bg-gray-100 px-4 py-6">
        <div className="px-3 pb-6">
          <p className="text-base font-bold text-gray-900">GDG DJU</p>
          <p className="text-xs text-gray-500">동아리 관리 시스템</p>
        </div>
        <AdminSidebarNav />
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <TourModeToggle active={demo} />
          <ThemeToggle />
          <div className="flex items-center gap-2 rounded-md px-1 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {profile.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {profile.name}
              </p>
              <Badge tone="primary">관리자</Badge>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="로그아웃"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-8 py-8">
        {demo && (
          <div className="mb-6 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
            둘러보기 모드 · 모든 데이터는 예시입니다
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

`npm run dev` 실행 후 어드민으로 로그인 → 사이드바에서 라이트/다크 토글 위에 "둘러보기 모드" 스위치가 보이는지, 클릭하면 켜지고(주황 배너 노출) 다시 클릭하면 꺼지는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/TourModeToggle.tsx src/app/admin/layout.tsx
git commit -m "feat: 어드민 레이아웃에 둘러보기 모드 토글/배너 추가"
```

---

### Task 4: 대시보드 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_DASHBOARD_STATS, DEMO_DASHBOARD_ROWS, DEMO_DASHBOARD_JOIN_COUNTS, DEMO_DASHBOARD_SATISFACTION, DEMO_DASHBOARD_RANKING` (Task 2)

- [ ] **Step 1: import 추가**

`src/app/admin/page.tsx` 상단 import 블록에 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_DASHBOARD_STATS,
  DEMO_DASHBOARD_ROWS,
  DEMO_DASHBOARD_JOIN_COUNTS,
  DEMO_DASHBOARD_SATISFACTION,
  DEMO_DASHBOARD_RANKING,
} from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록을 데모 분기로 감싸기**

`export default async function AdminDashboardPage() {` 본문 시작부터 `rankingRows` 계산이 끝나는 지점(원본 `src/app/admin/page.tsx:27`~`:245` 부근, `return (` 직전)까지를 아래처럼 재구성한다. 즉, 각 최종 변수를 데모 기본값으로 `let` 선언한 뒤, `if (!demo) { ...기존 코드 전체(들여쓰기만 유지, const→해당 변수 대입)... }`로 감싼다.

```tsx
export default async function AdminDashboardPage() {
  const demo = await isDemoMode();

  let totalMembers = DEMO_DASHBOARD_STATS.totalMembers;
  let activeMembers = DEMO_DASHBOARD_STATS.activeMembers;
  let upcomingEvents = DEMO_DASHBOARD_STATS.upcomingEvents;
  let rows: RecentEventRow[] = DEMO_DASHBOARD_ROWS;
  let joinCounts: number[] = DEMO_DASHBOARD_JOIN_COUNTS;
  let satisfactionRows: { id: string; title: string; count: number; avg: number }[] =
    DEMO_DASHBOARD_SATISFACTION;
  let rankingRows: { rank: number; id: string; name: string; total: number }[] =
    DEMO_DASHBOARD_RANKING;

  if (!demo) {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const [
      { count: totalMembersCount },
      { count: activeMembersCount },
      { count: upcomingEventsCount },
      { data: recentEventsData },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "member"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "member")
        .eq("status", "active"),
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("starts_at", now),
      supabase
        .from("events")
        .select("id, title, type, starts_at")
        .lt("starts_at", now)
        .order("starts_at", { ascending: false })
        .limit(5),
    ]);

    totalMembers = totalMembersCount ?? 0;
    activeMembers = activeMembersCount ?? 0;
    upcomingEvents = upcomingEventsCount ?? 0;

    const recentEvents = recentEventsData ?? [];
    const recentEventIds = recentEvents.map((e) => e.id);

    const confirmedByEvent = new Map<string, number>();
    const attendedByEvent = new Map<string, number>();

    if (recentEventIds.length > 0) {
      const [{ data: regs }, { data: attends }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("user_id, event_id")
          .eq("status", "confirmed")
          .in("event_id", recentEventIds),
        supabase
          .from("attendances")
          .select("user_id, event_id")
          .in("event_id", recentEventIds),
      ]);
      const confirmedPairs = new Set<string>();
      for (const r of regs ?? []) {
        confirmedPairs.add(`${r.user_id}:${r.event_id}`);
        confirmedByEvent.set(
          r.event_id,
          (confirmedByEvent.get(r.event_id) ?? 0) + 1,
        );
      }
      for (const a of attends ?? []) {
        if (confirmedPairs.has(`${a.user_id}:${a.event_id}`)) {
          attendedByEvent.set(
            a.event_id,
            (attendedByEvent.get(a.event_id) ?? 0) + 1,
          );
        }
      }
    }

    rows = recentEvents.map((e) => {
      const confirmed = confirmedByEvent.get(e.id) ?? 0;
      const attended = attendedByEvent.get(e.id) ?? 0;
      return {
        id: e.id,
        title: e.title,
        type: e.type,
        starts_at: e.starts_at,
        confirmed,
        attended,
        rate: confirmed > 0 ? attended / confirmed : null,
      };
    });

    const nowDate = new Date();
    const sinceDate = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth() - 5,
      1,
    ).toISOString();
    const { data: joinRows } = await supabase
      .from("profiles")
      .select("joined_at")
      .gte("joined_at", sinceDate);

    const monthKeys = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const joinCountByMonthReal = new Map(monthKeys.map((k) => [k, 0]));
    for (const row of joinRows ?? []) {
      const d = new Date(row.joined_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (joinCountByMonthReal.has(key)) {
        joinCountByMonthReal.set(key, (joinCountByMonthReal.get(key) ?? 0) + 1);
      }
    }
    joinCounts = monthKeys.map((k) => joinCountByMonthReal.get(k) ?? 0);

    const { data: eventSurveysData } = await supabase
      .from("surveys")
      .select("id, title, event_id, questions")
      .not("event_id", "is", null);
    const eventSurveys = (eventSurveysData ?? []) as Survey[];
    const surveyIds = eventSurveys.map((s) => s.id);

    const { data: surveyResponsesData } =
      surveyIds.length > 0
        ? await supabase
            .from("survey_responses")
            .select("survey_id, answers")
            .in("survey_id", surveyIds)
        : { data: [] as { survey_id: string; answers: Record<string, unknown> }[] };
    const surveyResponses =
      (surveyResponsesData as { survey_id: string; answers: Record<string, unknown> }[]) ?? [];

    const eventIdsWithSurvey = Array.from(
      new Set(eventSurveys.map((s) => s.event_id).filter((id): id is string => !!id)),
    );
    const { data: satisfactionEventsData } =
      eventIdsWithSurvey.length > 0
        ? await supabase.from("events").select("id, title").in("id", eventIdsWithSurvey)
        : { data: [] as { id: string; title: string }[] };
    const eventTitleById = new Map(
      ((satisfactionEventsData as { id: string; title: string }[] | null) ?? []).map((e) => [
        e.id,
        e.title,
      ]),
    );

    const ratingSumByEvent = new Map<string, number>();
    const ratingCountByEvent = new Map<string, number>();
    for (const survey of eventSurveys) {
      if (!survey.event_id) continue;
      const ratingQids = survey.questions
        .filter((q) => q.type === "rating")
        .map((q) => q.id);
      if (ratingQids.length === 0) continue;

      const responsesForSurvey = surveyResponses.filter(
        (r) => r.survey_id === survey.id,
      );
      for (const r of responsesForSurvey) {
        for (const qid of ratingQids) {
          const raw = r.answers[qid];
          if (raw === undefined || raw === "") continue;
          const n = Number(raw);
          if (Number.isNaN(n)) continue;
          ratingSumByEvent.set(
            survey.event_id,
            (ratingSumByEvent.get(survey.event_id) ?? 0) + n,
          );
          ratingCountByEvent.set(
            survey.event_id,
            (ratingCountByEvent.get(survey.event_id) ?? 0) + 1,
          );
        }
      }
    }
    satisfactionRows = eventIdsWithSurvey
      .map((id) => ({
        id,
        title: eventTitleById.get(id) ?? "(삭제된 이벤트)",
        count: ratingCountByEvent.get(id) ?? 0,
        avg:
          ratingCountByEvent.get(id) && ratingCountByEvent.get(id)! > 0
            ? (ratingSumByEvent.get(id) ?? 0) / ratingCountByEvent.get(id)!
            : 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.avg - a.avg);

    const { data: pointRows } = await supabase
      .from("point_logs")
      .select("user_id, amount");
    const pointSumByUser = new Map<string, number>();
    for (const p of (pointRows as { user_id: string; amount: number }[] | null) ?? []) {
      pointSumByUser.set(p.user_id, (pointSumByUser.get(p.user_id) ?? 0) + p.amount);
    }
    const topUsers = Array.from(pointSumByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const topUserIds = topUsers.map(([id]) => id);
    const { data: topProfilesData } =
      topUserIds.length > 0
        ? await supabase.from("profiles").select("id, name").in("id", topUserIds)
        : { data: [] as { id: string; name: string }[] };
    const topNameById = new Map(
      ((topProfilesData as { id: string; name: string }[] | null) ?? []).map((p) => [
        p.id,
        p.name,
      ]),
    );
    rankingRows = topUsers.map(([id, total], i) => ({
      rank: i + 1,
      id,
      name: topNameById.get(id) ?? "(탈퇴)",
      total,
    }));
  }

  const ratedRows = rows.filter((r) => r.rate !== null);
  const avgRate =
    ratedRows.length > 0
      ? ratedRows.reduce((sum, r) => sum + (r.rate ?? 0), 0) /
        ratedRows.length
      : null;

  const nowDate = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}월`,
    };
  });
  const joinCountByMonth = new Map(months.map((m, i) => [m.key, joinCounts[i] ?? 0]));
  const maxJoinCount = Math.max(1, ...joinCountByMonth.values());
```

`return (` 이하 JSX는 그대로 둔다(수정 없음).

주의: 기존 파일에는 `months`가 `joinRows` 조회 이전에 선언되어 있었는데, 위 재구성에서는 `months`를 `if (!demo)` 블록 바깥, `avgRate` 계산 다음으로 옮겼다(데모/실제 두 경로 모두 `months` 레이블이 필요하므로). `if (!demo)` 블록 안에서는 `monthKeys`라는 로컬 변수만 써서 `joinCounts` 배열을 만든다.

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. `RecentEventRow`, `Survey` 등 기존 import는 그대로 유지되어 있어야 한다.

- [ ] **Step 3: 수동 확인**

둘러보기 모드 On 상태에서 `/admin` 접속 → 통계 카드 4개, 최근 이벤트 5행, 월별 가입 추이 막대, 세션별 만족도, 활동 랭킹 Top 8이 더미데이터로 채워지는지 확인. Off 상태에서는 기존처럼(실 데이터 또는 빈 상태) 보이는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: 대시보드에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 5: 회원 목록/상세 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/members/page.tsx`
- Modify: `src/app/admin/members/[id]/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_MEMBERS, DEMO_MEMBER_ATTENDANCE` (Task 2)

- [ ] **Step 1: `src/app/admin/members/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEMBERS } from "@/lib/demoData";
```

`await requireAdmin();` 다음 줄부터 `const members = (data as Profile[]) ?? [];`까지(원본 17~34번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const { q, role, status } = await searchParams;
  const demo = await isDemoMode();

  let members: Profile[] = DEMO_MEMBERS;

  if (!demo) {
    const supabase = await createClient();
    let query = supabase
      .from("profiles")
      .select("*")
      .order("joined_at", { ascending: false });

    if (q) {
      const term = q.replace(/[%,]/g, "");
      query = query.or(`name.ilike.%${term}%,student_no.ilike.%${term}%`);
    }
    if (role) query = query.eq("role", role);
    if (status) query = query.eq("status", status);

    const { data } = await query;
    members = (data as Profile[]) ?? [];
  }
```

(둘러보기 모드에서는 검색/필터 파라미터를 적용하지 않고 전체 더미 회원 10명을 그대로 보여준다 — 필터 UI 자체는 그대로 노출되지만 동작하지 않는 것이 의도된 단순화다.)

- [ ] **Step 2: `src/app/admin/members/[id]/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEMBERS, DEMO_MEMBER_ATTENDANCE } from "@/lib/demoData";
```

`await requireAdmin();`부터 `const attendances = (attendanceData as unknown as AttendanceRow[]) ?? [];`까지(원본 25~44번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const { id } = await params;
  const demo = await isDemoMode();

  let member: Profile | undefined;
  let attendances: AttendanceRow[] = [];

  if (demo) {
    member = DEMO_MEMBERS.find((m) => m.id === id) ?? DEMO_MEMBERS[0];
    attendances = DEMO_MEMBER_ATTENDANCE[member.id] ?? [];
  } else {
    const supabase = await createClient();
    const { data: memberData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (!memberData) notFound();
    member = memberData as Profile;

    const { data: attendanceData } = await supabase
      .from("attendances")
      .select("id, checked_at, events(id, title, starts_at)")
      .eq("user_id", id)
      .order("checked_at", { ascending: false });

    attendances = (attendanceData as unknown as AttendanceRow[]) ?? [];
  }

  if (!member) notFound();
```

이후 JSX에서 쓰는 `member`는 옵셔널이 아니게 되므로(위에서 `notFound()`로 걸러짐) 그대로 사용 가능하다. `member.name` 등 참조 앞에 non-null 단언이 필요하면 `member!` 대신 위 `if (!member) notFound();` 가드로 타입이 좁혀지는지 Step 3에서 확인한다.

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. `member`가 `Profile | undefined`로 좁혀지지 않는다는 에러가 나면, `if (!member) notFound();` 바로 다음 줄에 `const m = member;`로 재바인딩하고 이후 JSX의 `member.`를 `m.`으로 바꾼다(리턴 타입 좁히기 관용구).

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/members` 목록 10명 노출, 아무 회원 클릭 → 상세 페이지에 출석 기록(있는 회원은 목록, 없는 회원은 빈 상태) 노출 확인. 역할/상태 변경 셀렉트 조작 시 에러 없이 값이 바뀌는지(Task 15에서 액션을 막은 뒤) 확인 — 지금 단계에서는 아직 실제 DB에 반영될 수 있으니 Task 15 이후 재확인해도 됨.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/members/page.tsx src/app/admin/members/[id]/page.tsx
git commit -m "feat: 회원 목록/상세에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 6: 지원서 심사 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/applications/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_APPLICATION_SEASONS, DEMO_APPLICATIONS, DEMO_APPLICANTS` (Task 2)

- [ ] **Step 1: import 추가**

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATION_SEASONS, DEMO_APPLICATIONS, DEMO_APPLICANTS } from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록 교체**

`await requireAdmin();`부터 `const applicantMap = new Map(...)`까지(원본 41~77번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "all";
  const demo = await isDemoMode();

  let seasons: string[] = DEMO_APPLICATION_SEASONS;
  let season = params.season ?? seasons[0] ?? CURRENT_SEASON;
  let applications: Application[] = DEMO_APPLICATIONS.filter(
    (a) => a.season === season && (status === "all" || a.status === status),
  );
  let applicantMap = new Map(
    Object.values(DEMO_APPLICANTS).map((p) => [p.id, p]),
  );

  if (!demo) {
    const supabase = await createClient();

    const { data: seasonRows } = await supabase
      .from("applications")
      .select("season")
      .order("season", { ascending: false });
    seasons = Array.from(
      new Set(
        ((seasonRows as { season: string }[] | null) ?? []).map((row) => row.season),
      ),
    );
    season = params.season ?? seasons[0] ?? CURRENT_SEASON;

    let query = supabase
      .from("applications")
      .select("*")
      .eq("season", season)
      .order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("status", status);

    const { data: appData } = await query;
    applications = (appData as Application[] | null) ?? [];

    const applicantIds = Array.from(new Set(applications.map((a) => a.applicant_id)));
    const { data: profileData } = applicantIds.length
      ? await supabase
          .from("profiles")
          .select("id, name, student_no, major")
          .in("id", applicantIds)
      : { data: [] as ApplicantInfo[] };
    applicantMap = new Map(
      ((profileData as ApplicantInfo[] | null) ?? []).map((p) => [p.id, p]),
    );
  }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/applications` 접속, 시즌 필터(2026-1 기본)에 지원서 4건, 상태 탭 전환 시 필터링 되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/applications/page.tsx
git commit -m "feat: 지원서 심사에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 7: 이벤트 목록/상세 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/events/page.tsx`
- Modify: `src/app/admin/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_EVENTS, DEMO_EVENT_CONFIRMED_COUNTS` (Task 2)

- [ ] **Step 1: `src/app/admin/events/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS, DEMO_EVENT_CONFIRMED_COUNTS } from "@/lib/demoData";
```

`const { month } = await searchParams;`부터 `counts[row.event_id] = Number(row.confirmed);` 블록 끝까지(원본 31~56번 줄)를 아래로 교체:

```tsx
  const { month } = await searchParams;
  const demo = await isDemoMode();

  let all: Event[] = DEMO_EVENTS;
  const counts: Record<string, number> = demo ? { ...DEMO_EVENT_CONFIRMED_COUNTS } : {};

  if (!demo) {
    const supabase = await createClient();
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: false });
    all = (events ?? []) as Event[];
  }

  const months = Array.from(new Set(all.map((e) => monthKst(e.starts_at))));
  const list = month ? all.filter((e) => monthKst(e.starts_at) === month) : all;

  const monthOptions = [
    { value: "", label: "전체" },
    ...months.map((m) => ({ value: m, label: formatMonthLabel(m) })),
  ];

  if (!demo && list.length > 0) {
    const supabase = await createClient();
    const { data: countRows } = await supabase.rpc("event_confirmed_counts", {
      p_event_ids: list.map((e) => e.id),
    });
    for (const row of countRows ?? []) {
      counts[row.event_id] = Number(row.confirmed);
    }
  }
```

(Supabase 클라이언트를 두 번 생성하는 것을 피하고 싶으면 상단에서 `const supabase = demo ? null : await createClient();`로 한 번만 만들고 이후 `supabase!`로 참조해도 되지만, 가독성을 위해 이 계획에서는 필요한 블록마다 `createClient()`를 호출한다 — 기존 코드도 이미 요청마다 독립적으로 클라이언트를 만드는 패턴이라 이 방식이 프로젝트 관례와 맞다.)

- [ ] **Step 2: `src/app/admin/events/[id]/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS } from "@/lib/demoData";
```

`const { id } = await params;`부터 `const e = event as Event;`까지(원본 17~27번 줄)를 아래로 교체:

```tsx
  const { id } = await params;
  const demo = await isDemoMode();

  let e: Event | undefined;

  if (demo) {
    e = DEMO_EVENTS.find((ev) => ev.id === id) ?? DEMO_EVENTS[0];
  } else {
    const supabase = await createClient();
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (!event) notFound();
    e = event as Event;
  }

  if (!e) notFound();
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (Task 5와 동일하게 `e`가 좁혀지지 않으면 `const ev = e; `로 재바인딩)

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/events` 목록 8개(월 필터 동작), 카드 클릭 시 상세(수정 폼 + 삭제 버튼) 정상 노출 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/events/page.tsx src/app/admin/events/\[id\]/page.tsx
git commit -m "feat: 이벤트 목록/상세에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 8: 출석 관리 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/attendance/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_ATTENDANCE_ROWS` (Task 2)

- [ ] **Step 1: import 추가**

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_ATTENDANCE_ROWS } from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록 교체**

`const supabase = await createClient();`부터 `const rows: MemberAttendanceRow[] = members.map(...)`까지(원본 20~72번 줄)를 아래로 교체:

```tsx
  const demo = await isDemoMode();

  let rows: MemberAttendanceRow[] = DEMO_ATTENDANCE_ROWS;

  if (!demo) {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const [{ data: membersData }, { data: pastEventsData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "member")
        .eq("status", "active")
        .order("name"),
      supabase.from("events").select("id").lt("starts_at", now),
    ]);

    const members = (membersData as Profile[]) ?? [];
    const pastEventIds = (pastEventsData ?? []).map((e) => e.id);

    const confirmedByUser = new Map<string, number>();
    const attendedByUser = new Map<string, number>();

    if (pastEventIds.length > 0) {
      const [{ data: regs }, { data: attends }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("user_id, event_id")
          .eq("status", "confirmed")
          .in("event_id", pastEventIds),
        supabase
          .from("attendances")
          .select("user_id, event_id")
          .in("event_id", pastEventIds),
      ]);
      const confirmedPairs = new Set<string>();
      for (const r of regs ?? []) {
        confirmedPairs.add(`${r.user_id}:${r.event_id}`);
        confirmedByUser.set(r.user_id, (confirmedByUser.get(r.user_id) ?? 0) + 1);
      }
      for (const a of attends ?? []) {
        if (confirmedPairs.has(`${a.user_id}:${a.event_id}`)) {
          attendedByUser.set(a.user_id, (attendedByUser.get(a.user_id) ?? 0) + 1);
        }
      }
    }

    rows = members.map((member) => {
      const confirmed = confirmedByUser.get(member.id) ?? 0;
      const attended = attendedByUser.get(member.id) ?? 0;
      return {
        member,
        confirmed,
        attended,
        rate: confirmed > 0 ? attended / confirmed : null,
      };
    });
  }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/attendance` 접속, 활동 회원 4명 출석률 표시 확인(1명은 경고 배지 노출: 한소희 40%).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/attendance/page.tsx
git commit -m "feat: 출석 관리에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 9: 공지 목록/상세 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/notices/page.tsx`
- Modify: `src/app/admin/notices/[id]/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_NOTICES` (Task 2)

- [ ] **Step 1: `src/app/admin/notices/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTICES } from "@/lib/demoData";
```

`const supabase = await createClient();`부터 `const list = (notices ?? []) as Notice[];`까지(원본 14~21번 줄)를 아래로 교체:

```tsx
  const demo = await isDemoMode();
  let list: Notice[] = DEMO_NOTICES;

  if (!demo) {
    const supabase = await createClient();
    const { data: notices } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });
    list = (notices ?? []) as Notice[];
  }
```

- [ ] **Step 2: `src/app/admin/notices/[id]/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTICES } from "@/lib/demoData";
```

`const { id } = await params;`부터 `const n = notice as Notice;`까지(원본 17~27번 줄)를 아래로 교체:

```tsx
  const { id } = await params;
  const demo = await isDemoMode();

  let n: Notice | undefined;

  if (demo) {
    n = DEMO_NOTICES.find((notice) => notice.id === id) ?? DEMO_NOTICES[0];
  } else {
    const supabase = await createClient();
    const { data: notice } = await supabase
      .from("notices")
      .select("*")
      .eq("id", id)
      .single();

    if (!notice) notFound();
    n = notice as Notice;
  }

  if (!n) notFound();
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/notices` 5건(발행/미발행 배지 확인) → 클릭 시 수정 폼 노출 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/notices/page.tsx src/app/admin/notices/\[id\]/page.tsx
git commit -m "feat: 공지 목록/상세에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 10: 설문 목록/생성/결과 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/surveys/page.tsx`
- Modify: `src/app/admin/surveys/new/page.tsx`
- Modify: `src/app/admin/surveys/[id]/results/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_SURVEYS, DEMO_SURVEY_RESPONSE_COUNTS, DEMO_SURVEY_EVENT_OPTIONS, DEMO_SURVEY_RESPONSES` (Task 2)

- [ ] **Step 1: `src/app/admin/surveys/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEYS, DEMO_SURVEY_RESPONSE_COUNTS } from "@/lib/demoData";
```

`const supabase = await createClient();`부터 `counts[row.survey_id] = (counts[row.survey_id] ?? 0) + 1;` 블록 끝까지(원본 15~36번 줄)를 아래로 교체:

```tsx
  const demo = await isDemoMode();
  let list: Survey[] = DEMO_SURVEYS;
  const counts: Record<string, number> = demo ? { ...DEMO_SURVEY_RESPONSE_COUNTS } : {};

  if (!demo) {
    const supabase = await createClient();
    const { data: surveys } = await supabase
      .from("surveys")
      .select("*")
      .order("created_at", { ascending: false });
    list = (surveys ?? []) as Survey[];

    if (list.length > 0) {
      const { data: responseRows } = await supabase
        .from("survey_responses")
        .select("survey_id")
        .in(
          "survey_id",
          list.map((s) => s.id),
        );
      for (const row of responseRows ?? []) {
        counts[row.survey_id] = (counts[row.survey_id] ?? 0) + 1;
      }
    }
  }
```

- [ ] **Step 2: `src/app/admin/surveys/new/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEY_EVENT_OPTIONS } from "@/lib/demoData";
```

`const supabase = await createClient();`부터 `const { data: events } = await supabase...`까지(원본 10~14번 줄) 및 렌더링부(20번 줄)를 아래로 교체:

```tsx
export default async function NewSurveyPage() {
  const demo = await isDemoMode();
  let events: Pick<Event, "id" | "title">[] = DEMO_SURVEY_EVENT_OPTIONS;

  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id, title")
      .order("starts_at", { ascending: false });
    events = (data ?? []) as Pick<Event, "id" | "title">[];
  }

  return (
    <div>
      <PageHeader title="설문 생성" />
      <Card>
        <SurveyForm events={events} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/admin/surveys/[id]/results/page.tsx` 수정**

import 추가:

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEYS, DEMO_SURVEY_RESPONSES } from "@/lib/demoData";
```

`const { id } = await params;`부터 `const list = (responses ?? []) as SurveyResponse[];`까지(원본 15~31번 줄)를 아래로 교체:

```tsx
  const { id } = await params;
  const demo = await isDemoMode();

  let s: Survey | undefined;
  let list: SurveyResponse[] = [];

  if (demo) {
    s = DEMO_SURVEYS.find((survey) => survey.id === id) ?? DEMO_SURVEYS[0];
    list = DEMO_SURVEY_RESPONSES[s.id] ?? [];
  } else {
    const supabase = await createClient();
    const { data: survey } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .single();

    if (!survey) notFound();
    s = survey as Survey;

    const { data: responses } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("survey_id", id);
    list = (responses ?? []) as SurveyResponse[];
  }

  if (!s) notFound();
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 수동 확인**

둘러보기 모드 On → `/admin/surveys` 3건(응답 수 표시) → 결과 페이지에서 rating 분포/텍스트 응답 노출 확인 → `/admin/surveys/new`에서 이벤트 선택 목록에 8개 이벤트가 뜨는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/surveys/page.tsx src/app/admin/surveys/new/page.tsx src/app/admin/surveys/\[id\]/results/page.tsx
git commit -m "feat: 설문 목록/생성/결과에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 11: 문의/건의 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/inquiries/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_INQUIRIES, DEMO_INQUIRY_AUTHORS` (Task 2)

- [ ] **Step 1: import 추가**

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_INQUIRIES, DEMO_INQUIRY_AUTHORS } from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록 교체**

`await requireAdmin();`부터 `const authorMap = new Map(...)`까지(원본 37~58번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "all";
  const demo = await isDemoMode();

  let inquiries: Inquiry[] = DEMO_INQUIRIES.filter(
    (i) => status === "all" || i.status === status,
  );
  let authorMap = new Map(Object.entries(DEMO_INQUIRY_AUTHORS));

  if (!demo) {
    const supabase = await createClient();

    let query = supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("status", status);

    const { data: inquiryData } = await query;
    inquiries = (inquiryData as Inquiry[] | null) ?? [];

    const userIds = Array.from(new Set(inquiries.map((i) => i.user_id)));
    const { data: profileData } = userIds.length
      ? await supabase.from("profiles").select("id, name").in("id", userIds)
      : { data: [] as AuthorInfo[] };
    authorMap = new Map(
      ((profileData as AuthorInfo[] | null) ?? []).map((p) => [p.id, p]),
    );
  }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/inquiries` 5건(답변완료 2건, 접수 3건), 상태 탭 전환 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/inquiries/page.tsx
git commit -m "feat: 문의/건의에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 12: 포인트/뱃지 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/points/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_MEMBERS, DEMO_EVENTS, DEMO_BADGES, DEMO_POINT_LOGS` (Task 2)

- [ ] **Step 1: import 추가**

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEMBERS, DEMO_EVENTS, DEMO_BADGES, DEMO_POINT_LOGS } from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록 교체**

`await requireAdmin();`부터 `const nameById = new Map(...)`까지(원본 15~56번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const demo = await isDemoMode();

  let memberList: Profile[] = DEMO_MEMBERS.filter(
    (m) => (m.role === "member" || m.role === "admin") && m.status === "active",
  );
  let eventList: Event[] = DEMO_EVENTS;
  let badgeList: BadgeType[] = DEMO_BADGES;
  let logList: PointLog[] = DEMO_POINT_LOGS;
  let nameById = new Map(DEMO_MEMBERS.map((m) => [m.id, m.name]));

  if (!demo) {
    const supabase = await createClient();
    const [
      { data: members },
      { data: events },
      { data: badges },
      { data: logs },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["member", "admin"])
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: false }),
      supabase.from("badges").select("*").order("name", { ascending: true }),
      supabase
        .from("point_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    memberList = (members as Profile[]) ?? [];
    eventList = (events as Event[]) ?? [];
    badgeList = (badges as BadgeType[]) ?? [];
    logList = (logs as PointLog[]) ?? [];

    const logUserIds = Array.from(new Set(logList.map((l) => l.user_id)));
    const { data: logProfiles } = logUserIds.length
      ? await supabase.from("profiles").select("id, name").in("id", logUserIds)
      : { data: [] as { id: string; name: string }[] };
    nameById = new Map(
      ((logProfiles as { id: string; name: string }[] | null) ?? []).map((p) => [
        p.id,
        p.name,
      ]),
    );
  }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/points` 접속, 회원 선택 드롭다운(4명), 뱃지 관리(4개), 최근 포인트 로그 10건 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/points/page.tsx
git commit -m "feat: 포인트/뱃지에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 13: 예산/후원 관리 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/budget/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_BUDGET_ENTRIES, DEMO_SPONSORS` (Task 2)

- [ ] **Step 1: import 추가**

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_BUDGET_ENTRIES, DEMO_SPONSORS } from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록 교체**

`await requireAdmin();`부터 `const sponsors = (sponsorsData as Sponsor[]) ?? [];`까지(원본 21~36번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const demo = await isDemoMode();

  let entries: BudgetEntry[] = DEMO_BUDGET_ENTRIES;
  let sponsors: Sponsor[] = DEMO_SPONSORS;

  if (!demo) {
    const supabase = await createClient();
    const [{ data: entriesData }, { data: sponsorsData }] = await Promise.all([
      supabase
        .from("budget_entries")
        .select("*")
        .order("entry_date", { ascending: false }),
      supabase
        .from("sponsors")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    entries = (entriesData as BudgetEntry[]) ?? [];
    sponsors = (sponsorsData as Sponsor[]) ?? [];
  }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/budget` 접속, 총수입/총지출/잔액 카드, 내역 8건, 스폰서 4건 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/budget/page.tsx
git commit -m "feat: 예산/후원 관리에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 14: 감사 로그 페이지 데모 분기

**Files:**
- Modify: `src/app/admin/audit/page.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `DEMO_AUDIT_LOGS` (Task 2)

- [ ] **Step 1: import 추가**

```ts
import { isDemoMode } from "@/lib/demo";
import { DEMO_AUDIT_LOGS } from "@/lib/demoData";
```

- [ ] **Step 2: 데이터 조회 블록 교체**

`await requireAdmin();`부터 `const logs = (data as unknown as AuditLogRow[] | null) ?? [];`까지(원본 31~40번 줄)를 아래로 교체:

```tsx
  await requireAdmin();
  const demo = await isDemoMode();

  let logs: AuditLogRow[] = DEMO_AUDIT_LOGS;

  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("audit_logs")
      .select("id, actor, action, target, detail, created_at, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    logs = (data as unknown as AuditLogRow[] | null) ?? [];
  }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 수동 확인**

둘러보기 모드 On → `/admin/audit` 접속, 감사 로그 10건 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/audit/page.tsx
git commit -m "feat: 감사 로그에 둘러보기 모드 더미데이터 분기 추가"
```

---

### Task 15: 어드민 mutation 서버 액션 데모 단락(short-circuit)

**Files:**
- Modify: `src/actions/member.ts`
- Modify: `src/actions/application.ts`
- Modify: `src/actions/event.ts`
- Modify: `src/actions/attendance-admin.ts`
- Modify: `src/actions/attendance-warning.ts`
- Modify: `src/actions/notice.ts`
- Modify: `src/actions/survey.ts`
- Modify: `src/actions/inquiry.ts`
- Modify: `src/actions/points.ts`
- Modify: `src/actions/budget.ts`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1)

각 파일에 `import { isDemoMode } from "@/lib/demo";`를 추가하고, 아래 표에 나온 함수들의 `await requireAdmin();` (또는 `const profile = await requireAdmin();`) 바로 다음 줄에 데모 단락 한 줄을 넣는다. `requireAdmin()`이 없는 회원용 함수(`submitApplication`, `submitInquiry`, `submitSurveyResponse`)는 건드리지 않는다.

- [ ] **Step 1: `src/actions/member.ts`**

`setMemberRole`, `setMemberStatus`, `updateMemberProfile` 세 함수 각각의 `await requireAdmin();` 다음 줄에 추가:

```ts
  if (await isDemoMode()) return {};
```

예시(`setMemberRole` 전체):

```ts
export async function setMemberRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_user: userId,
    p_role: role,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  return {};
}
```

`setMemberStatus`, `updateMemberProfile`에도 동일하게 `await requireAdmin();` 다음 줄에 `if (await isDemoMode()) return {};`를 추가한다.

- [ ] **Step 2: `src/actions/application.ts`**

`reviewApplication`의 `await requireAdmin();` 다음 줄에 추가:

```ts
export async function reviewApplication(
  id: string,
  status: "accepted" | "rejected",
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_application", {
    p_application: id,
    p_status: status,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/applications");
  return {};
}
```

- [ ] **Step 3: `src/actions/event.ts`**

`createEvent`, `updateEvent`, `deleteEvent` 각각의 `await requireAdmin();`(또는 `const profile = await requireAdmin();`) 다음 줄에 `if (await isDemoMode()) return {};` 추가. (해당 파일을 열어 세 함수 시작부의 정확한 `requireAdmin` 호출 줄을 확인한 뒤 바로 다음 줄에 삽입한다.)

- [ ] **Step 4: `src/actions/attendance-admin.ts`**

`issueAttendanceCode`는 반환 타입이 `ActionResult & { code?: string }`이므로 데모 코드를 반환한다:

```ts
export async function issueAttendanceCode(
  eventId: string,
): Promise<ActionResult & { code?: string }> {
  await requireAdmin();
  if (await isDemoMode()) return { code: "DEMO1234" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_event_code", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  return { code: data as string };
}
```

- [ ] **Step 5: `src/actions/attendance-warning.ts`**

`sendAttendanceWarning`은 반환 타입이 `ActionResult & { count?: number }`이므로:

```ts
export async function sendAttendanceWarning(): Promise<
  ActionResult & { count?: number }
> {
  await requireAdmin();
  if (await isDemoMode()) return { count: 0 };

  const supabase = await createClient();
  const warnings = await computeAttendanceWarnings(supabase);
  // ...(이하 기존 코드 동일)
```

- [ ] **Step 6: `src/actions/notice.ts`**

`createNotice`, `updateNotice`, `deleteNotice`는 `if (await isDemoMode()) return {};`. `publishNotice`는 `PublishResult`(`ActionResult & { slack?: string }`)를 반환하므로:

```ts
export async function publishNotice(id: string): Promise<PublishResult> {
  await requireAdmin();
  if (await isDemoMode()) return { slack: "슬랙 전송 완료 (예시)" };

  const supabase = await createClient();
  // ...(이하 기존 코드 동일)
```

`createNotice`는 `const profile = await requireAdmin();` 다음 줄에 추가:

```ts
export async function createNotice(formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseNoticeForm(formData);
  // ...(이하 기존 코드 동일)
```

- [ ] **Step 7: `src/actions/survey.ts`**

`createSurvey`, `toggleSurveyOpen`, `deleteSurvey`(관리자용 3개)만 수정, `submitSurveyResponse`는 그대로 둔다:

```ts
export async function createSurvey(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseSurveyForm(formData);
  // ...(이하 기존 코드 동일)
```

`toggleSurveyOpen`, `deleteSurvey`도 각각 `await requireAdmin();` 다음 줄에 동일하게 추가.

- [ ] **Step 8: `src/actions/inquiry.ts`**

`answerInquiry`만 수정, `submitInquiry`는 그대로 둔다:

```ts
export async function answerInquiry(
  id: string,
  answer: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const trimmed = answer.trim();
  // ...(이하 기존 코드 동일)
```

- [ ] **Step 9: `src/actions/points.ts`**

`grantPoints`, `createBadge`, `deleteBadge`, `awardBadge` 네 함수 모두 `await requireAdmin();` 다음 줄에 `if (await isDemoMode()) return {};` 추가.

- [ ] **Step 10: `src/actions/budget.ts`**

`createBudgetEntry`(`const profile = await requireAdmin();` 다음 줄), `deleteBudgetEntry`, `createSponsor`, `deleteSponsor` 네 함수 모두에 `if (await isDemoMode()) return {};` 추가.

- [ ] **Step 11: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 12: 수동 확인**

둘러보기 모드 On 상태에서: 회원 상세의 역할/상태 셀렉트 변경, 지원서 승인/반려 버튼, 이벤트 생성/삭제, 출석 코드 발급, 공지 작성/발행/삭제, 설문 생성/열기닫기/삭제, 문의 답변, 포인트 부여/뱃지 수여, 예산/스폰서 추가/삭제를 각각 눌러 에러 없이 "성공"으로 끝나는지(그리고 실제 DB가 바뀌지 않는지 — 둘러보기 모드를 끄고 다시 확인) 점검.

- [ ] **Step 13: Commit**

```bash
git add src/actions/member.ts src/actions/application.ts src/actions/event.ts src/actions/attendance-admin.ts src/actions/attendance-warning.ts src/actions/notice.ts src/actions/survey.ts src/actions/inquiry.ts src/actions/points.ts src/actions/budget.ts
git commit -m "feat: 어드민 mutation 액션에 둘러보기 모드 단락 처리 추가"
```

---

### Task 16: 전체 회귀 확인

**Files:** (읽기 전용, 수정 없음)

- [ ] **Step 1: 자동 검증**

Run: `npm run test`
Expected: 기존 `tests/format.test.ts` 통과(이번 변경과 무관하게 그대로 통과해야 함)

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run: `npm run build`
Expected: 빌드 성공 (Server Component/Server Action 타입 오류 없이 컴파일)

- [ ] **Step 2: 수동 시나리오 확인**

1. 어드민 로그인 → 둘러보기 모드 Off 상태에서 11개 어드민 페이지가 기존과 동일하게(실 데이터 또는 빈 상태) 보이는지 확인.
2. 둘러보기 모드 On → 11개 페이지 전부 방문해 더미데이터로 채워지는지, 상단 배너가 보이는지 확인.
3. 둘러보기 모드 On 상태로 다른 탭에서 `/admin`을 새로 열어도 켜진 상태가 유지되는지(쿠키 공유) 확인.
4. 둘러보기 모드 On 상태에서 일반 회원 페이지(`/`, `/profile` 등)는 영향받지 않는지 확인.
5. 둘러보기 모드 Off로 되돌리기.

- [ ] **Step 3: Commit**

이 태스크는 코드 변경이 없으므로 커밋하지 않는다. 문제가 발견되면 해당 태스크로 돌아가 수정 후 새 커밋을 만든다.
