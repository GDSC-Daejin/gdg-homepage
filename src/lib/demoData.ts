import { slotIso } from "@/lib/meeting-poll";
import type {
  MeetingPoll,
  MeetingPollParticipant,
  Profile,
  Event,
  EventType,
  Application,
  Notice,
  Survey,
  SurveyPreset,
  SurveyResponse,
  Inquiry,
  PointLog,
  Badge,
  BudgetEntry,
  Notification,
  InterviewQuestion,
  Group,
  GroupMember,
} from "@/lib/types";

export const DEMO_MEMBERS: Profile[] = [
  { id: "demo-m1", name: "김도윤", nickname: "Ryan", student_no: "20231234", major: "컴퓨터공학과", phone: "010-1111-1111", interests: ["백엔드", "클라우드"], role: "organizer", position: "backend", status: "active", academic_status: "enrolled", joined_at: "2023-02-01T00:00:00.000Z", approved_at: "2023-02-01T00:00:00.000Z" },
  { id: "demo-m2", name: "이서연", nickname: "Sunny", student_no: "20221111", major: "소프트웨어학과", phone: "010-1111-1112", interests: ["프론트엔드", "디자인"], role: "team_member", position: "frontend", status: "active", academic_status: "enrolled", joined_at: "2022-03-01T00:00:00.000Z", approved_at: "2022-03-01T00:00:00.000Z" },
  { id: "demo-m3", name: "박지훈", nickname: "Jason", student_no: "20241111", major: "정보통신공학과", phone: "010-1111-1113", interests: ["안드로이드"], role: "member", position: "backend", status: "active", academic_status: "enrolled", joined_at: "2024-03-01T00:00:00.000Z", approved_at: "2024-03-01T00:00:00.000Z" },
  { id: "demo-m4", name: "최유나", nickname: "Una", student_no: "20241234", major: "컴퓨터공학과", phone: "010-1111-1114", interests: ["iOS", "UX"], role: "member", position: "designer", status: "active", academic_status: "leave", joined_at: "2024-03-01T00:00:00.000Z", approved_at: "2024-03-01T00:00:00.000Z" },
  { id: "demo-m5", name: "정민준", nickname: "Kevin", student_no: "20241999", major: "산업공학과", phone: "010-1111-1115", interests: ["데이터"], role: "member", position: "backend", status: "active", academic_status: "enrolled", joined_at: "2024-09-01T00:00:00.000Z", approved_at: "2024-09-01T00:00:00.000Z" },
  { id: "demo-m6", name: "한소희", nickname: "Sophie", student_no: "20251111", major: "컴퓨터공학과", phone: "010-1111-1116", interests: ["AI"], role: "member", position: "backend", status: "active", academic_status: "enrolled", joined_at: "2025-03-01T00:00:00.000Z", approved_at: "2025-03-01T00:00:00.000Z" },
  { id: "demo-m7", name: "오지훈", nickname: "Leo", student_no: "20231999", major: "전자공학과", phone: "010-1111-1117", interests: ["임베디드"], role: "member", position: "backend", status: "dormant", academic_status: "leave", joined_at: "2023-09-01T00:00:00.000Z", approved_at: "2023-09-01T00:00:00.000Z" },
  { id: "demo-m8", name: "배수아", nickname: "Sua", student_no: "20221999", major: "경영학과", phone: "010-1111-1118", interests: ["기획"], role: "member", position: "designer", status: "dormant", academic_status: "completed", joined_at: "2022-09-01T00:00:00.000Z", approved_at: "2022-09-01T00:00:00.000Z" },
  { id: "demo-m9", name: "강하늘", nickname: "Sky", student_no: "20220111", major: "컴퓨터공학과", phone: "010-1111-1119", interests: [], role: "member", position: "frontend", status: "withdrawn", academic_status: "graduated", joined_at: "2022-03-01T00:00:00.000Z", approved_at: "2022-03-01T00:00:00.000Z" },
  { id: "demo-m10", name: "윤태경", nickname: "Ted", student_no: "20230111", major: "수학과", phone: "010-1111-1120", interests: [], role: "member", position: "frontend", status: "withdrawn", academic_status: "graduated", joined_at: "2023-03-01T00:00:00.000Z", approved_at: "2023-03-01T00:00:00.000Z" },
  { id: "demo-m11", name: "신예준", nickname: "Yejun", student_no: "20261111", major: "컴퓨터공학과", phone: "010-1111-1121", interests: ["웹"], role: "member", position: null, status: "active", academic_status: "enrolled", joined_at: "2026-07-20T00:00:00.000Z", approved_at: null },
];

