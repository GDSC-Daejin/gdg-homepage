export type Role = "organizer" | "team_member" | "member" | "applicant";
export type Position = "frontend" | "backend" | "designer" | "beginner";
export const ADMIN_ROLES: Role[] = ["organizer", "team_member"];
export function isStaff(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return !!profile && ADMIN_ROLES.includes(profile.role);
}
export const POSITION_LABELS: Record<Position, string> = {
  frontend: "프론트엔드",
  backend: "백엔드",
  designer: "디자이너",
  beginner: "비기너",
};
export type MemberStatus = "active" | "dormant" | "withdrawn";
export type AcademicStatus = "enrolled" | "leave" | "graduated" | "completed";
export const ACADEMIC_STATUS_LABELS: Record<AcademicStatus, string> = {
  enrolled: "재학",
  leave: "휴학",
  graduated: "졸업",
  completed: "수료",
};
export type ApplicationStatus = "waiting" | "pending" | "accepted" | "rejected";
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  waiting: "심사 대기",
  pending: "심사 중",
  accepted: "합격",
  rejected: "불합격",
};
export const APPLICATION_STATUS_TONES: Record<
  ApplicationStatus,
  "neutral" | "warning" | "primary" | "success" | "danger"
> = {
  waiting: "warning",
  pending: "primary",
  accepted: "success",
  rejected: "danger",
};
// 문서화 목적: 합법적 다음 상태 표. RPC(admin_set_application_status)나 UI가 이 순서를
// 강제하지는 않음 — 강제는 별도 스코프.
export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  waiting: ["pending"],
  pending: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};
export type EventType = "session" | "study" | "mogakco" | "party";
export type RegistrationStatus = "confirmed" | "waitlisted";

export interface Profile {
  id: string;
  name: string;
  avatar_path?: string | null;
  nickname: string;
  student_no: string;
  major: string;
  phone: string;
  interests: string[];
  role: Role;
  position: Position | null;
  status: MemberStatus;
  academic_status: AcademicStatus | null;
  joined_at: string;
}

export interface Application {
  id: string;
  applicant_id: string | null;
  applicant_name: string;
  student_no: string;
  major: string;
  phone: string;
  email: string;
  season: string;
  answers: Record<string, string>;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  position: Position | null;
  review_note: string;
}

export interface InterviewSlot {
  id: string;
  season: string;
  starts_at: string;
  duration_min: number;
  application_id: string | null;
  interviewer_id: string | null;
  meet_uri: string | null;
  meet_code: string | null;
  status: "open" | "booked" | "completed" | "canceled";
}

export interface RecruitingSettings {
  season: string;
  is_open: boolean;
  open_positions: Position[];
  apply_start: string | null;
  apply_end: string | null;
}

export interface Event {
  id: string;
  type: EventType;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  address: string;
  speaker: string;
  capacity: number | null;
  place_id?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  created_at: string;
}

export interface Attendance {
  id: string;
  event_id: string;
  user_id: string;
  checked_at: string;
}

export type ActionResult = { error?: string; warning?: string };

export interface Notice {
  id: string;
  title: string;
  body: string;
  published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InterviewQuestion {
  id: string;
  position: Position | null;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

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

export type SurveyQuestionType = "rating" | "text";

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
}

export interface Survey {
  id: string;
  title: string;
  event_id: string | null;
  questions: SurveyQuestion[];
  is_open: boolean;
  created_at: string;
}

export interface SurveyPreset {
  id: string;
  name: string;
  questions: SurveyQuestion[];
  created_by: string | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  answers: Record<string, number | string>;
  created_at: string;
}

export type InquiryStatus = "pending" | "answered";

export type InquiryCategory =
  | "general"
  | "suggestion"
  | "bug"
  | "activity"
  | "etc";

export const INQUIRY_CATEGORIES: InquiryCategory[] = [
  "general",
  "suggestion",
  "bug",
  "activity",
  "etc",
];

export const INQUIRY_CATEGORY_LABEL: Record<InquiryCategory, string> = {
  general: "일반",
  suggestion: "건의",
  bug: "버그",
  activity: "활동",
  etc: "기타",
};

export const INQUIRY_CATEGORY_TONE: Record<
  InquiryCategory,
  "primary" | "success" | "warning" | "danger" | "neutral"
> = {
  general: "neutral",
  suggestion: "primary",
  bug: "danger",
  activity: "success",
  etc: "neutral",
};

export interface Inquiry {
  id: string;
  user_id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  status: InquiryStatus;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface PointLog {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  ref_event: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  user_id: string;
  awarded_by: string | null;
  awarded_at: string;
}

export type BudgetEntryType = "income" | "expense";

export interface BudgetEntry {
  id: string;
  entry_date: string;
  type: BudgetEntryType;
  category: string;
  amount: number;
  memo: string;
  created_by: string | null;
  created_at: string;
}

export type BoardType = "free" | "qna";

export interface Post {
  id: string;
  board: BoardType;
  author_id: string;
  title: string;
  body: string;
  event_id: string | null;
  accepted_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  title: string;
  type: string;
  event: string;
  url: string;
  date: string;
  notionUrl: string;
}

export type GroupType = "study" | "project";
export type GroupStatus = "recruiting" | "active" | "archived";

export interface Group {
  id: string;
  type: GroupType;
  title: string;
  description: string;
  season: string;
  status: GroupStatus;
  is_public: boolean;
  capacity: number | null;
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface PublicGroupCard {
  id: string;
  type: GroupType;
  title: string;
  description: string;
  season: string;
  member_count: number;
}

export interface Meeting {
  id: string;
  notion_page_id: string;
  title: string;
  meeting_date: string | null;
  mode: "online" | "offline";
  summary: string;
  notion_url: string;
  synced_at: string;
  created_at: string;
}
