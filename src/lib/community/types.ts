import type { Event, Profile } from "@/lib/types";

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

export interface Community {
  attendance: AttendanceReads;
  events: EventReads;
}
