import type { SupabaseClient } from "@supabase/supabase-js";
import type { Event, Profile } from "@/lib/types";
import type { AttendanceReads, Community, EventReads, EventUserPair } from "./types";

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

  return { attendance, events };
}
