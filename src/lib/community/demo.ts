import { DEMO_INQUIRIES, DEMO_INQUIRY_AUTHORS } from "@/lib/demoData";
import type { Community } from "./types";

export const demoCommunity: Community = {
  attendance: {
    async activeMembers() {
      return [];
    },
    async pastEventIds() {
      return [];
    },
    async confirmedRegistrations() {
      return [];
    },
    async attendances() {
      return [];
    },
  },
  events: {
    async eventsStartingBetween() {
      return [];
    },
    async confirmedCounts() {
      return {};
    },
  },
  inquiries: {
    reads: {
      async list() {
        return DEMO_INQUIRIES;
      },
      async authors(userIds) {
        return userIds
          .map((id) => DEMO_INQUIRY_AUTHORS[id])
          .filter((a): a is { id: string; name: string } => !!a);
      },
    },
    ops: {
      async submit() {
        return {};
      },
      async answer() {
        return {};
      },
    },
  },
};
