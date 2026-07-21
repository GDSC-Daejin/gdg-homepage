import type { SupabaseClient } from "@supabase/supabase-js";
import { toKoreanError } from "@/lib/errors";
import type { Event, Inquiry, Profile } from "@/lib/types";
import type {
  AttendanceReads,
  AuthorInfo,
  Community,
  EventReads,
  EventUserPair,
  InquiryStore,
} from "./types";

export function supabaseCommunity(client: SupabaseClient): Community {
  const attendance: AttendanceReads = {
    async activeMembers() {
      const { data } = await client
        .from("profiles")
        .select("*")
        .in("role", ["member", "organizer", "team_member"])
        .eq("status", "active")
        .order("name");
      return (data as Profile[]) ?? [];
    },
    async pastEventIds(beforeIso) {
      const { data } = await client.from("events").select("id").lt("starts_at", beforeIso);
      return (data ?? []).map((event) => event.id);
    },
    async confirmedRegistrations(eventIds) {
      if (eventIds.length === 0) return [];
      const { data } = await client
        .from("event_registrations")
        .select("user_id, event_id")
        .eq("status", "confirmed")
        .in("event_id", eventIds);
      return (data as EventUserPair[]) ?? [];
    },
    async attendances(eventIds) {
      if (eventIds.length === 0) return [];
      const { data } = await client
        .from("attendances")
        .select("user_id, event_id")
        .in("event_id", eventIds);
      return (data as EventUserPair[]) ?? [];
    },
  };

  const events: EventReads = {
    async eventsStartingBetween(fromIso, toIso) {
      const { data } = await client
        .from("events")
        .select("*")
        .gte("starts_at", fromIso)
        .lt("starts_at", toIso)
        .order("starts_at", { ascending: true });
      return (data as Event[]) ?? [];
    },
    async confirmedCounts(eventIds) {
      if (eventIds.length === 0) return {};
      const { data } = await client.rpc("event_confirmed_counts", {
        p_event_ids: eventIds,
      });
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.event_id] = Number(row.confirmed);
      }
      return counts;
    },
  };

  const inquiries: InquiryStore = {
    reads: {
      async list() {
        const { data } = await client
          .from("inquiries")
          .select("*")
          .order("created_at", { ascending: false });
        return (data as Inquiry[]) ?? [];
      },
      async authors(userIds) {
        if (userIds.length === 0) return [];
        const { data } = await client
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        return (data as AuthorInfo[]) ?? [];
      },
    },
    ops: {
      async submit(input) {
        const { error } = await client.from("inquiries").insert(input);
        if (error) return { error: toKoreanError(error) };
        return {};
      },
      async answer(id, answer) {
        const { error } = await client.rpc("admin_answer_inquiry", {
          p_inquiry: id,
          p_answer: answer,
        });
        if (error) return { error: toKoreanError(error) };
        return {};
      },
    },
  };

  return { attendance, events, inquiries };
}
