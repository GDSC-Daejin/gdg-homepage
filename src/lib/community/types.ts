import type { ActionResult, Event, Inquiry, InquiryCategory, Notice, Profile } from "@/lib/types";

export type EventUserPair = { user_id: string; event_id: string };

export interface AttendanceReads {
  activeMembers(): Promise<Profile[]>;
  pastEventIds(beforeIso: string): Promise<string[]>;
  confirmedRegistrations(eventIds: string[]): Promise<EventUserPair[]>;
  attendances(eventIds: string[]): Promise<EventUserPair[]>;
}

export interface EventReads {
  eventsStartingBetween(fromIso: string, toIso: string): Promise<Event[]>;
  confirmedCounts(eventIds: string[]): Promise<Record<string, number>>;
}

export type AuthorInfo = Pick<Profile, "id" | "name">;

export interface InquiryReads {
  list(): Promise<Inquiry[]>;
  authors(userIds: string[]): Promise<AuthorInfo[]>;
}

export interface InquiryOps {
  submit(input: {
    user_id: string;
    category: InquiryCategory;
    title: string;
    body: string;
  }): Promise<ActionResult>;
  answer(id: string, answer: string): Promise<ActionResult>;
}

export interface InquiryStore {
  reads: InquiryReads;
  ops: InquiryOps;
}

export interface NoticeReads {
  list(): Promise<Notice[]>;
  get(id: string): Promise<Notice | null>;
}

export interface NoticeOps {
  create(input: { title: string; body: string; created_by: string }): Promise<ActionResult>;
  update(id: string, input: { title: string; body: string }): Promise<ActionResult>;
  delete(id: string): Promise<ActionResult>;
  publish(id: string): Promise<ActionResult & { notice?: Notice }>;
}

export interface NoticeStore {
  reads: NoticeReads;
  ops: NoticeOps;
}

export interface Community {
  attendance: AttendanceReads;
  events: EventReads;
  inquiries: InquiryStore;
  notices: NoticeStore;
}