export const DEMO_EVENTS: Event[] = [
  { id: "demo-e1", type: "mogakco", title: "8월 모각코", description: "모두 각자 코딩 — 다같이 모여 각자 할 일을 하는 자율 세션", starts_at: "2026-08-20T05:00:00.000Z", ends_at: null, location: "공학관 401호", address: "", speaker: "", capacity: 30, created_by: "demo-m1", created_at: "2026-06-01T00:00:00.000Z" },
  { id: "demo-e2", type: "study", title: "Next.js 스터디 6기", description: "App Router 기반 실전 프로젝트 스터디", starts_at: "2026-07-25T10:00:00.000Z", ends_at: null, location: "온라인", address: "", speaker: "이서연", capacity: 30, created_by: "demo-m2", created_at: "2026-06-15T00:00:00.000Z" },
  { id: "demo-e3", type: "session", title: "React 19 세션", description: "React 19 신규 기능과 마이그레이션 가이드", starts_at: "2026-06-10T09:00:00.000Z", ends_at: null, location: "공학관 401호", address: "", speaker: "김도윤", capacity: 60, created_by: "demo-m1", created_at: "2026-05-20T00:00:00.000Z" },
  { id: "demo-e4", type: "study", title: "클라우드 스터디 3기", description: "AWS 기초부터 배포까지", starts_at: "2026-05-15T09:00:00.000Z", ends_at: null, location: "공학관 302호", address: "", speaker: "박지훈", capacity: 30, created_by: "demo-m1", created_at: "2026-04-20T00:00:00.000Z" },
  { id: "demo-e5", type: "session", title: "AI 세션", description: "LLM 기반 서비스 개발 사례 공유", starts_at: "2026-04-20T09:00:00.000Z", ends_at: null, location: "공학관 401호", address: "", speaker: "한소희", capacity: 60, created_by: "demo-m2", created_at: "2026-03-25T00:00:00.000Z" },
  { id: "demo-e6", type: "study", title: "알고리즘 스터디 2기", description: "코딩 테스트 대비 알고리즘 스터디", starts_at: "2026-03-10T09:00:00.000Z", ends_at: null, location: "공학관 302호", address: "", speaker: "정민준", capacity: 25, created_by: "demo-m1", created_at: "2026-02-15T00:00:00.000Z" },
  { id: "demo-e7", type: "session", title: "신입 회원 OT", description: "동아리 소개 및 신입 회원 오리엔테이션", starts_at: "2026-02-15T09:00:00.000Z", ends_at: null, location: "학생회관 대강당", address: "", speaker: "김도윤", capacity: 100, created_by: "demo-m1", created_at: "2026-01-20T00:00:00.000Z" },
  { id: "demo-e8", type: "session", title: "연말 회고 정기세션", description: "지난 시즌 회고 및 다음 시즌 준비", starts_at: "2026-01-10T09:00:00.000Z", ends_at: null, location: "공학관 401호", address: "", speaker: "이서연", capacity: 60, created_by: "demo-m2", created_at: "2025-12-20T00:00:00.000Z" },
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
  { id: "demo-e7", surveyId: null, title: "신입 회원 OT", count: 42, avg: 4.6 },
  { id: "demo-e5", surveyId: null, title: "AI 세션", count: 30, avg: 4.3 },
  { id: "demo-e3", surveyId: null, title: "React 19 세션", count: 28, avg: 4.1 },
];

