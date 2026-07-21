// GA4 원본값(경로·채널·이벤트명)을 비개발자도 이해할 수 있는 한글 라벨로 변환.
// 매핑에 없으면 원본값을 그대로 노출해 새 경로가 숨지 않게 한다.

const PAGE_LABELS: Record<string, string> = {
  "/": "홈",
  "/about": "동아리 소개",
  "/apply": "지원하기",
  "/privacy": "개인정보처리방침",
  "/projects": "프로젝트",
  "/team": "팀 소개",
  "/interview": "면접",
  "/onboarding": "온보딩",
  "/auth/complete": "로그인 완료",
  "/attend": "출석체크",
  "/events": "이벤트",
  "/notices": "공지",
  "/board": "커뮤니티",
  "/qna": "커뮤니티 · Q&A",
  "/meetings": "커뮤니티 · 모임",
  "/surveys": "설문",
  "/inquiries": "문의",
  "/materials": "자료실",
  "/profile": "프로필",
  "/landing-preview": "랜딩 미리보기",
};

const DYNAMIC_PAGE_LABELS: [RegExp, string][] = [
  [/^\/events\/[^/]+$/, "이벤트 상세"],
  [/^\/notices\/[^/]+$/, "공지 상세"],
  [/^\/board\/[^/]+$/, "커뮤니티 글"],
  [/^\/qna\/[^/]+$/, "Q&A 글"],
  [/^\/surveys\/[^/]+$/, "설문 참여"],
];

// GA4 sessionDefaultChannelGroup 기본값.
const CHANNEL_LABELS: Record<string, string> = {
  Direct: "직접 방문",
  "Organic Search": "검색 유입",
  "Organic Social": "SNS 유입",
  "Organic Video": "동영상 유입",
  Referral: "외부 링크",
  Email: "이메일",
  "Paid Search": "검색 광고",
  "Paid Social": "SNS 광고",
  "Paid Shopping": "쇼핑 광고",
  "Paid Video": "동영상 광고",
  Display: "디스플레이 광고",
  Affiliates: "제휴",
  Audio: "오디오",
  Unassigned: "미분류",
};

const EVENT_LABELS: Record<string, string> = {
  apply_submit: "지원서 제출",
  login: "로그인",
  attendance_check: "출석 체크",
  survey_submit: "설문 제출",
};

export function labelPage(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (PAGE_LABELS[clean]) return PAGE_LABELS[clean];
  for (const [pattern, label] of DYNAMIC_PAGE_LABELS) {
    if (pattern.test(clean)) return label;
  }
  return path;
}

export function labelChannel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function labelEvent(name: string): string {
  return EVENT_LABELS[name] ?? name;
}
