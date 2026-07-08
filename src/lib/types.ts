export type Role = "admin" | "member" | "applicant";
export type MemberStatus = "active" | "dormant" | "withdrawn";
export type ApplicationStatus = "pending" | "accepted" | "rejected";
export type EventType = "session" | "study" | "devfest";
export type RegistrationStatus = "confirmed" | "waitlisted";

export interface Profile {
  id: string;
  name: string;
  student_no: string;
  major: string;
  phone: string;
  interests: string[];
  role: Role;
  status: MemberStatus;
  joined_at: string;
}

export interface Application {
  id: string;
  applicant_id: string;
  season: string;
  answers: Record<string, string>;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  type: EventType;
  title: string;
  description: string;
  starts_at: string;
  location: string;
  speaker: string;
  capacity: number | null;
  created_by: string | null;
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

export type ActionResult = { error?: string };