export const DEMO_DASHBOARD_RANKING = [
  { rank: 1, id: "demo-m6", name: "한소희", nickname: "Sophie", total: 320 },
  { rank: 2, id: "demo-m3", name: "박지훈", nickname: "Jason", total: 280 },
  { rank: 3, id: "demo-m4", name: "최유나", nickname: "Una", total: 260 },
  { rank: 4, id: "demo-m5", name: "정민준", nickname: "Kevin", total: 210 },
  { rank: 5, id: "demo-m1", name: "김도윤", nickname: "Ryan", total: 190 },
  { rank: 6, id: "demo-m2", name: "이서연", nickname: "Sunny", total: 170 },
  { rank: 7, id: "demo-m7", name: "오지훈", nickname: "Leo", total: 90 },
  { rank: 8, id: "demo-m8", name: "배수아", nickname: "Sua", total: 60 },
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
  { id: "demo-ap1", applicant_id: null, applicant_name: "김하은", student_no: "20241001", major: "컴퓨터공학과", phone: "010-1000-0001", email: "haeun@dju.ac.kr", season: "2026-1", answers: { intro: "안녕하세요, 컴퓨터공학과 24학번 김하은입니다.", motivation: "웹 개발을 실전 프로젝트로 배우고 싶어 지원했습니다.", interest: "프론트엔드" }, status: "waiting", reviewed_by: null, reviewed_at: null, created_at: "2026-07-01T00:00:00.000Z", position: "frontend", review_note: "" },
  { id: "demo-ap2", applicant_id: null, applicant_name: "이준서", student_no: "20231002", major: "소프트웨어학과", phone: "010-1000-0002", email: "junseo@dju.ac.kr", season: "2026-1", answers: { intro: "소프트웨어학과 23학번 이준서입니다.", motivation: "백엔드 개발 역량을 키우고 싶습니다.", interest: "백엔드" }, status: "pending", reviewed_by: null, reviewed_at: null, created_at: "2026-07-02T00:00:00.000Z", position: "backend", review_note: "포트폴리오 확인 필요" },
  { id: "demo-ap3", applicant_id: null, applicant_name: "최지우", student_no: "20241003", major: "정보통신공학과", phone: "010-1000-0003", email: "jiwoo@dju.ac.kr", season: "2026-1", answers: { intro: "정보통신공학과 24학번 최지우입니다.", motivation: "동아리 활동을 통해 팀 프로젝트 경험을 쌓고 싶습니다.", interest: "안드로이드" }, status: "accepted", reviewed_by: "demo-m1", reviewed_at: "2026-07-03T00:00:00.000Z", created_at: "2026-06-28T00:00:00.000Z", position: "backend", review_note: "" },
  { id: "demo-ap4", applicant_id: null, applicant_name: "한서준", student_no: "20221004", major: "전자공학과", phone: "010-1000-0004", email: "seojun@dju.ac.kr", season: "2026-1", answers: { intro: "전자공학과 22학번 한서준입니다.", motivation: "임베디드와 웹을 함께 다뤄보고 싶습니다.", interest: "임베디드" }, status: "rejected", reviewed_by: "demo-m2", reviewed_at: "2026-07-03T00:00:00.000Z", created_at: "2026-06-29T00:00:00.000Z", position: null, review_note: "지원 파트 미기재" },
  { id: "demo-ap5", applicant_id: null, applicant_name: "정예린", student_no: "20231005", major: "경영학과", phone: "010-1000-0005", email: "yerin@dju.ac.kr", season: "2025-2", answers: { intro: "경영학과 23학번 정예린입니다.", motivation: "IT 동아리 경험을 통해 시야를 넓히고 싶습니다.", interest: "기획" }, status: "accepted", reviewed_by: "demo-m1", reviewed_at: "2025-09-05T00:00:00.000Z", created_at: "2025-09-01T00:00:00.000Z", position: "designer", review_note: "" },
  { id: "demo-ap6", applicant_id: null, applicant_name: "임도현", student_no: "20241006", major: "수학과", phone: "010-1000-0006", email: "dohyun@dju.ac.kr", season: "2025-2", answers: { intro: "수학과 24학번 임도현입니다.", motivation: "알고리즘 스터디에 참여하고 싶습니다.", interest: "AI" }, status: "rejected", reviewed_by: "demo-m2", reviewed_at: "2025-09-05T00:00:00.000Z", created_at: "2025-09-02T00:00:00.000Z", position: null, review_note: "" },
];

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
  { id: "demo-n2", title: "8월 모각코 안내", body: "8월 모각코를 진행합니다. 다같이 모여 각자 할 일을 하는 자율 세션이에요. 관심 있는 분은 신청해주세요.", published: true, published_at: "2026-06-20T00:00:00.000Z", created_by: "demo-m2", created_at: "2026-06-18T00:00:00.000Z" },
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

