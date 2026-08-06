import { describe, expect, it } from "vitest";
import { upcomingEvents } from "@/app/(member)/HomeDashboard";
import type { Event } from "@/lib/types";

const event = (id: string, event_date: string): Event => ({
  id,
  type: "session",
  title: "이벤트",
  description: "",
  starts_at: "",
  ends_at: null,
  event_date,
  location: "",
  address: "",
  speaker: "",
  capacity: null,
  created_by: null,
  created_at: "2026-08-01T00:00:00.000Z",
});

describe("회원 홈 예정 이벤트", () => {
  it("생성 순서와 관계없이 이른 날짜를 먼저 보여준다", () => {
    expect(upcomingEvents([event("later", "2026-08-28"), event("earlier", "2026-08-14")], Date.parse("2026-08-01"))
      .map((item) => item.id)).toEqual(["earlier", "later"]);
  });
});
