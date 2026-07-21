import type { ActionResult, Event, Inquiry, InquiryCategory, Profile } from "@/lib/types";

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

export interface Community {
  attendance: AttendanceReads;
  events: EventReads;
  inquiries: InquiryStore;
}