export const DEMO_SURVEY_PRESETS: SurveyPreset[] = [
  {
    id: "demo-preset-1",
    name: "정기세션 만족도 5문항",
    questions: [
      { id: "q1", type: "rating", label: "이번 정기세션의 전반적인 만족도는 어떠셨나요?" },
      { id: "q2", type: "rating", label: "세션에서 다룬 내용이 유익했나요?" },
      { id: "q3", type: "rating", label: "발표·진행 방식은 이해하기 쉬웠나요?" },
      { id: "q4", type: "rating", label: "세션 난이도는 적절했나요?" },
      { id: "q5", type: "rating", label: "세션 장소와 진행 시간은 적절했나요?" },
    ],
    created_by: null,
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
  { id: "demo-iq1", user_id: "demo-m3", category: "general", title: "포인트는 어떻게 적립되나요?", body: "세션 참여 외에 포인트를 받을 수 있는 방법이 궁금합니다.", status: "answered", answer: "스터디 발표, 운영 봉사 등에도 포인트가 부여돼요. 자세한 기준은 공지사항을 참고해주세요.", answered_by: "demo-m1", answered_at: "2026-07-03T00:00:00.000Z", created_at: "2026-07-02T00:00:00.000Z" },
  { id: "demo-iq2", user_id: "demo-m5", category: "activity", title: "동아리방 예약은 어떻게 하나요?", body: "스터디 목적으로 동아리방을 예약하고 싶습니다.", status: "pending", answer: null, answered_by: null, answered_at: null, created_at: "2026-07-07T00:00:00.000Z" },
  { id: "demo-iq3", user_id: "demo-m6", category: "general", title: "휴면 회원 전환 문의", body: "이번 학기 휴학으로 휴면 회원 전환을 요청드립니다.", status: "pending", answer: null, answered_by: null, answered_at: null, created_at: "2026-07-08T00:00:00.000Z" },
  { id: "demo-iq4", user_id: "demo-m4", category: "bug", title: "지난 세션 자료를 다시 받고 싶어요", body: "AI 세션 자료 링크가 만료된 것 같습니다.", status: "answered", answer: "자료 링크를 갱신해서 공지사항에 다시 올려드렸어요.", answered_by: "demo-m2", answered_at: "2026-04-22T00:00:00.000Z", created_at: "2026-04-21T00:00:00.000Z" },
  { id: "demo-iq5", user_id: "demo-m7", category: "general", title: "복귀 절차가 궁금합니다", body: "휴면 상태인데 다시 활동하고 싶습니다. 어떻게 해야 하나요?", status: "pending", answer: null, answered_by: null, answered_at: null, created_at: "2026-07-09T00:00:00.000Z" },
];

export const DEMO_INQUIRY_AUTHORS: Record<
  string,
  { id: string; name: string; nickname: string }
> = {
  "demo-m3": { id: "demo-m3", name: "박지훈", nickname: "Jason" },
  "demo-m4": { id: "demo-m4", name: "최유나", nickname: "Una" },
  "demo-m5": { id: "demo-m5", name: "정민준", nickname: "Kevin" },
  "demo-m6": { id: "demo-m6", name: "한소희", nickname: "Sophie" },
  "demo-m7": { id: "demo-m7", name: "오지훈", nickname: "Leo" },
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

export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "demo-nt1",
    recipient_id: "demo-m3",
    type: "registration_promoted",
    title: "‘8월 모각코’ 참가가 확정됐어요",
    body: "대기자에서 참가 확정으로 승급되었습니다.",
    link: "/events/demo-e1",
    read_at: null,
    created_at: "2026-07-18T02:00:00.000Z",
  },
  {
    id: "demo-nt2",
    recipient_id: "demo-m3",
    type: "inquiry_answered",
    title: "문의에 답변이 등록됐어요",
    body: "‘포인트는 어떻게 적립되나요?’ 문의에 답변이 달렸어요.",
    link: "/inquiries",
    read_at: null,
    created_at: "2026-07-17T05:30:00.000Z",
  },
  {
    id: "demo-nt3",
    recipient_id: "demo-m3",
    type: "badge_awarded",
    title: "‘발표왕’ 배지를 받았어요",
    body: "스터디 발표 3회 이상 달성으로 배지가 수여되었습니다.",
    link: "/profile",
    read_at: "2026-07-15T00:00:00.000Z",
    created_at: "2026-07-15T00:00:00.000Z",
  },
];

