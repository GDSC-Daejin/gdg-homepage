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
};
