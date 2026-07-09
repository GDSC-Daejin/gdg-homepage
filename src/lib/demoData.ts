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