export const DEMO_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { id: "iq-common-1", position: null, body: "자기소개와 함께 이 동아리에 지원한 이유를 말씀해주세요.", created_by: null, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" },
  { id: "iq-common-2", position: null, body: "협업 중 갈등을 겪었던 경험과 해결 방법을 말씀해주세요.", created_by: null, created_at: "2026-07-01T00:01:00.000Z", updated_at: "2026-07-01T00:01:00.000Z" },
  { id: "iq-fe-1", position: "frontend", body: "리액트에서 상태 관리를 어떻게 해봤는지 설명해주세요.", created_by: null, created_at: "2026-07-01T00:02:00.000Z", updated_at: "2026-07-01T00:02:00.000Z" },
  { id: "iq-be-1", position: "backend", body: "REST API를 설계할 때 고려하는 점은 무엇인가요?", created_by: null, created_at: "2026-07-01T00:03:00.000Z", updated_at: "2026-07-01T00:03:00.000Z" },
  { id: "iq-ds-1", position: "designer", body: "가장 애착이 가는 디자인 작업물과 그 이유를 소개해주세요.", created_by: null, created_at: "2026-07-01T00:04:00.000Z", updated_at: "2026-07-01T00:04:00.000Z" },
  { id: "iq-bg-1", position: "beginner", body: "개발을 시작하게 된 계기와 앞으로 배우고 싶은 것을 말씀해주세요.", created_by: null, created_at: "2026-07-01T00:05:00.000Z", updated_at: "2026-07-01T00:05:00.000Z" },
];

export const DEMO_GROUPS: Group[] = [
  { id: "demo-g1", type: "study", title: "타입스크립트 딥다이브 스터디", description: "타입 시스템 심화 — 주 1회 온라인", season: "2026-2", status: "recruiting", is_public: false, capacity: 6, created_by: "demo-m1", created_at: "2026-07-01T00:00:00.000Z" },
  { id: "demo-g2", type: "project", title: "캠퍼스 길찾기 AI", description: "Gemini 기반 캠퍼스 내비게이션", season: "2026-2", status: "active", is_public: true, capacity: 5, created_by: "demo-m1", created_at: "2026-06-20T00:00:00.000Z" },
  { id: "demo-g3", type: "project", title: "행사 등록 플랫폼", description: "Firebase 기반 이벤트 허브", season: "2026-1", status: "archived", is_public: true, capacity: null, created_by: "demo-m2", created_at: "2026-02-10T00:00:00.000Z" },
];

export const DEMO_GROUP_MEMBERS: GroupMember[] = [
  { group_id: "demo-g1", user_id: "demo-m3", joined_at: "2026-07-02T00:00:00.000Z" },
  { group_id: "demo-g1", user_id: "demo-m4", joined_at: "2026-07-03T00:00:00.000Z" },
  { group_id: "demo-g2", user_id: "demo-m1", joined_at: "2026-06-21T00:00:00.000Z" },
  { group_id: "demo-g2", user_id: "demo-m5", joined_at: "2026-06-22T00:00:00.000Z" },
  { group_id: "demo-g2", user_id: "demo-m6", joined_at: "2026-06-23T00:00:00.000Z" },
  { group_id: "demo-g3", user_id: "demo-m2", joined_at: "2026-02-11T00:00:00.000Z" },
];

/**
 * 회의 시간 조율 예시. 추천 구간이 1·2·3위로 갈리도록 응답을 맞춰뒀다 —
 * 8/1은 응답자 6명 전원, 8/2는 한소희만 빠진 5명, 8/4는 정민준만 빠진 5명.
 */
const slots = (date: string, times: string[]) => times.map((time) => slotIso(date, time));
const BLOCK_0801 = slots("2026-08-01", ["19:00", "19:30", "20:00"]);
const BLOCK_0802 = slots("2026-08-02", ["21:00", "21:30", "22:00"]);
const BLOCK_0804 = slots("2026-08-04", ["19:00", "19:30", "20:00"]);

export const DEMO_MEETING_POLLS: MeetingPoll[] = [
  { id: "demo-mp1", title: "8월 정기 회의", dates: ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"], start_hour: 18, end_hour: 24, slot_min: 30, created_by: "demo-m1", confirmed_at: null, duration_min: null, due_at: null, notify_before_due: true, invite_token: "demo-token-1", due_notified_at: null, is_mojisoop: true, created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mp2", title: "7월 회고 회의", dates: ["2026-07-20", "2026-07-21", "2026-07-22"], start_hour: 19, end_hour: 23, slot_min: 60, created_by: "demo-m2", confirmed_at: "2026-07-21T11:00:00.000Z", duration_min: 90, due_at: null, notify_before_due: true, invite_token: "demo-token-2", due_notified_at: null, is_mojisoop: true, created_at: "2026-07-14T00:00:00.000Z" },
];

export const DEMO_MEETING_POLL_PARTICIPANTS: MeetingPollParticipant[] = [
  { id: "demo-mpp1", poll_id: "demo-mp1", user_id: "demo-m1", name: "Ryan(김도윤)", email: null, slots: [...BLOCK_0801, ...BLOCK_0802, ...BLOCK_0804, ...slots("2026-08-03", ["18:00", "18:30"])], responded_at: "2026-07-28T01:00:00.000Z", created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp2", poll_id: "demo-mp1", user_id: "demo-m2", name: "Sunny(이서연)", email: null, slots: [...BLOCK_0801, ...BLOCK_0802, ...BLOCK_0804, ...slots("2026-08-05", ["22:00", "22:30"])], responded_at: "2026-07-28T02:00:00.000Z", created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp3", poll_id: "demo-mp1", user_id: "demo-m3", name: "Jason(박지훈)", email: null, slots: [...BLOCK_0801, ...BLOCK_0802, ...BLOCK_0804], responded_at: "2026-07-28T03:00:00.000Z", created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp4", poll_id: "demo-mp1", user_id: "demo-m4", name: "Una(최유나)", email: null, slots: [...BLOCK_0801, ...BLOCK_0802, ...BLOCK_0804], responded_at: "2026-07-28T04:00:00.000Z", created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp5", poll_id: "demo-mp1", user_id: "demo-m5", name: "Kevin(정민준)", email: null, slots: [...BLOCK_0801, ...BLOCK_0802], responded_at: "2026-07-28T05:00:00.000Z", created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp6", poll_id: "demo-mp1", user_id: "demo-m6", name: "Sophie(한소희)", email: null, slots: [...BLOCK_0801, ...BLOCK_0804], responded_at: "2026-07-28T06:00:00.000Z", created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp7", poll_id: "demo-mp1", user_id: "demo-m7", name: "Leo(오지훈)", email: null, slots: [], responded_at: null, created_at: "2026-07-28T00:00:00.000Z" },
  { id: "demo-mpp8", poll_id: "demo-mp2", user_id: "demo-m1", name: "Ryan(김도윤)", email: null, slots: slots("2026-07-21", ["20:00", "21:00"]), responded_at: "2026-07-15T01:00:00.000Z", created_at: "2026-07-14T00:00:00.000Z" },
  { id: "demo-mpp9", poll_id: "demo-mp2", user_id: "demo-m2", name: "Sunny(이서연)", email: null, slots: slots("2026-07-21", ["20:00", "21:00"]), responded_at: "2026-07-15T02:00:00.000Z", created_at: "2026-07-14T00:00:00.000Z" },
];
